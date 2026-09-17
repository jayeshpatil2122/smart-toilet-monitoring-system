import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { IconMapPin, IconClock, IconChevronRight } from './Icons';

const ComplaintCard = ({ complaint }) => {
  const navigate = useNavigate();
  const taskType = complaint.isAlert ? 'SANITATION ALERT' : 'COMPLAINT';

  return (
    <div 
      onClick={() => navigate(`/complaint/${complaint.id}`)}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '14px',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'border-color 0.15s ease',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <StatusBadge taskType={taskType} />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669', letterSpacing: '0.5px' }}>
              #{complaint.id}
            </span>
          </div>
          <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
            {complaint.title}
          </h3>
        </div>
        <StatusBadge priority={complaint.priority} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px', marginBottom: '6px' }}>
        <IconMapPin size={16} color="#059669" />
        <span style={{ fontWeight: '600' }}>{complaint.toilet}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', marginBottom: '14px' }}>
        <IconClock size={14} color="#64748b" />
        <span>Assigned: {complaint.assignedDate}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
        <StatusBadge status={complaint.status} />
        <button 
          type="button"
          style={{
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          View Task
          <IconChevronRight size={14} color="#ffffff" />
        </button>
      </div>
    </div>
  );
};

export default ComplaintCard;
