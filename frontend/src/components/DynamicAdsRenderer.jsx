import React, { useEffect, useRef, useState } from 'react';

const API_URL = 'https://couponsweb-production.up.railway.app/api';

const DynamicAdItem = ({ ad }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Track view
    fetch(`${API_URL}/dynamic-ads/${ad.id}/view`, { method: 'POST' }).catch(() => {});

    if (ad.htmlCode && containerRef.current) {
      // Execute scripts inside the HTML
      const slotHtml = document.createRange().createContextualFragment(ad.htmlCode);
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(slotHtml);
    }
  }, [ad]);

  const handleClick = () => {
    fetch(`${API_URL}/dynamic-ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
    if (ad.targetLink) {
      window.open(ad.targetLink, '_blank');
    }
  };

  if (ad.htmlCode) {
    return (
      <div 
        className="dynamic-ad-container" 
        ref={containerRef}
        onClick={ad.targetLink ? handleClick : undefined}
        style={{ cursor: ad.targetLink ? 'pointer' : 'default', margin: '20px 0', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}
      />
    );
  }

  if (ad.targetLink && ad.title) {
    return (
      <div 
        className="dynamic-ad-container text-ad"
        onClick={handleClick}
        style={{ 
          cursor: 'pointer', margin: '20px 0', padding: '15px', 
          border: '2px solid var(--accent-color)', borderRadius: '10px', 
          textAlign: 'center', backgroundColor: 'var(--sidebar-bg)' 
        }}
      >
        <h3 style={{ margin: 0, color: 'var(--accent-color)' }}>{ad.title}</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '5px 0 0' }}>إعلان ممول</p>
      </div>
    );
  }

  return null;
};

const DynamicAdsRenderer = ({ placement }) => {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/dynamic-ads?placement=${encodeURIComponent(placement)}`)
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) setAds(data);
      })
      .catch(() => {});
  }, [placement]);

  if (ads.length === 0) return null;

  return (
    <div className="dynamic-ads-wrapper">
      {ads.map(ad => (
        <DynamicAdItem key={ad.id} ad={ad} />
      ))}
    </div>
  );
};

export default DynamicAdsRenderer;
