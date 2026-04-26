const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-admin-panel';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
const prisma = new PrismaClient();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ad_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('الصور المدعومة: JPEG, PNG, GIF, WebP'));
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// Track active connections
let activeUsers = 0;

io.on('connection', (socket) => {
  activeUsers++;
  io.emit('activeUsers', activeUsers);

  socket.on('disconnect', () => {
    activeUsers--;
    io.emit('activeUsers', activeUsers);
  });
});

// 24-Hour Cycle Checker
setInterval(async () => {
  try {
    const round = await prisma.drawRound.findFirst({ where: { isActive: true } });
    if (round) {
      const now = new Date();
      const diffMs = now - new Date(round.cycleStartDate);
      const hours24 = 24 * 60 * 60 * 1000;
      if (diffMs >= hours24) {
        // Close round
        await prisma.drawRound.update({
          where: { id: round.id },
          data: { isActive: false, cycleEndDate: now }
        });
        // Create new round
        const newRound = await prisma.drawRound.create({ data: {} });
        io.emit('roundReset', { roundId: newRound.id });
      }
    }
  } catch (error) {
    console.error('Error checking 24h cycle:', error);
  }
}, 60 * 1000); // Check every minute

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function getSettings() {
  let setting = await prisma.setting.findFirst();
  if (!setting) {
    setting = await prisma.setting.create({ data: {} });
  }
  return setting;
}

async function getActiveRound() {
  let round = await prisma.drawRound.findFirst({ where: { isActive: true } });
  if (!round) {
    round = await prisma.drawRound.create({ data: {} });
  }
  return round;
}

function generateCouponCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'WIN-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ──────────────────────────────────────────────
// Public API Routes
// ──────────────────────────────────────────────

