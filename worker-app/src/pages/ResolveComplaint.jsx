import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import { IconArrowLeft, IconCheckCircle } from '../components/Icons';

const ResolveComplaint = ({ complaints, onResolveComplaint }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const complaint = complaints.find(c => String(c.id) === String(id)) || complaints[0];

  const [afterImageFile, setAfterImageFile] = useState(null);
  const [afterImagePreview, setAfterImagePreview] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageSelected = (file, url) => {
    setAfterImageFile(file);
    setAfterImagePreview(url);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!afterImageFile && !afterImagePreview) {
      setError('Please capture or upload a solved proof photo before submitting.');
      return;
    }

    if (!remarks.trim()) {
      setError('Please provide work remarks detailing how the issue was resolved.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (onResolveComplaint) {
        await onResolveComplaint(complaint.id, {
          fileObj: afterImageFile,
          afterImage: afterImagePreview || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=600&q=80',
          remarks: remarks.trim(),
          completedDate: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
      }
      navigate('/completed');
    } catch (err) {
      console.error('Resolve error:', err);
      setError('Failed to submit resolution. Please try again.');
    } finally {
      setIsSubmitting(false);
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
            WORK RESOLUTION
          </span>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
            Resolve Complaint #{complaint.id}
          </h1>
        </div>
      </header>

      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          {/* Complaint Info Overview */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: '700' }}>
              {complaint.toilet}
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              {complaint.title}
            </h3>
          </div>

          {/* Before Image */}
          {complaint.image && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
                BEFORE IMAGE (CITIZEN REPORT)
              </label>
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <img 
                  src={complaint.image} 
                  alt="Before" 
                  style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} 
                />
              </div>
            </div>
          )}

          {/* Solved / After Image Uploader */}
          <ImageUploader 
            label="AFTER / SOLVED PROOF IMAGE" 
            onImageSelected={handleImageSelected} 
          />

          {/* Work Remarks */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
              WORK REMARKS & ACTIONS TAKEN
            </label>
            <textarea
              rows="4"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="E.g. Cleaned floor with disinfectant, replaced trash liner, restored water valve flow."
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '14px',
                color: '#1e293b',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '18px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: isSubmitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
            }}
          >
            <IconCheckCircle size={20} color="#ffffff" />
            {isSubmitting ? 'SUBMITTING PROOF...' : '[Mark Completed]'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default ResolveComplaint;

