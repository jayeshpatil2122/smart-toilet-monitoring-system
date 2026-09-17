import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IconHome, IconList, IconCheckCircle, IconUser } from './Icons';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide bottom nav on login page
  if (location.pathname === '/login') return null;

  const navItems = [
    { label: 'Home', path: '/dashboard', icon: IconHome },
    { label: 'Complaints', path: '/complaints', icon: IconList },
    { label: 'Completed', path: '/completed', icon: IconCheckCircle },
    { label: 'Profile', path: '/profile', icon: IconUser }
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ffffff',
      borderTop: '1px solid #e2e8f0',
      padding: '8px 12px 12px 12px',
      display: 'flex',
      justify: 'space-around',
      alignItems: 'center',
      zIndex: 1000,
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
    }}>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || 
                         (item.path === '/dashboard' && location.pathname === '/');
        const Icon = item.icon;
        
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              color: isActive ? '#059669' : '#64748b',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '12px',
              transition: 'all 0.2s ease',
              width: '25%'
            }}
          >
            <Icon size={22} color={isActive ? '#059669' : '#64748b'} />
            <span style={{
              fontSize: '11px',
              fontWeight: isActive ? '800' : '600',
              letterSpacing: '0.2px'
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavigation;
