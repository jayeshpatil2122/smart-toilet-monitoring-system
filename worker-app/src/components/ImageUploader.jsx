import React, { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IconCamera } from './Icons';

const ImageUploader = ({ label = "Live Solved / After Image Proof", onImageSelected }) => {
  const [preview, setPreview] = useState(null);

  const convertBase64ToFile = (base64Data, fileName = 'solved_proof.jpg') => {
    const arr = base64Data.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr.length > 1 ? arr[1] : arr[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mime });
  };

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image && image.dataUrl) {
        const fileObj = convertBase64ToFile(image.dataUrl, `solved_proof_${Date.now()}.${image.format || 'jpg'}`);
        setPreview(image.dataUrl);
        if (onImageSelected) {
          onImageSelected(fileObj, image.dataUrl);
        }
      }
    } catch (err) {
      console.warn('Live camera capture notice:', err);
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
        {label}
      </label>

      {preview ? (
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '2px solid #10b981' }}>
          <img 
            src={preview} 
            alt="Live Camera Preview" 
            style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} 
          />
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: '#34d399', fontSize: '12px', fontWeight: '600' }}>✓ Live Photo Captured</span>
            <button
              type="button"
              onClick={takePhoto}
              style={{
                backgroundColor: '#334155',
                color: '#f8fafc',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                border: 'none'
              }}
            >
              Retake Photo
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={takePhoto}
          style={{
            border: '2px dashed #334155',
            borderRadius: '16px',
            padding: '30px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e293b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#0EA5E920',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <IconCamera size={24} color="#0EA5E9" />
          </div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>
            Tap to Open Live Camera
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Live Camera Photo Required (Gallery Disabled)
          </span>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
