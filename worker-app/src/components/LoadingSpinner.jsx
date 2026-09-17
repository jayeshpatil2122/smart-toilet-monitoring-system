import React from 'react';

const LoadingSpinner = ({ message = "Loading Worker Portal..." }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: '#94a3b8'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #334155',
        borderTop: '3px solid #0EA5E9',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '16px'
      }} />
      <span style={{ fontSize: '14px', fontWeight: '500' }}>{message}</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
