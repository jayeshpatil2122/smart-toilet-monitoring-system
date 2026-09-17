import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workerService } from '../services/workerService';
import { IconWrench, IconLock, IconUser, IconEye, IconEyeOff } from '../components/Icons';

const WorkerLogin = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter your Username / Worker ID and Password.');
      return;
    }

    setLoading(true);

    try {
      const data = await workerService.login(username.trim(), password);
      if (onLoginSuccess) onLoginSuccess(data.worker);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      let msg = 'Login failed. Please check backend server or credentials.';
      if (err.response) {
        if (err.response.status === 401) {
          msg = 'Invalid worker credentials.';
        } else if (err.response.status === 403) {
          msg = err.response.data?.detail || 'Worker account is inactive or unauthorized.';
        } else if (err.response.status === 404) {
          msg = 'Worker login endpoint not found (404).';
        } else if (err.response.status >= 500) {
          msg = 'Sanitrax server error (500). Please try again later.';
        } else {
          msg = err.response.data?.detail || `Error (${err.response.status}): Login failed.`;
        }
      } else if (err.request) {
        msg = 'Cannot connect to Sanitrax server. Please check your network connection and server URL.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }

  };

  const handleBypassLogin = async () => {
    setError('');
    setBypassLoading(true);
    try {
      const data = await workerService.bypassLogin();
      if (onLoginSuccess) onLoginSuccess(data.worker);
      navigate('/dashboard');
    } catch (err) {
      console.error('Bypass login error:', err);
      // Fallback demo login if API is unreachable
      const mockWorker = { id: 1, username: 'demo_worker', name: 'Rajesh Kumar', role: 'Sanitation' };
      localStorage.setItem('sanitrax_worker_token', 'demo-token');
      localStorage.setItem('sanitrax_worker_user', JSON.stringify(mockWorker));
      if (onLoginSuccess) onLoginSuccess(mockWorker);
      navigate('/dashboard');
    } finally {
      setBypassLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '24px',
      maxWidth: '440px',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* Branding Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '16px',
          backgroundColor: '#ecfdf5',
          border: '1px solid #a7f3d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto',
          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.15)'
        }}>
          <IconWrench size={30} color="#059669" />
        </div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a' }}>
          SANITRAX
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#059669', fontWeight: '700' }}>
          Municipal Field Worker Portal
        </p>
      </div>

      {/* Login Card */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: '800', textAlign: 'center', color: '#0f172a' }}>
          Worker Sign In
        </h2>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '18px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Worker Username Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
              WORKER USERNAME / EMAIL
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }}>
                <IconUser size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (e.g. worker1)"
                style={{
                  width: '100%',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '12px 14px 12px 42px',
                  color: '#0f172a',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }}>
                <IconLock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                style={{
                  width: '100%',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '12px 42px 12px 42px',
                  color: '#0f172a',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || bypassLoading}
            style={{
              width: '100%',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '13px',
              fontSize: '14px',
              fontWeight: '800',
              cursor: loading ? 'wait' : 'pointer',
              marginBottom: '10px'
            }}
          >
            {loading ? 'Signing In...' : 'LOG IN TO WORKER PORTAL'}
          </button>
        </form>

        {/* Bypass Quick Login Button */}
        <button
          type="button"
          onClick={handleBypassLogin}
          disabled={loading || bypassLoading}
          style={{
            width: '100%',
            backgroundColor: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
            borderRadius: '10px',
            padding: '11px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: bypassLoading ? 'wait' : 'pointer'
          }}
        >
          {bypassLoading ? 'Connecting...' : 'DEMO WORKER ACCESS'}
        </button>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
          Restricted access for authorized municipal field staff only.
        </div>
      </div>
    </div>
  );
};

export default WorkerLogin;
