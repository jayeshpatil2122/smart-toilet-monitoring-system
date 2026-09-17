import React from 'react';

const StatusBadge = ({ status, priority, taskType }) => {
  if (taskType) {
    const isAlert = taskType === 'SANITATION ALERT';
    return (
      <span style={{
        backgroundColor: isAlert ? '#fff7ed' : '#eff6ff',
        color: isAlert ? '#c2410c' : '#1d4ed8',
        border: `1px solid ${isAlert ? '#ffedd5' : '#bfdbfe'}`,
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        display: 'inline-block'
      }}>
        {taskType}
      </span>
    );
  }

  if (priority) {
    const priorityStyles = {
      HIGH: { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' },
      MEDIUM: { bg: '#fffbe5', color: '#b45309', border: '#fde68a' },
      LOW: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
    };
    const style = priorityStyles[priority] || priorityStyles.MEDIUM;
    return (
      <span style={{
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        display: 'inline-block'
      }}>
        Priority: {priority}
      </span>
    );
  }

  const statusStyles = {
    ASSIGNED: { bg: '#fffbe5', color: '#b45309', border: '#fde68a', label: 'ASSIGNED' },
    ACCEPTED: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: 'ACCEPTED' },
    PENDING: { bg: '#fffbe5', color: '#b45309', border: '#fde68a', label: 'PENDING' },
    IN_PROGRESS: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', label: 'IN PROGRESS' },
    COMPLETED: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'COMPLETED ✓' }
  };

  const normalizedKey = status ? String(status).toUpperCase().replace(/\s+/g, '_') : 'ASSIGNED';
  const style = statusStyles[normalizedKey] || (normalizedKey === 'RESOLVED' ? statusStyles.COMPLETED : statusStyles.ASSIGNED);

  return (
    <span style={{
      backgroundColor: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      {style.label}
    </span>
  );
};

export default StatusBadge;
