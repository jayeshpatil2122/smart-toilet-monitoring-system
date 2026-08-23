const getApiBase = () => {
  const configured = process.env.REACT_APP_API_URL?.trim();
  if (!configured) {
    return "http://127.0.0.1:8000";
  }
  return configured.replace(/\/+$/, "");
};

export const API_BASE = getApiBase();
export const WORKER_API_BASE = `${API_BASE}/api/workers`;
export const PORTAL_API_BASE = `${API_BASE}/api/workers/portal`;
export const COMPLAINTS_API_BASE = `${API_BASE}/api/complaints`;
export const TOILETS_API_BASE = `${API_BASE}/api/toilets`;
export const PAYMENTS_API_BASE = `${API_BASE}/api/payments`;

export default API_BASE;
