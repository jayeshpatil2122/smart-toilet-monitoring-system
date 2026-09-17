import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { IconCheckCircle, IconMapPin, IconClock } from '../components/Icons';

const CompletedComplaints = ({ complaints }) => {
  const navigate = useNavigate();

  const completedList = complaints.filter(c => {
    const s = (c?.status || '').toUpperCase().replace(/\s+/g, '_');
    return s === 'COMPLETED' || s === 'RESOLVED';
  });

  return (
    <div style={{ paddingBottom: '90px', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      <header style={{
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconCheckCircle size={22} color="#10b981" />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
            Completed Work Logs
          </h1>
        </div>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
          History of resolved sanitation complaints
        </p>
      </header>

      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {completedList.length > 0 ? (
          completedList.map(complaint => (
            <div
              key={complaint.id}
              onClick={() => navigate(`/complaint/${complaint.id}`)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #10b981',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'transform 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>
                  #{complaint.id} • RESOLVED
                </span>
                <StatusBadge status="COMPLETED" />
              </div>

              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                {complaint.title}
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px', marginBottom: '6px' }}>
                <IconMapPin size={15} color="#10b981" />
                <span>{complaint.toilet}</span>
              </div>

              {complaint.completedDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', marginBottom: '10px' }}>
                  <IconClock size={14} color="#64748b" />
                  <span>Resolved on: {complaint.completedDate}</span>
                </div>
              )}

              {complaint.remarks && (
                <div style={{
                  backgroundColor: '#f1f5f9',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#334155',
                  borderLeft: '3px solid #10b981'
                }}>
                  "{complaint.remarks}"
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <IconCheckCircle size={36} color="#94a3b8" />
            <p style={{ marginTop: '12px', fontSize: '15px', fontWeight: '600', color: '#475569' }}>
              No completed tasks yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CompletedComplaints;

