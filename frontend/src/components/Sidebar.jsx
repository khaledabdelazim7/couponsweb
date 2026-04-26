import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <>
      <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
        {isOpen ? '✕' : '☰'}
      </button>
      <aside className={`sidebar ${isOpen ? '' : 'closed'}`}>
        <div className="logo-container">
          <img src="/logo.png" alt="Borjoun Logo" className="sidebar-logo" />
        </div>
        
        <ul className="nav-links">
          <li>
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              الرئيسية
            </NavLink>
          </li>
          <li>
            <NavLink to="/coupons" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              كوبونات
            </NavLink>
          </li>
          {/* Add more nav items as needed */}
        </ul>
      </aside>
    </>
  );
};

export default Sidebar;
