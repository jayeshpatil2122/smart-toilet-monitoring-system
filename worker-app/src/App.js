import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import WorkerLogin from './pages/WorkerLogin';
import WorkerDashboard from './pages/WorkerDashboard';
import ComplaintDetails from './pages/ComplaintDetails';
import ResolveComplaint from './pages/ResolveComplaint';
import CompletedComplaints from './pages/CompletedComplaints';
import WorkerProfile from './pages/WorkerProfile';
import BottomNavigation from './components/BottomNavigation';
import { initialComplaints, mockWorker, transformApiComplaint } from './utils/mockData';
import { workerService } from './services/workerService';
import { complaintService } from './services/complaintService';
import { notificationService } from './services/notificationService';

function MainApp() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!workerService.getStoredToken());
  const [worker, setWorker] = useState(() => workerService.getStoredWorker() || mockWorker);
  const [complaints, setComplaints] = useState(initialComplaints);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!workerService.getStoredToken()) return;
    try {
      const profileData = await workerService.getProfile();
      if (profileData) {
        setWorker(prev => ({
          ...prev,
          id: profileData.employee_id || profileData.username || prev.id,
          name: profileData.full_name || profileData.username || prev.name,
          email: profileData.email || prev.email,
          phone: profileData.phone_number || prev.phone,
          zone: profileData.assigned_area || prev.zone,
          is_active: profileData.is_active ?? true,
        }));
      }
    } catch (err) {
      console.warn('Backend profile fetch error:', err);
    }
  }, []);

  const fetchComplaints = useCallback(async (isSilent = false) => {
    if (!workerService.getStoredToken()) return;
    if (!isSilent) setLoading(true);
    try {
      const data = await complaintService.getMyComplaints();
      if (Array.isArray(data)) {
        const transformed = data.map(transformApiComplaint);
        
        // Persistent notification deduplication
        let notifiedIds = [];
        try {
          notifiedIds = JSON.parse(localStorage.getItem('sanitrax_notified_ids') || '[]');
        } catch (e) {
          notifiedIds = [];
        }

        const newUnnotifiedTasks = transformed.filter(c => 
          !notifiedIds.includes(String(c.id)) && 
          (c.status === 'ASSIGNED' || c.status === 'PENDING')
        );

        if (newUnnotifiedTasks.length > 0) {
          setNotification(`New complaint #${newUnnotifiedTasks[0].id} assigned to you`);
          setTimeout(() => setNotification(null), 6000);

          // Schedule real Android System Notification with Sound & Vibration
          newUnnotifiedTasks.forEach(newTask => {
            notificationService.scheduleTaskNotification(newTask);
          });

          const updatedNotifiedIds = Array.from(new Set([...notifiedIds, ...newUnnotifiedTasks.map(t => String(t.id))]));
          try {
            localStorage.setItem('sanitrax_notified_ids', JSON.stringify(updatedNotifiedIds));
          } catch (e) {}
        }

        // Merge incoming complaints while protecting local advanced state (ACCEPTED / IN_PROGRESS)
        setComplaints(prev => {
          const prevMap = new Map(prev.map(c => [String(c.id), c]));
          return transformed.map(incoming => {
            const existing = prevMap.get(String(incoming.id));
            if (existing) {
              const localStatus = existing.status;
              const incomingStatus = incoming.status;
              if ((localStatus === 'ACCEPTED' || localStatus === 'IN_PROGRESS') && (incomingStatus === 'ASSIGNED' || incomingStatus === 'PENDING')) {
                return { ...incoming, status: localStatus };
              }
            }
            return incoming;
          });
        });
      }
    } catch (err) {
      console.warn('Backend complaints fetch notice:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial load & Native Notification setup
  useEffect(() => {
    if (isAuthenticated) {
      const handleFcmToken = (token) => {
        workerService.registerFCMToken(token);
      };
      const handleTapNotification = (complaintId) => {
        if (complaintId) {
          navigate(`/complaint/${complaintId}`);
        }
      };

      notificationService.init(handleFcmToken, handleTapNotification);
      const listener = notificationService.attachTapListener(handleTapNotification);
      fetchProfile();
      fetchComplaints();

      return () => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      };
    }
  }, [isAuthenticated, fetchProfile, fetchComplaints, navigate]);

  // Auto-refresh interval (approx every 12 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      fetchComplaints(true);
    }, 12000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, fetchComplaints]);


  const handleLoginSuccess = (workerData) => {
    setIsAuthenticated(true);
    if (workerData) {
      setWorker(prev => ({
        ...prev,
        id: workerData.employee_id || workerData.id || prev.id,
        name: workerData.full_name || workerData.name || workerData.username || prev.name,
        email: workerData.email || prev.email,
      }));
    }
    fetchProfile();
    fetchComplaints();
  };

  const handleLogout = () => {
    workerService.logout();
    setIsAuthenticated(false);
    setWorker(mockWorker);
  };

  const handleUpdateStatus = async (complaintId, newStatus) => {
    let apiStatus = 'In Progress';
    if (newStatus === 'ACCEPTED') apiStatus = 'Accepted';
    if (newStatus === 'IN_PROGRESS') apiStatus = 'In Progress';
    if (newStatus === 'COMPLETED' || newStatus === 'Resolved') apiStatus = 'Resolved';
    
    // Update local state immediately
    setComplaints(prev => prev.map(c => 
      String(c.id) === String(complaintId) ? { ...c, status: newStatus } : c
    ));

    try {
      await complaintService.updateComplaintStatus(complaintId, { status: apiStatus, skip_ai: true });
      fetchComplaints(true);
    } catch (err) {
      console.warn('API update status notice:', err);
    }
  };

  const handleResolveComplaint = async (complaintId, resolutionData) => {
    // Update local state immediately
    setComplaints(prev => prev.map(c => {
      if (String(c.id) === String(complaintId)) {
        return {
          ...c,
          status: 'COMPLETED',
          afterImage: resolutionData.afterImage,
          remarks: resolutionData.remarks,
          completedDate: resolutionData.completedDate
        };
      }
      return c;
    }));

    try {
      await complaintService.updateComplaintStatus(complaintId, {
        status: 'Resolved',
        after_image: resolutionData.fileObj || null,
        remarks: resolutionData.remarks,
        skip_ai: true,
      });
      fetchComplaints(true);
    } catch (err) {
      console.warn('API resolution submit notice:', err);
    }
  };

  return (
    <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#1e293b',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}>
        {/* Simple Municipal Toast Notification */}
        {notification && (
          <div style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '24px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🔔</span>
            <span>{notification}</span>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                marginLeft: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              ✕
            </button>
          </div>
        )}

        <Routes>
          <Route 
            path="/login" 
            element={
              <WorkerLogin onLoginSuccess={handleLoginSuccess} />
            } 
          />
          
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? (
                <WorkerDashboard complaints={complaints} worker={worker} loading={loading} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/complaints" 
            element={
              isAuthenticated ? (
                <WorkerDashboard complaints={complaints} worker={worker} loading={loading} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/complaint/:id" 
            element={
              isAuthenticated ? (
                <ComplaintDetails 
                  complaints={complaints} 
                  onUpdateStatus={handleUpdateStatus} 
                />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/complaint/:id/resolve" 
            element={
              isAuthenticated ? (
                <ResolveComplaint 
                  complaints={complaints} 
                  onResolveComplaint={handleResolveComplaint} 
                />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/completed" 
            element={
              isAuthenticated ? (
                <CompletedComplaints complaints={complaints} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route 
            path="/profile" 
            element={
              isAuthenticated ? (
                <WorkerProfile 
                  worker={worker} 
                  onLogout={handleLogout} 
                />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {isAuthenticated && <BottomNavigation />}
      </div>
    );
}


function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

export default App;


