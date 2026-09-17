import api from './api';

export const workerService = {
  // Login with worker username & password
  login: async (username, password) => {
    const response = await api.post('/workers/login/', { username, password });
    if (response.data.token) {
      localStorage.setItem('sanitrax_worker_token', response.data.token);
      localStorage.setItem('sanitrax_worker_user', JSON.stringify(response.data.worker));
    }
    return response.data;
  },

  // Demo bypass login (creates or retrieves bypass worker account)
  bypassLogin: async () => {
    const response = await api.post('/workers/bypass/');
    if (response.data.token) {
      localStorage.setItem('sanitrax_worker_token', response.data.token);
      localStorage.setItem('sanitrax_worker_user', JSON.stringify(response.data.worker));
    }
    return response.data;
  },

  // Retrieve stored token
  getStoredToken: () => {
    return localStorage.getItem('sanitrax_worker_token');
  },

  // Retrieve stored worker user profile
  getStoredWorker: () => {
    const data = localStorage.getItem('sanitrax_worker_user');
    return data ? JSON.parse(data) : null;
  },

  // Retrieve profile from backend
  getProfile: async () => {
    const response = await api.get('/workers/profile/');
    return response.data;
  },

  // Register FCM Push Token with backend
  registerFCMToken: async (fcmToken) => {
    if (!fcmToken) return;
    try {
      const response = await api.post('/workers/fcm-token/', { token: fcmToken });
      return response.data;
    } catch (err) {
      console.warn('FCM token registration notice:', err);
    }
  },

  // Logout worker and clear tokens
  logout: () => {
    localStorage.removeItem('sanitrax_worker_token');
    localStorage.removeItem('sanitrax_worker_user');
  }
};
