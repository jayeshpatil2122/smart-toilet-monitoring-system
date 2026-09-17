import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMapPin, IconClock, IconLogOut } from '../components/Icons';

const WorkerProfile = ({ worker = {}, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate('/login');
  };

  const name = worker.full_name || worker.name || worker.username || "Field Worker";
  const role = worker.role || "Sanitation Staff";
  const empId = worker.employee_id || worker.id || "N/A";
  const area = worker.assigned_area || worker.zone || "General Municipal Area";
  const phone = worker.phone_number || worker.phone || "N/A";
  const email = worker.email || "N/A";

  return (
    <div style={{ paddingBottom: '90px', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      <header style={{
        padding: '14px 20px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
          Worker Profile & Account
        </h1>
      </header>

      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Profile Card */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#ecfdf5',
            border: '2px solid #059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            fontSize: '28px'
          }}>
            👷‍♂️
          </div>

          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
            {name}
          </h2>
          <p style={{ margin: '4px 0 10px 0', fontSize: '13px', color: '#059669', fontWeight: '700' }}>
            {role}
          </p>

          <span style={{
            backgroundColor: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            Employee ID: {empId}
          </span>
        </div>

        {/* Details List */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>ASSIGNED AREA / ZONE</span>
            <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{area}</p>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>CONTACT PHONE</span>
            <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{phone}</p>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>OFFICIAL EMAIL</span>
            <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{email}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>ACCOUNT STATUS</span>
              <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '800', color: '#059669' }}>Active Field Officer</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            borderRadius: '12px',
            padding: '13px',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <IconLogOut size={18} color="#b91c1c" />
          LOG OUT OF WORKER PORTAL
        </button>
      </main>
    </div>
  );
};

export default WorkerProfile;
