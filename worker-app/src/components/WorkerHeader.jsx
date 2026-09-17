import React from 'react';
import { IconBell } from './Icons';

const WorkerHeader = ({ workerName = "Rajesh Kumar", assignedArea = "General Area", onNotificationClick }) => {
  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      padding: '14px 20px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: '#059669', textTransform: 'uppercase' }}>
              SANITRAX WORKER PORTAL
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#047857',
              backgroundColor: '#ecfdf5',
              padding: '2px 8px',
              borderRadius: '999px',
              border: '1px solid #a7f3d0'
            }}>
              🟢 Active
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            {workerName}
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            Area: {assignedArea}
          </p>
        </div>

        <button 
          onClick={onNotificationClick || (() => alert('Notification: Check your assigned complaint tasks below.'))}
          style={{
            position: 'relative',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f172a',
            cursor: 'pointer'
          }}
          aria-label="Notifications"
        >
          <IconBell size={20} color="#059669" />
        </button>
      </div>
    </header>
  );
};

export default WorkerHeader;
