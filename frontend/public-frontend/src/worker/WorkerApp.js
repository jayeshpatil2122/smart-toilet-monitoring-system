import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./WorkerApp.css";

const WORKER_API_BASE = "http://127.0.0.1:8000/api/workers";
const COMPLAINT_STATUS = ["Pending", "In Progress", "Resolved"];

function WorkerApp() {
  const [view, setView] = useState("login");
  const [token, setToken] = useState(localStorage.getItem("worker_token") || "");
  const [worker, setWorker] = useState(() => {
    const raw = localStorage.getItem("worker_profile");
    return raw ? JSON.parse(raw) : null;
  });
  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetCodePreview, setResetCodePreview] = useState("");

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
  });
  const [forgotData, setForgotData] = useState({ username_or_email: "" });
  const [resetData, setResetData] = useState({ username: "", code: "", new_password: "" });

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Token ${token}`,
      },
    }),
    [token]
  );

  const clearAlerts = () => {
    setMessage("");
    setError("");
  };

  const fetchAssignedComplaints = useCallback(async (currentToken) => {
    const activeToken = currentToken || token;
    if (!activeToken) return;
    setLoadingComplaints(true);
    clearAlerts();
    try {
      const response = await axios.get(`${WORKER_API_BASE}/my-complaints/`, {
        headers: { Authorization: `Token ${activeToken}` },
      });
      setComplaints(response.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load assigned complaints.");
    } finally {
      setLoadingComplaints(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setView("dashboard");
      fetchAssignedComplaints(token);
    }
  }, [token, fetchAssignedComplaints]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAlerts();

    try {
      const response = await axios.post(`${WORKER_API_BASE}/login/`, loginData);
      const { token: workerToken, worker: workerProfile } = response.data;
      setToken(workerToken);
      setWorker(workerProfile);
      localStorage.setItem("worker_token", workerToken);
      localStorage.setItem("worker_profile", JSON.stringify(workerProfile));
      setMessage("Login successful.");
      setLoginData({ username: "", password: "" });
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAlerts();
    try {
      await axios.post(`${WORKER_API_BASE}/signup/`, signupData);
      setMessage("Signup successful. Please login.");
      setSignupData({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
      });
      setView("login");
    } catch (err) {
      setError(err?.response?.data?.detail || "Signup failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAlerts();
    try {
      const response = await axios.post(`${WORKER_API_BASE}/forgot-password/`, forgotData);
      setMessage(response.data?.detail || "Reset code generated.");
      setResetCodePreview(response.data?.reset_code || "");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to generate reset code.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAlerts();
    try {
      const response = await axios.post(`${WORKER_API_BASE}/reset-password/`, resetData);
      setMessage(response.data?.detail || "Password reset successful.");
      setResetData({ username: "", code: "", new_password: "" });
      setView("login");
    } catch (err) {
      setError(err?.response?.data?.detail || "Password reset failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("worker_token");
    localStorage.removeItem("worker_profile");
    setToken("");
    setWorker(null);
    setComplaints([]);
    setView("login");
    clearAlerts();
  };

  const updateComplaintStatus = async (complaintId, status) => {
    clearAlerts();
    try {
      const response = await axios.patch(
        `${WORKER_API_BASE}/my-complaints/${complaintId}/status/`,
        { status },
        authHeaders
      );

      setComplaints((prev) =>
        prev.map((item) => (item.id === complaintId ? response.data : item))
      );
      setMessage(`Complaint #${complaintId} marked as ${status}.`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update complaint status.");
    }
  };

  const renderAuthNavigation = () => (
    <div className="worker-nav">
      <button
        type="button"
        className={`worker-nav-btn ${view === "login" ? "active" : ""}`}
        onClick={() => setView("login")}
      >
        Login
      </button>
      <button
        type="button"
        className={`worker-nav-btn ${view === "signup" ? "active" : ""}`}
        onClick={() => setView("signup")}
      >
        Signup
      </button>
      <button
        type="button"
        className={`worker-nav-btn ${view === "forgot" ? "active" : ""}`}
        onClick={() => setView("forgot")}
      >
        Forgot Password
      </button>
    </div>
  );

  return (
    <div className="worker-shell">
      <div className="worker-card">
        <div className="worker-header">
          <h1>Worker Panel</h1>
          <p>Assigned complaints and updates</p>
          {view === "dashboard" && worker && (
            <div className="worker-profile">
              <span>Logged in as <b>{worker.username}</b></span>
              <button type="button" className="worker-logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>

        {message && <div className="worker-alert success">{message}</div>}
        {error && <div className="worker-alert error">{error}</div>}

        {view !== "dashboard" && renderAuthNavigation()}

        {view === "login" && (
          <form onSubmit={handleLogin} className="worker-form">
            <label>Username</label>
            <input
              type="text"
              value={loginData.username}
              onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              required
            />

            <button type="submit" disabled={authLoading}>
              {authLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={handleSignup} className="worker-form">
            <label>Username</label>
            <input
              type="text"
              value={signupData.username}
              onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={signupData.email}
              onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
            />

            <label>First Name</label>
            <input
              type="text"
              value={signupData.first_name}
              onChange={(e) => setSignupData({ ...signupData, first_name: e.target.value })}
            />

            <label>Last Name</label>
            <input
              type="text"
              value={signupData.last_name}
              onChange={(e) => setSignupData({ ...signupData, last_name: e.target.value })}
            />

            <label>Password</label>
            <input
              type="password"
              value={signupData.password}
              onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
              required
            />

            <button type="submit" disabled={authLoading}>
              {authLoading ? "Creating..." : "Create Worker Account"}
            </button>
          </form>
        )}

        {view === "forgot" && (
          <div className="worker-forgot-wrap">
            <form onSubmit={handleForgotPassword} className="worker-form">
              <label>Username or Email</label>
              <input
                type="text"
                value={forgotData.username_or_email}
                onChange={(e) => setForgotData({ username_or_email: e.target.value })}
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? "Generating..." : "Get Reset Code"}
              </button>
            </form>

            <form onSubmit={handleResetPassword} className="worker-form">
              <label>Username</label>
              <input
                type="text"
                value={resetData.username}
                onChange={(e) => setResetData({ ...resetData, username: e.target.value })}
                required
              />
              <label>Reset Code</label>
              <input
                type="text"
                value={resetData.code}
                onChange={(e) => setResetData({ ...resetData, code: e.target.value })}
                required
              />
              <label>New Password</label>
              <input
                type="password"
                value={resetData.new_password}
                onChange={(e) => setResetData({ ...resetData, new_password: e.target.value })}
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? "Updating..." : "Reset Password"}
              </button>
            </form>

            {resetCodePreview && (
              <p className="worker-reset-code-note">
                Reset code (dev preview): <b>{resetCodePreview}</b>
              </p>
            )}
          </div>
        )}

        {view === "dashboard" && (
          <div className="worker-dashboard">
            <div className="worker-dashboard-head">
              <h2>My Assigned Complaints</h2>
              <button
                type="button"
                onClick={() => fetchAssignedComplaints()}
                className="worker-refresh-btn"
              >
                Refresh
              </button>
            </div>

            {loadingComplaints && <p className="worker-empty">Loading complaints...</p>}
            {!loadingComplaints && complaints.length === 0 && (
              <p className="worker-empty">No complaints assigned yet.</p>
            )}

            <div className="worker-complaint-grid">
              {complaints.map((complaint) => (
                <div key={complaint.id} className="worker-complaint-card">
                  <div className="worker-complaint-top">
                    <h3>#{complaint.id} - {complaint.toilet_name}</h3>
                    <span className={`worker-status ${complaint.status.toLowerCase().replace(" ", "-")}`}>
                      {complaint.status}
                    </span>
                  </div>
                  <p><b>Location:</b> {complaint.toilet_location}</p>
                  <p><b>Issue:</b> {complaint.issue_type}</p>
                  <p><b>Priority:</b> {complaint.priority}</p>
                  <p><b>Description:</b> {complaint.description}</p>
                  <p><b>Created:</b> {new Date(complaint.created_at).toLocaleString()}</p>
                  <div className="worker-status-actions">
                    {COMPLAINT_STATUS.map((status) => (
                      <button
                        type="button"
                        key={status}
                        disabled={complaint.status === status}
                        onClick={() => updateComplaintStatus(complaint.id, status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkerApp;
