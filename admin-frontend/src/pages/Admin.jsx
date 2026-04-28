import React, { useState, useEffect, useRef } from 'react';

const API_URL = 'https://couponsweb-production.up.railway.app/api/admin';
const BASE_URL = 'https://couponsweb-production.up.railway.app';

const Admin = () => {
  const [settings, setSettings] = useState({
    timerDuration: 60,
    maxCouponValue: 200,
    dailyLimit: 2,
    couponSystemEnabled: true,
    winnersPerDay: 5,
    couponValue: 50
  });
  const [round, setRound] = useState(null);
  const [entries, setEntries] = useState([]);
  const [ads, setAds] = useState([]);
  const [historyRounds, setHistoryRounds] = useState([]);
  const [dynamicAds, setDynamicAds] = useState([]);
  const [dynamicAdForm, setDynamicAdForm] = useState({ title: '', htmlCode: '', targetLink: '', placement: 'Both', isActive: true, startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [adImage, setAdImage] = useState(null);
  const [adCaption, setAdCaption] = useState('');
  const [adPreviewUrl, setAdPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchDrawData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    try {
      const headers = getHeaders();
      const [settingsRes, drawRes, adRes, historyRes, dynamicAdsRes] = await Promise.all([
        fetch(`${API_URL}/settings`, { headers }),
        fetch(`${API_URL}/draw`, { headers }),
        fetch(`${API_URL}/advertisement`, { headers }),
        fetch(`${API_URL}/history`, { headers }),
        fetch(`${API_URL}/dynamic-ads`, { headers })
      ]);
      const s = await settingsRes.json();
      const d = await drawRes.json();
      const a = await adRes.json();
      const h = await historyRes.json();
      const da = await dynamicAdsRes.json();

      if (s) setSettings(s);
      if (d) { setRound(d.round); setEntries(d.entries || []); }
      if (Array.isArray(a)) setAds(a);
      if (Array.isArray(h)) setHistoryRounds(h);
      if (Array.isArray(da)) setDynamicAds(da);
    } catch (err) {
      console.error('Error fetching admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrawData = async () => {
    try {
      const res = await fetch(`${API_URL}/draw`, { headers: getHeaders() });
      const d = await res.json();
      if (d) { setRound(d.round); setEntries(d.entries || []); }
    } catch (_) {}
  };

  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify(settings)
      });
      showToast('تم حفظ الإعدادات بنجاح ✅');
    } catch {
      showToast('حدث خطأ أثناء حفظ الإعدادات', 'error');
    }
  };



  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAdImage(file);
      setAdPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadAd = async () => {
    if (!adImage) return showToast('الرجاء اختيار صورة', 'error');
    if (!adCaption.trim()) return showToast('الرجاء إدخال وصف الإعلان', 'error');
    const formData = new FormData();
    formData.append('image', adImage);
    formData.append('caption', adCaption);
    try {
      const res = await fetch(`${API_URL}/advertisement`, {
        method: 'POST',
        headers: getHeaders(),
        body: formData
      });
      const data = await res.json();
      if (data.error) showToast(data.error, 'error');
      else {
        showToast('تم رفع الإعلان بنجاح ✅');
        setAds(prev => [...prev, data.ad]);
        setAdImage(null);
        setAdPreviewUrl(null);
        setAdCaption('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch {
      showToast('حدث خطأ أثناء رفع الإعلان', 'error');
    }
  };

  const removeAd = async (adId) => {
    if (!window.confirm('هل تريد حذف الإعلان؟')) return;
    try {
      await fetch(`${API_URL}/advertisement/${adId}`, {
        method: 'DELETE', headers: getHeaders()
      });
      setAds(prev => prev.filter(a => a.id !== adId));
      showToast('تم حذف الإعلان ✅');
    } catch {
      showToast('حدث خطأ أثناء حذف الإعلان', 'error');
    }
  };

  const handleDynamicAdFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDynamicAdForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const createDynamicAd = async () => {
    try {
      const res = await fetch(`${API_URL}/dynamic-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify(dynamicAdForm)
      });
      const data = await res.json();
      if (data.error) showToast(data.error, 'error');
      else {
        showToast('تم إضافة الإعلان بنجاح ✅');
        setDynamicAds(prev => [data.ad, ...prev]);
        setDynamicAdForm({ title: '', htmlCode: '', targetLink: '', placement: 'Both', isActive: true, startDate: '', endDate: '' });
      }
    } catch {
      showToast('حدث خطأ أثناء إضافة الإعلان', 'error');
    }
  };

  const toggleDynamicAdStatus = async (ad) => {
    try {
      const res = await fetch(`${API_URL}/dynamic-ads/${ad.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ ...ad, isActive: !ad.isActive })
      });
      const data = await res.json();
      if (!data.error) {
         setDynamicAds(prev => prev.map(a => a.id === ad.id ? data.ad : a));
         showToast('تم تغيير حالة الإعلان ✅');
      }
    } catch {
      showToast('حدث خطأ', 'error');
    }
  };

  const removeDynamicAd = async (adId) => {
    if (!window.confirm('هل تريد حذف هذا الإعلان الديناميكي؟')) return;
    try {
      await fetch(`${API_URL}/dynamic-ads/${adId}`, { method: 'DELETE', headers: getHeaders() });
      setDynamicAds(prev => prev.filter(a => a.id !== adId));
      showToast('تم حذف الإعلان ✅');
    } catch {
      showToast('حدث خطأ', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/login';
  };

  if (loading) return (
    <div className="admin-loading">
      <div className="admin-spinner"></div>
      <span>جارٍ التحميل...</span>
    </div>
  );

  const winnersCount = entries.filter(e => e.isWinner).length;
  const drawDone = winnersCount > 0;

  return (
    <div className="admin-page">
      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type === 'error' ? 'admin-toast-error' : ''}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="admin-header">
        <h1 className="page-title">لوحة التحكم</h1>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--danger-color)' }}
          onClick={handleLogout}
        >
          تسجيل خروج
        </button>
      </div>

      {/* ── SECTION 1: Settings + Stats ── */}
      <div className="admin-grid">
        {/* Settings */}
        <div className="admin-card">
          <h3>⚙️ إعدادات النظام</h3>
          <div className="admin-form-group">
            <label>مدة الانتظار (بالثواني)</label>
            <input type="number" name="timerDuration" className="admin-input" value={settings.timerDuration} onChange={handleSettingChange} />
          </div>
          <div className="admin-form-group">
            <label>الحد الأقصى لقيمة الكوبون ($)</label>
            <input type="number" name="maxCouponValue" className="admin-input" value={settings.maxCouponValue} onChange={handleSettingChange} />
          </div>
          <div className="admin-form-group">
            <label>الحد اليومي المسموح للمستخدم</label>
            <input type="number" name="dailyLimit" className="admin-input" value={settings.dailyLimit} onChange={handleSettingChange} />
          </div>
          <div className="admin-form-group">
            <label>عدد الفائزين باليوم</label>
            <input type="number" name="winnersPerDay" className="admin-input" value={settings.winnersPerDay} onChange={handleSettingChange} />
          </div>
          <div className="admin-form-group">
            <label>قيمة الكوبون ($)</label>
            <input type="number" name="couponValue" className="admin-input" value={settings.couponValue} onChange={handleSettingChange} />
          </div>
          <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" name="couponSystemEnabled" id="couponSystemEnabled" checked={settings.couponSystemEnabled} onChange={handleSettingChange} style={{ width: '20px', height: '20px' }} />
            <label htmlFor="couponSystemEnabled" style={{ margin: 0 }}>تفعيل نظام الكوبونات</label>
          </div>
          <button className="btn-primary" style={{ padding: '12px', fontSize: '1.1rem' }} onClick={saveSettings}>
            💾 حفظ الإعدادات
          </button>
        </div>

        {/* Stats */}
        <div className="admin-card">
          <h3>📊 إحصائيات الجولة الحالية</h3>
          <div className="stat-item">
            <span className="stat-label">عدد المشتركين</span>
            <span className="stat-value">{entries.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">حالة السحب</span>
            <span className={`stat-badge ${drawDone ? 'badge-done' : 'badge-pending'}`}>
              {drawDone ? `✅ تم سحب ${winnersCount} فائزين` : '⏳ لم يتم بعد'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Draw Management ── */}
      <div className="admin-grid" style={{ marginTop: '0' }}>
        {/* Draw Controls */}
        <div className="admin-card draw-controls-card">
          <h3>🎲 حالة الجولة الحالية</h3>
          <p className="draw-info-text">
            {drawDone
              ? `تم اختيار ${winnersCount} فائزين تلقائياً في هذه الجولة.`
              : `الجولة نشطة — ${entries.length} مشترك حتى الآن.`}
          </p>
          <div style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            ملاحظة: النظام يعمل بشكل أوتوماتيكي بنظام الجولات على مدار 24 ساعة ولا يتطلب أي تدخل يدوي لبدء أو إيقاف الجولات.
          </div>
        </div>

        {/* Participants List */}
        <div className="admin-card">
          <h3>👥 المشتركون ({entries.length})</h3>
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {entries.length === 0 ? (
              <div className="empty-state">لا يوجد مشتركون بعد في هذه الجولة</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>رقم الهاتف</th>
                    <th>وقت التسجيل</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={entry.id} className={entry.isWinner ? 'winner-row' : ''}>
                      <td>{idx + 1}</td>
                      <td dir="ltr" style={{ textAlign: 'right' }}>{entry.phone}</td>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(entry.createdAt).toLocaleString('ar-EG')}</td>
                      <td>{entry.status === 'WAITING' ? 'قيد الانتظار' : (entry.isWinner ? 'كسب' : 'خسر')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Advertisement Manager ── */}
      <div className="admin-full-card">
        <h3>🖼️ إدارة الإعلانات</h3>
        <div className="ad-manager-grid">
          {/* Upload Form */}
          <div className="ad-upload-section">
            <div className="admin-form-group">
              <label>اختر صورة الإعلان</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="admin-input file-input"
                onChange={handleImageChange}
                id="ad-file-input"
              />
            </div>
            <div className="admin-form-group">
              <label>وصف / نص الإعلان</label>
              <input
                type="text"
                className="admin-input"
                placeholder="مثال: عروض حصرية على جميع المنتجات..."
                value={adCaption}
                onChange={(e) => setAdCaption(e.target.value)}
              />
            </div>
            <div className="ad-action-btns">
              <button className="btn-primary" style={{ padding: '12px 24px' }} onClick={uploadAd}>
                📤 رفع الإعلان
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="ad-preview-section">
            <div className="ad-preview-label">الإعلانات النشطة ({ads.length})</div>
            <div className="ads-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {ads.length > 0 ? ads.map(a => (
                <div key={a.id} className="ad-preview-box" style={{ position: 'relative' }}>
                  <img
                    src={`${BASE_URL}${a.imageUrl}`}
                    alt="إعلان"
                    className="ad-preview-img"
                  />
                  <p className="ad-preview-caption">{a.caption}</p>
                  <button
                    className="btn-primary"
                    style={{ position: 'absolute', top: 10, left: 10, padding: '6px 12px', fontSize: '0.9rem', width: 'auto', backgroundColor: 'var(--danger-color)' }}
                    onClick={() => removeAd(a.id)}
                  >
                    🗑️
                  </button>
                </div>
              )) : (
                <div className="ad-preview-empty">
                  <span>🖼️</span>
                  <p>لا توجد إعلانات نشطة حالياً</p>
                </div>
              )}
            </div>

            {adPreviewUrl && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <div className="ad-preview-label">معاينة الصورة الجديدة</div>
                <div className="ad-preview-box">
                  <img src={adPreviewUrl} alt="معاينة" className="ad-preview-img" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3.5: Dynamic Ads Manager ── */}
      <div className="admin-full-card" style={{ marginTop: '30px' }}>
        <h3>🚀 إدارة الإعلانات الديناميكية (أكواد وروابط)</h3>
        <div className="ad-manager-grid">
          {/* Create Form */}
          <div className="ad-upload-section">
            <div className="admin-form-group">
              <label>العنوان (اختياري)</label>
              <input type="text" name="title" className="admin-input" value={dynamicAdForm.title} onChange={handleDynamicAdFormChange} />
            </div>
            <div className="admin-form-group">
              <label>كود HTML / سكريبت (لشبكات الإعلانات)</label>
              <textarea name="htmlCode" className="admin-input" style={{ minHeight: '100px', resize: 'vertical', direction: 'ltr' }} value={dynamicAdForm.htmlCode} onChange={handleDynamicAdFormChange} placeholder="<script>...</script>" />
            </div>
            <div className="admin-form-group">
              <label>الرابط المستهدف (إذا لم يكن كود HTML)</label>
              <input type="text" name="targetLink" className="admin-input" style={{ direction: 'ltr' }} value={dynamicAdForm.targetLink} onChange={handleDynamicAdFormChange} placeholder="https://example.com" />
            </div>
            <div className="admin-form-group">
              <label>أماكن الظهور</label>
              <select name="placement" className="admin-input" value={dynamicAdForm.placement} onChange={handleDynamicAdFormChange}>
                <option value="Both">الكل (الصفحة الرئيسية + الكوبونات)</option>
                <option value="Homepage">الصفحة الرئيسية فقط</option>
                <option value="Coupons Page">صفحة الكوبونات فقط</option>
              </select>
            </div>
            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" name="isActive" id="dyn-isActive" checked={dynamicAdForm.isActive} onChange={handleDynamicAdFormChange} style={{ width: '20px', height: '20px' }} />
              <label htmlFor="dyn-isActive" style={{ margin: 0 }}>نشط</label>
            </div>
            <div className="ad-action-btns">
              <button className="btn-primary" style={{ padding: '12px 24px' }} onClick={createDynamicAd}>
                ➕ إضافة الإعلان
              </button>
            </div>
          </div>

          {/* List */}
          <div className="ad-preview-section">
            <div className="ad-preview-label">الإعلانات الديناميكية ({dynamicAds.length})</div>
            <div className="ads-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dynamicAds.length > 0 ? dynamicAds.map(ad => (
                <div key={ad.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '15px', backgroundColor: 'var(--sidebar-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: ad.isActive ? 'var(--text-color)' : 'var(--text-secondary)' }}>
                      {ad.title || 'إعلان بدون عنوان'} 
                      <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-color)', marginRight: '10px' }}>
                        {ad.placement}
                      </span>
                    </h4>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => toggleDynamicAdStatus(ad)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: ad.isActive ? 'var(--text-secondary)' : 'var(--primary-color)', color: '#fff' }}>
                        {ad.isActive ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => removeDynamicAd(ad.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--danger-color)', color: '#fff' }}>
                        حذف
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '15px' }}>
                     <span>مشاهدات: {ad.views}</span>
                     <span>نقرات: {ad.clicks}</span>
                  </div>
                </div>
              )) : (
                <div className="ad-preview-empty">
                   <span>📝</span>
                   <p>لا توجد إعلانات ديناميكية</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: History ── */}
      <div className="admin-full-card" style={{ marginTop: '30px' }}>
        <h3>📜 سجل الجولات السابقة ({historyRounds.length})</h3>
        {historyRounds.length === 0 ? (
          <div className="empty-state">لا يوجد سجلات سابقة</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {historyRounds.map(r => (
              <div key={r.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--sidebar-bg)' }}>
                <h4 style={{ marginBottom: '10px' }}>
                  جولة بدأت في: {new Date(r.cycleStartDate).toLocaleString('ar-EG')} 
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '10px' }}>
                    (المشتركون: {r.entries.length})
                  </span>
                </h4>
                {r.entries.length > 0 && (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>رقم الهاتف</th>
                        <th>وقت التسجيل</th>
                        <th>الحالة</th>
                        <th>الكوبون</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.entries.map(entry => (
                        <tr key={entry.id} className={entry.isWinner ? 'winner-row' : ''}>
                          <td dir="ltr" style={{ textAlign: 'right' }}>{entry.phone}</td>
                          <td style={{ fontSize: '0.85rem' }}>{new Date(entry.createdAt).toLocaleString('ar-EG')}</td>
                          <td>{entry.status === 'WAITING' ? 'قيد الانتظار' : (entry.isWinner ? 'كسب' : 'خسر')}</td>
                          <td dir="ltr">{entry.couponCode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
