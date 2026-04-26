import React, { useState, useEffect, useRef } from 'react';

const API_URL = 'https://couponsweb-production.up.railway.app/api';
// ── Confetti Component ──────────────────────────
const Confetti = () => {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2.5 + Math.random() * 2}s`,
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
};

// ── Advertisement Banner ────────────────────────
const AdBanner = ({ ads }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    if (!ads || ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ads]);

  if (!ads || ads.length === 0) return null;
  
  const ad = ads[currentIndex];

  return (
    <div className="ad-banner">
      <div className="ad-banner-tag">إعلان مميز ✨</div>
      <img src={`https://couponsweb-production.up.railway.app${ad.imageUrl}`} alt="إعلان" className="ad-banner-img" />
      {ad.caption && <p className="ad-banner-caption">{ad.caption}</p>}
    </div>
  );
};

// ── Main Coupons Component ──────────────────────
const Coupons = () => {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | warning | entering | timer | won | lost | forfeited
  const [errorMsg, setErrorMsg] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [entryCount, setEntryCount] = useState(0);
  const [ads, setAds] = useState([]);
  const [drawnAt, setDrawnAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const heartbeatRef = useRef(null);
  const timerRef = useRef(null);
  const enteredPhone = useRef('');

  // Load ad + draw status on mount
  useEffect(() => {
    fetchAds();
    checkDrawStatus();
  }, []);

  // Strict Tab Monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if ((document.hidden || document.visibilityState === 'hidden') && status === 'timer') {
        handleForfeit();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, [status]);

  // Timer logic
  useEffect(() => {
    if (status === 'timer' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            clearInterval(heartbeatRef.current);
            fetchResult();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      heartbeatRef.current = setInterval(() => {
        fetch(`${API_URL}/draw/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: enteredPhone.current })
        });
      }, 2000);

      return () => {
        clearInterval(timerRef.current);
        clearInterval(heartbeatRef.current);
      };
    }
  }, [status, timeLeft]);

  const fetchAds = async () => {
    try {
      const res = await fetch(`${API_URL}/advertisement`);
      const data = await res.json();
      setAds(data || []);
    } catch (_) {}
  };

  const checkDrawStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/draw/status`);
      const data = await res.json();
      if (data.round) setEntryCount(data.round.entryCount || 0);
    } catch (_) {}
  };

  const handleForfeit = async () => {
    clearInterval(timerRef.current);
    clearInterval(heartbeatRef.current);
    setStatus('forfeited');
    try {
      await fetch(`${API_URL}/draw/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: enteredPhone.current })
      });
    } catch (_) {}
  };

  const fetchResult = async () => {
    try {
      const res = await fetch(`${API_URL}/draw/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: enteredPhone.current })
      });
      const data = await res.json();
      if (data.forfeited) {
        setStatus('forfeited');
      } else if (data.isWinner) {
        setCouponCode(data.couponCode);
        setDrawnAt(new Date());
        setStatus('won');
      } else {
        setStatus('lost');
      }
    } catch (_) {
      setStatus('lost');
    }
  };

  const handleSubmitPhone = (e) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 7) {
      setErrorMsg('الرجاء إدخال رقم هاتف صحيح');
      return;
    }
    setErrorMsg('');
    enteredPhone.current = phone.trim();
    setStatus('warning');
  };

  const handleStartTimer = async () => {
    setStatus('entering');
    try {
      const res = await fetch(`${API_URL}/draw/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: enteredPhone.current })
      });
      const data = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
        setStatus('idle');
      } else {
        setEntryCount(data.entryCount || 0);
        setTimeLeft(data.timerDuration || 60);
        setStatus('timer');
      }
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالسيرفر');
      setStatus('idle');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setPhone('');
    setErrorMsg('');
    setCouponCode('');
    enteredPhone.current = '';
    setTimeLeft(0);
    checkDrawStatus();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="coupons-page">

      {/* Advertisement Banner */}
      <AdBanner ads={ads} />

      {/* Draw Info Badge */}
      <div className="draw-info-badge">
        🎯 يتم اختيار فائزين بشكل عشوائي تلقائياً
      </div>

      {/* ── IDLE: Entry Form ── */}
      {(status === 'idle' || status === 'entering' && !errorMsg) && (
        <div className="draw-entry-card">
          <h1 className="page-title">اشترك في السحب</h1>
          <p className="page-subtitle">
            أدخل رقم هاتفك للمشاركة في السحب الفوري.
          </p>

          <div className="participants-count">
            <span className="participants-icon">👥</span>
            <span>{entryCount} مشترك حتى الآن</span>
          </div>

          <form onSubmit={handleSubmitPhone}>
            <div className="input-group">
              <label className="input-label">رقم الهاتف</label>
              <input
                type="tel"
                id="phone-input"
                className="form-input"
                placeholder="05XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                disabled={status === 'entering'}
              />
              {errorMsg && <div className="error-message">{errorMsg}</div>}
            </div>
            <button
              type="submit"
              id="submit-btn"
              className="btn-primary"
              disabled={status === 'entering'}
            >
              التالي ⬅️
            </button>
          </form>
        </div>
      )}

      {/* ── WARNING STATE ── */}
      {status === 'warning' && (
        <div className="draw-entry-card" style={{ textAlign: 'center', borderColor: '#ffcc00' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
          <h2 style={{ marginBottom: '20px', color: '#cc9900' }}>تنبيه هام!</h2>
          <p style={{ fontSize: '1.2rem', lineHeight: '1.8', fontWeight: 'bold', marginBottom: '30px' }}>
            يجب البقاء في هذه الصفحة حتى ينتهي المؤقت. 
            <br />
            مغادرة الصفحة أو التبديل لتطبيق آخر سيؤدي إلى فقدان فرصتك فوراً.
          </p>
          <button
            className="btn-primary"
            onClick={handleStartTimer}
            style={{ backgroundColor: '#2ecc71' }}
          >
            فهمت، ابدأ المؤقت ⏱️
          </button>
          <button
            onClick={handleReset}
            style={{ marginTop: '15px', background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '1rem', fontFamily: 'var(--font-heading)' }}
          >
            تراجع
          </button>
        </div>
      )}

      {/* ── TIMER STATE ── */}
      {status === 'timer' && (
        <div className="draw-waiting-card" style={{ borderColor: 'var(--accent-color)' }}>
          <div className="timer-text" style={{ fontSize: '4rem', marginBottom: '20px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
            {formatTime(timeLeft)}
          </div>
          <h2 className="waiting-title">السحب قيد التقدم...</h2>
          <p className="waiting-subtitle" style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>
            ⚠️ لا تقم بمغادرة هذه الصفحة أبداً!
          </p>
          <div className="waiting-pulse">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay"></div>
            <span>جارٍ التحقق والتأكيد...</span>
          </div>
        </div>
      )}

      {/* ── WON ── */}
      {status === 'won' && (
        <div className="result-container result-won">
          <Confetti />
          <div className="result-emoji">🏆</div>
          <div className="result-title">مبروك! أنت الفائز! 🎉</div>
          <p className="result-sub">لقد تم اختيارك كفائز في هذا السحب</p>
          <div className="coupon-code-display">
            <div className="coupon-code-label">كود الكوبون الخاص بك</div>
            <div className="coupon-code-value" dir="ltr">{couponCode}</div>
            <button
              className="copy-btn"
              onClick={() => {
                navigator.clipboard?.writeText(couponCode);
              }}
            >
              📋 نسخ الكود
            </button>
          </div>
          {drawnAt && (
            <p className="result-date">
              تاريخ السحب: {new Date(drawnAt).toLocaleString('ar-EG')}
            </p>
          )}
          <button className="btn-primary" onClick={handleReset} style={{ marginTop: '20px' }}>
            العودة
          </button>
        </div>
      )}

      {/* ── LOST ── */}
      {status === 'lost' && (
        <div className="result-container result-lost-card">
          <div className="result-emoji">🌟</div>
          <div className="result-title result-lost">حاول مرة أخرى، لقد خسرت</div>
          <p className="result-sub">
            شكراً لمشاركتك! يمكنك المحاولة في الجولات القادمة.
          </p>
          <button
            className="btn-primary"
            onClick={handleReset}
            style={{ marginTop: '30px' }}
          >
            العودة
          </button>
        </div>
      )}

      {/* ── FORFEITED ── */}
      {status === 'forfeited' && (
        <div className="result-container result-lost-card" style={{ borderColor: 'var(--danger-color)' }}>
          <div className="result-emoji">🚫</div>
          <div className="result-title result-lost" style={{ color: 'var(--danger-color)' }}>
            انت طلعت من الموقع
          </div>
          <p className="result-sub">
            لقد قمت بمغادرة الصفحة أو التبديل لتطبيق آخر أثناء تشغيل المؤقت، مما أدى إلى إلغاء مشاركتك.<br />
            حظ أوفر المرة القادمة.
          </p>
          <button
            className="btn-primary"
            onClick={handleReset}
            style={{ marginTop: '30px' }}
          >
            العودة
          </button>
        </div>
      )}
    </div>
  );
};

export default Coupons;
