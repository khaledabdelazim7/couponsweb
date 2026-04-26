import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { io } from 'socket.io-client';

import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Coupons from './pages/Coupons';

// In production, this should be your backend URL.
// For development, assuming backend runs on 3001
const SOCKET_URL = 'https://couponsweb-production.up.railway.app';

function App() {
  const [activeUsers, setActiveUsers] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
    });

    socket.on('activeUsers', (count) => {
      setActiveUsers(count);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Router>
      <div className={`app-container ${isSidebarOpen ? '' : 'sidebar-closed'}`}>
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home activeUsers={activeUsers} />} />
            <Route path="/coupons" element={<Coupons />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
