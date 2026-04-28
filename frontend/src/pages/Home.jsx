import React from 'react';
import DynamicAdsRenderer from '../components/DynamicAdsRenderer';

const Home = ({ activeUsers }) => {
  return (
    <div className="home-page">
      <DynamicAdsRenderer placement="Homepage" />
      <h1 className="hero-heading">من أين نبدأ؟</h1>
      <p style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', maxWidth: '600px' }}>
        نحن هنا لنقدم لك أفضل تجربة للحصول على أحدث الكوبونات والعروض الحصرية. تصميم عصري وبسيط يضع احتياجاتك في المقام الأول.
      </p>
      
      <div>
        <div className="live-counter">
          <div className="live-dot"></div>
          عدد المستخدمين الحاليين: {activeUsers}
        </div>
      </div>
    </div>
  );
};

export default Home;
