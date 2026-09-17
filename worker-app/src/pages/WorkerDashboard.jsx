import React, { useState } from 'react';
import WorkerHeader from '../components/WorkerHeader';
import StatCard from '../components/StatCard';
import ComplaintCard from '../components/ComplaintCard';
import { getStats } from '../utils/mockData';
import { IconList, IconClock, IconWrench, IconCheckCircle } from '../components/Icons';

const WorkerDashboard = ({ complaints = [], worker = {}, notificationBanner, onRefresh }) => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const stats = getStats(complaints);

  const filteredComplaints = complaints.filter(complaint => {
    const status = (complaint?.status || '').toUpperCase().replace(/\s+/g, '_');
    if (activeFilter === 'ALL') return status !== 'COMPLETED' && status !== 'RESOLVED';
    if (activeFilter === 'ASSIGNED') return status === 'ASSIGNED' || status === 'ACCEPTED' || status === 'PENDING';
    if (activeFilter === 'PENDING') return status === 'PENDING' || status === 'ASSIGNED';
    if (activeFilter === 'IN_PROGRESS') return status === 'IN_PROGRESS' || status === 'ACCEPTED';
    return true;
  });

  return (
    <div style={{ paddingBottom: '90px', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <WorkerHeader 
        workerName={worker.name || worker.username || "Field Worker"} 
        assignedArea={worker.assigned_area || worker.zone || "General Area"}
        onNotificationClick={onRefresh}
      />

      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Notification Toast Banner */}
        {notificationBanner && (
          <div style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '700',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔔</span> {notificationBanner}
            </div>
            <button 
              onClick={onRefresh}
              style={{ background: 'none', border: 'none', color: '#047857', fontWeight: '800', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              Refresh
            </button>
          </div>
        )}

        {/* Statistics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <StatCard 
            title="Assigned" 
            count={stats.assigned} 
            color="#059669" 
            icon={IconList}
            active={activeFilter === 'ASSIGNED'}
            onClick={() => setActiveFilter(activeFilter === 'ASSIGNED' ? 'ALL' : 'ASSIGNED')}
          />
          <StatCard 
            title="Pending" 
            count={stats.pending} 
            color="#d97706" 
            icon={IconClock}
            active={activeFilter === 'PENDING'}
            onClick={() => setActiveFilter(activeFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          />
          <StatCard 
            title="In Progress" 
            count={stats.inProgress} 
            color="#2563eb" 
            icon={IconWrench}
            active={activeFilter === 'IN_PROGRESS'}
            onClick={() => setActiveFilter(activeFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          />
          <StatCard 
            title="Completed" 
            count={stats.completed} 
            color="#16a34a" 
            icon={IconCheckCircle}
          />
        </div>

        {/* Section Title & Filter Chips */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
            Assigned Complaint Tasks
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>
            {filteredComplaints.length} Tasks
          </span>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'ALL', label: 'All Active' },
            { id: 'ASSIGNED', label: 'Assigned' },
            { id: 'IN_PROGRESS', label: 'In Progress' }
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              style={{
                backgroundColor: activeFilter === chip.id ? '#059669' : '#ffffff',
                color: activeFilter === chip.id ? '#ffffff' : '#64748b',
                border: `1px solid ${activeFilter === chip.id ? '#059669' : '#cbd5e1'}`,
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Complaint Cards List */}
        {filteredComplaints.length > 0 ? (
          filteredComplaints.map(complaint => (
            <ComplaintCard key={complaint.id} complaint={complaint} />
          ))
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <IconCheckCircle size={36} color="#059669" />
            <p style={{ marginTop: '12px', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              No active tasks found
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              All assigned complaints for this view are completed or up to date.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default WorkerDashboard;
