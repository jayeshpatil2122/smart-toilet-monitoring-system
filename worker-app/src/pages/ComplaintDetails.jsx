import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { IconArrowLeft, IconMapPin, IconClock, IconNavigation, IconWrench, IconCheckCircle } from '../components/Icons';

const ComplaintDetails = ({ complaints, onUpdateStatus }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const complaint = complaints.find(c => String(c.id) === String(id)) || complaints[0];

  if (!complaint) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#1e293b', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <h2 style={{ color: '#0f172a' }}>Complaint Not Found</h2>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleNavigate = () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${complaint.latitude},${complaint.longitude}`;
    window.open(mapsUrl, '_blank');
  };

  const handleAcceptTask = () => {
    if (onUpdateStatus) {
      onUpdateStatus(complaint.id, 'ACCEPTED');
    }
  };

  const handleStartWork = () => {
    if (onUpdateStatus) {
      onUpdateStatus(complaint.id, 'IN_PROGRESS');
    }
  };

  return (
    <div style={{ paddingBottom: '90px', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      {/* Header Bar */}
      <header style={{
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          <IconArrowLeft size={20} />
        </button>
        <div>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', letterSpacing: '0.5px' }}>
            COMPLAINT DETAILS
          </span>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
            Complaint #{complaint.id}
          </h1>
        </div>
      </header>

      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Title & Status */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <StatusBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
            {complaint.title}
          </h2>

          <div style={{ fontSize: '13px', color: '#059669', fontWeight: '600', marginBottom: '4px' }}>
            Category: {complaint.category}
          </div>
        </div>

        {/* Image Preview */}
        {complaint.image && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
              REPORTED ISSUE IMAGE (BEFORE)
            </label>
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <img 
                src={complaint.image} 
                alt="Complaint evidence" 
                style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Solved Image Preview if completed */}
        {(complaint.status === 'COMPLETED' || complaint.status === 'Resolved') && complaint.afterImage && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#059669', marginBottom: '6px' }}>
              WORK SOLVED PROOF (AFTER) ✓
            </label>
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '2px solid #10b981', backgroundColor: '#ffffff' }}>
              <img 
                src={complaint.afterImage} 
                alt="Solved evidence" 
                style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Details List Card */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px' }}>
              DESCRIPTION
            </label>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
              {complaint.description}
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '14px 0' }} />

          {/* Toilet Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px' }}>
              TOILET FACILITY
            </label>
            <p style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              {complaint.toilet}
            </p>
          </div>

          {/* Location */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px' }}>
              LOCATION
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <IconMapPin size={16} color="#10b981" />
              <span style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>{complaint.location}</span>
            </div>
          </div>

          {/* Assigned Date */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px' }}>
              ASSIGNED TIMESTAMP
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <IconClock size={16} color="#64748b" />
              <span style={{ fontSize: '13px', color: '#64748b' }}>{complaint.assignedDate}</span>
            </div>
          </div>

          {complaint.remarks && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '14px 0' }} />
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#059669', letterSpacing: '0.5px' }}>
                  WORK REMARKS
                </label>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#334155' }}>
                  {complaint.remarks}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Navigate Button */}
          <button
            onClick={handleNavigate}
            style={{
              backgroundColor: '#ffffff',
              color: '#059669',
              border: '1.5px solid #10b981',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <IconNavigation size={18} color="#059669" />
            📍 NAVIGATE TO LOCATION
          </button>

          {/* Status Action Buttons */}
          {(() => {
            const currentStatus = (complaint?.status || '').toUpperCase().replace(/\s+/g, '_');
            const isAssigned = currentStatus === 'ASSIGNED' || currentStatus === 'PENDING';
            const isAccepted = currentStatus === 'ACCEPTED';
            const isInProgress = currentStatus === 'IN_PROGRESS';
            const isCompleted = currentStatus === 'COMPLETED' || currentStatus === 'RESOLVED';

            if (isCompleted) return null;

            return (
              <>
                {isAssigned && (
                  <button
                    onClick={handleAcceptTask}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
                    }}
                  >
                    [Accept Task]
                  </button>
                )}

                {isAccepted && (
                  <button
                    onClick={handleStartWork}
                    style={{
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(217, 119, 6, 0.2)'
                    }}
                  >
                    <IconWrench size={18} color="#ffffff" />
                    [Start Task]
                  </button>
                )}

                {(isInProgress || isAccepted || isAssigned) && (
                  <button
                    onClick={() => navigate(`/complaint/${complaint.id}/resolve`)}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <IconCheckCircle size={18} color="#ffffff" />
                    [Mark Completed]
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
};

export default ComplaintDetails;