// Check if system enabled & get current round status
app.get('/api/draw/status', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.couponSystemEnabled) {
      return res.json({ enabled: false, round: null });
    }

    // Get most recent round (active preferred, or last completed)
    const round = await prisma.drawRound.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!round) {
      // No rounds yet — create initial one
      const newRound = await prisma.drawRound.create({ data: {} });
      return res.json({ enabled: true, round: { id: newRound.id, isActive: true, entryCount: 0 } });
    }

    const entryCount = await prisma.drawEntry.count({ where: { roundId: round.id } });

    res.json({
      enabled: true,
      round: {
        id: round.id,
        isActive: round.isActive,
        entryCount,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// User submits phone to enter draw
app.post('/api/draw/enter', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.trim().length < 7) {
      return res.status(400).json({ error: 'الرجاء إدخال رقم هاتف صحيح' });
    }

    const settings = await getSettings();
    if (!settings.couponSystemEnabled) {
      return res.status(400).json({ error: 'نظام الكوبونات معطل حالياً' });
    }

    const round = await getActiveRound();

    // Check if currently waiting
    const activeEntry = await prisma.drawEntry.findFirst({
      where: { phone: phone.trim(), roundId: round.id, status: 'WAITING' }
    });

    if (activeEntry) {
       return res.status(400).json({ error: 'لديك سحب قيد الانتظار بالفعل' });
    }

    // Check daily limit
    const entriesCount = await prisma.drawEntry.count({
      where: { phone: phone.trim(), roundId: round.id }
    });

    if (entriesCount >= settings.dailyLimit) {
       return res.status(400).json({ error: `لقد استنفدت الحد المسموح لك وهو ${settings.dailyLimit} محاولات في هذه الجولة` });
    }

    // Create entry with WAITING status
    const newEntry = await prisma.drawEntry.create({
      data: { 
        phone: phone.trim(), 
        roundId: round.id,
        status: 'WAITING'
      }
    });

    const entryCount = await prisma.drawEntry.count({ where: { roundId: round.id } });
    io.emit('entryCount', entryCount);

    res.json({ 
      success: true, 
      timerDuration: settings.timerDuration || 60,
      entryCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// Heartbeat endpoint
app.post('/api/draw/heartbeat', async (req, res) => {
  try {
    const { phone } = req.body;
    const round = await getActiveRound();
    const entry = await prisma.drawEntry.findFirst({
      where: { phone: phone.trim(), roundId: round.id, status: 'WAITING' }
    });
    if (entry) {
      await prisma.drawEntry.update({
        where: { id: entry.id },
        data: { lastHeartbeat: new Date() }
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'غير موجود' });
    }
  } catch (error) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// Forfeit endpoint
app.post('/api/draw/forfeit', async (req, res) => {
  try {
    const { phone } = req.body;
    const round = await getActiveRound();
    const entry = await prisma.drawEntry.findFirst({
      where: { phone: phone.trim(), roundId: round.id, status: 'WAITING' }
    });
    if (entry) {
      await prisma.drawEntry.update({
        where: { id: entry.id },
        data: { status: 'FORFEITED' }
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'غير موجود' });
    }
  } catch (error) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// Result endpoint (called when timer ends)
app.post('/api/draw/result', async (req, res) => {
  try {
    const { phone } = req.body;
    const trimmedPhone = phone.trim();
    const round = await getActiveRound();
    const settings = await getSettings();

    const entry = await prisma.drawEntry.findFirst({
      where: { phone: trimmedPhone, roundId: round.id },
      orderBy: { createdAt: 'desc' }
    });

    if (!entry) return res.status(400).json({ error: 'غير مسجل' });

    if (entry.status === 'COMPLETED') {
      return res.json({ success: true, isWinner: entry.isWinner, couponCode: entry.couponCode });
    }

    if (entry.status === 'FORFEITED') {
      return res.json({ success: true, isWinner: false, forfeited: true });
    }

    const now = new Date();
    const heartbeatDiff = now - new Date(entry.lastHeartbeat);
    const timeSinceStart = now - new Date(entry.startedAt);
    
    // Check if heartbeat is valid (within 25 seconds buffer)
    if (heartbeatDiff > 25000) {
      await prisma.drawEntry.update({
        where: { id: entry.id },
        data: { status: 'FORFEITED' }
      });
      return res.json({ success: true, isWinner: false, forfeited: true });
    }

    // Determine if winner
    let isWinner = false;
    let couponCode = null;
    let couponValue = null;
    let drawnAt = null;

    const currentWinnersCount = await prisma.drawEntry.count({
      where: { roundId: round.id, isWinner: true }
    });

    if (currentWinnersCount < settings.winnersPerDay) {
      isWinner = true;
      couponCode = generateCouponCode();
      couponValue = settings.couponValue;
      drawnAt = new Date();
    }

    await prisma.drawEntry.update({
      where: { id: entry.id },
      data: {
        status: 'COMPLETED',
        isWinner,
        couponCode,
        couponValue,
        drawnAt
      }
    });

    if (isWinner) {
      io.emit('drawResult', {
        winnerPhone: entry.phone,
        couponCode,
        drawnAt,
      });
    }

    res.json({ 
      success: true, 
      isWinner,
      couponCode,
      forfeited: false
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Check if a specific phone won (looks at the round they entered)
app.post('/api/draw/check', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'رقم الهاتف مطلوب' });

    const trimmedPhone = phone.trim();

    // Find the most recent round this phone participated in
    const entry = await prisma.drawEntry.findFirst({
      where: { phone: trimmedPhone },
      orderBy: { createdAt: 'desc' },
      include: { round: true }
    });

    if (!entry) {
      // Phone never entered — check if there's an active round
      return res.json({ drawDone: false, notEntered: true });
    }

    const round = entry.round;

    if (entry.status === 'FORFEITED') {
      return res.json({ drawDone: true, isWinner: false, forfeited: true });
    }

    if (entry.status === 'WAITING') {
      return res.json({ drawDone: false });
    }

    res.json({
      drawDone: true,
      isWinner: entry.isWinner,
      couponCode: entry.isWinner ? entry.couponCode : null,
      drawnAt: entry.drawnAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// Get active advertisements
app.get('/api/advertisement', async (req, res) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(ads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// ──────────────────────────────────────────────
// Admin Auth
// ──────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
});

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'غير مصرح لك بالدخول' });
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'جلسة غير صالحة، يرجى تسجيل الدخول مجدداً' });
  }
};

// ──────────────────────────────────────────────
// Admin Settings
// ──────────────────────────────────────────────

app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

app.put('/api/admin/settings', authenticateAdmin, async (req, res) => {
  const { timerDuration, maxCouponValue, dailyLimit, couponSystemEnabled, winnersPerDay, couponValue } = req.body;
  let setting = await getSettings();
  setting = await prisma.setting.update({
    where: { id: setting.id },
    data: {
      timerDuration: Number(timerDuration),
      maxCouponValue: Number(maxCouponValue),
      dailyLimit: Number(dailyLimit),
      couponSystemEnabled: Boolean(couponSystemEnabled),
      winnersPerDay: Number(winnersPerDay || 5),
      couponValue: Number(couponValue || 50)
    }
  });
  res.json(setting);
});

// ──────────────────────────────────────────────
// Admin Draw Management
// ──────────────────────────────────────────────

// Get current round info + all participants
app.get('/api/admin/draw', authenticateAdmin, async (req, res) => {
  try {
    const round = await getActiveRound();
    const entries = await prisma.drawEntry.findMany({
      where: { roundId: round.id },
      orderBy: { createdAt: 'asc' }
    });
    const winners = entries.filter(e => e.isWinner);
    res.json({ round, entries, winners });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// Get History (previous rounds)
app.get('/api/admin/history', authenticateAdmin, async (req, res) => {
  try {
    const rounds = await prisma.drawRound.findMany({
      where: { isActive: false },
      orderBy: { cycleStartDate: 'desc' },
      include: { entries: true }
    });
    res.json(rounds);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});



// ──────────────────────────────────────────────
// Admin Advertisement Management
// ──────────────────────────────────────────────

// Get active advertisements
app.get('/api/admin/advertisement', authenticateAdmin, async (req, res) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// Upload / replace advertisement
app.post('/api/admin/advertisement', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const { caption } = req.body;
    if (!req.file) return res.status(400).json({ error: 'الرجاء رفع صورة' });
    if (!caption || !caption.trim()) return res.status(400).json({ error: 'الرجاء إدخال وصف الإعلان' });

    // DO NOT deactivate old ads - we support multiple now

    const imageUrl = `/uploads/${req.file.filename}`;
    const ad = await prisma.advertisement.create({
      data: { imageUrl, caption: caption.trim(), isActive: true }
    });

    res.json({ success: true, ad });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ أثناء رفع الإعلان' });
  }
});

// Remove advertisement
app.delete('/api/admin/advertisement/:id', authenticateAdmin, async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    const ad = await prisma.advertisement.findUnique({ where: { id: adId } });
    
    if (ad) {
      const filePath = path.join(uploadsDir, path.basename(ad.imageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await prisma.advertisement.delete({ where: { id: adId } });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الإعلان' });
  }
});

// ──────────────────────────────────────────────
// Admin Legacy Data
// ──────────────────────────────────────────────

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.get('/api/admin/coupons', authenticateAdmin, async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { date: 'desc' } });
  res.json(coupons);
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
