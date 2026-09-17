import React from 'react';

const StatCard = ({ title, count, color = '#059669', icon: Icon, onClick, active }) => {
  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: active ? '#f0fdf4' : '#ffffff',
        border: `1px solid ${active ? '#059669' : '#e2e8f0'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        boxShadow: active ? '0 2px 4px rgba(5, 150, 105, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        {Icon && <Icon size={18} color={color} />}
      </div>

      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
        {String(count).padStart(2, '0')}
      </div>
    </div>
  );
};

export default StatCard;
