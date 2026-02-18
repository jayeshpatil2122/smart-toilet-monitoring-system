import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import appLogo from "./logo.svg";
import ComplaintForm from "./ComplaintForm.js";
import ToiletMap from "./components/ToiletMap";
import "./App.css";

const PORTAL_API_BASE = "http://127.0.0.1:8000/api/workers/portal";
const SPLASH_DURATION_MS = 3500; // You can change this to 3000/4000 later

function App() {
  const [toilets, setToilets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToilet, setSelectedToilet] = useState(null);
  const [focusedToiletId, setFocusedToiletId] = useState(null);
  const [detailsOnlyId, setDetailsOnlyId] = useState(null);
  const [showAllToilets, setShowAllToilets] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [showSplash, setShowSplash] = useState(true);
  const [portalToken, setPortalToken] = useState(localStorage.getItem("portal_token") || "");
  const [portalProfile, setPortalProfile] = useState(() => {
    const raw = localStorage.getItem("portal_profile");
    return raw ? JSON.parse(raw) : null;
  });

  const [authView, setAuthView] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
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

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!portalToken) return;
    axios
      .get("http://127.0.0.1:8000/api/toilets/")
      .then((response) => {
        setToilets(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching toilets:", error);
        setLoading(false);
      });
  }, [portalToken]);

  const clearAuthNotices = () => {
    setAuthMessage("");
    setAuthError("");
  };

  const handlePortalLogin = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAuthNotices();
    try {
      const response = await axios.post(`${PORTAL_API_BASE}/login/`, loginData);
      const { token, user } = response.data;
      localStorage.setItem("portal_token", token);
      localStorage.setItem("portal_profile", JSON.stringify(user));
      setPortalToken(token);
      setPortalProfile(user);
      setLoginData({ username: "", password: "" });
    } catch (error) {
      setAuthError(error?.response?.data?.detail || "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePortalSignup = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAuthNotices();
    try {
      await axios.post(`${PORTAL_API_BASE}/signup/`, signupData);
      setSignupData({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
      });
      setAuthMessage("Signup successful. Please login.");
      setAuthView("login");
    } catch (error) {
      setAuthError(error?.response?.data?.detail || "Signup failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePortalForgotPassword = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAuthNotices();
    try {
      const response = await axios.post(`${PORTAL_API_BASE}/forgot-password/`, forgotData);
      setAuthMessage(response.data?.detail || "Reset code generated.");
      setResetCodePreview(response.data?.reset_code || "");
    } catch (error) {
      setAuthError(error?.response?.data?.detail || "Failed to generate reset code.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePortalResetPassword = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    clearAuthNotices();
    try {
      const response = await axios.post(`${PORTAL_API_BASE}/reset-password/`, resetData);
      setAuthMessage(response.data?.detail || "Password reset successful.");
      setResetData({ username: "", code: "", new_password: "" });
      setAuthView("login");
    } catch (error) {
      setAuthError(error?.response?.data?.detail || "Password reset failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePortalLogout = () => {
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_profile");
    setPortalToken("");
    setPortalProfile(null);
    setShowAllToilets(false);
    setDetailsOnlyId(null);
    setFocusedToiletId(null);
    setSelectedToilet(null);
  };

  const handleComplaintClick = (toiletId) => {
    setSelectedToilet(toiletId);
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "good":
        return "good";
      case "moderate":
        return "moderate";
      case "critical":
        return "critical";
      default:
        return "good";
    }
  };

  const clampPercentage = (value) => {
    const numberValue = Number(value || 0);
    if (Number.isNaN(numberValue)) return 0;
    return Math.max(0, Math.min(100, Math.round(numberValue)));
  };

  const getMetricTone = (value) => {
    const safeValue = clampPercentage(value);
    if (safeValue < 40) return "critical";
    if (safeValue < 70) return "warning";
    return "healthy";
  };

  const query = searchTerm.trim().toLowerCase();

  const isSearchMatch = (toilet, keyword) => {
    if (!keyword) return false;
    const haystack = `${toilet.name || ""} ${toilet.location || ""} ${toilet.status || ""}`.toLowerCase();
    const words = haystack.split(/[\s,.-]+/).filter(Boolean);
    return words.some((word) => word.startsWith(keyword));
  };

  const matchingToilets = useMemo(() => {
    if (!query) return [];
    return toilets.filter((toilet) => isSearchMatch(toilet, query));
  }, [toilets, query]);

  const highlightedToiletIds = useMemo(
    () => matchingToilets.map((toilet) => toilet.id),
    [matchingToilets]
  );

  const visibleToilets = useMemo(() => {
    if (detailsOnlyId === null) return toilets;
    return toilets.filter((toilet) => toilet.id === detailsOnlyId);
  }, [toilets, detailsOnlyId]);

  const handleViewDetailsFromMap = (toiletId) => {
    setSelectedToilet(null);
    setShowAllToilets(true);
    setDetailsOnlyId(toiletId);
    setFocusedToiletId(toiletId);
  };

  useEffect(() => {
    if (!showAllToilets || focusedToiletId === null) return;
    const card = document.getElementById(`toilet-card-${focusedToiletId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showAllToilets, focusedToiletId]);

  const handleToggleAllToilets = () => {
    if (!showAllToilets) {
      setShowAllToilets(true);
      setDetailsOnlyId(null);
      setFocusedToiletId(null);
      return;
    }

    if (detailsOnlyId !== null) {
      setDetailsOnlyId(null);
      setFocusedToiletId(null);
      return;
    }

    setShowAllToilets(false);
    setFocusedToiletId(null);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!query) return;
    if (matchingToilets.length > 0) {
      const firstMatchId = matchingToilets[0].id;
      handleViewDetailsFromMap(firstMatchId);
    }
  };

  const toggleLabel = !showAllToilets
    ? "Show All Toilets"
    : detailsOnlyId !== null
      ? "Show All Toilets"
      : "Hide All Toilets";

  if (showSplash) {
    return (
      <div className="portal-splash">
        <div className="portal-splash-core">
          <img src={appLogo} alt="Portal Logo" className="portal-splash-logo" />
          <h1>Smart Public Toilet</h1>
          <p>Initializing intelligent sanitation network...</p>
          <div className="portal-loader-grid">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="portal-loader-line">
            <div className="portal-loader-line-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!portalToken) {
    return (
      <div className="portal-auth-shell">
        <div className="portal-auth-card">
          <div className="portal-auth-head">
            <img src={appLogo} alt="Portal Logo" className="portal-auth-logo" />
            <h1>User Access Portal</h1>
            <p>Secure entry required</p>
          </div>

          {authMessage && <div className="portal-auth-msg ok">{authMessage}</div>}
          {authError && <div className="portal-auth-msg err">{authError}</div>}

          <div className="portal-auth-tabs">
            <button
              type="button"
              className={authView === "login" ? "active" : ""}
              onClick={() => setAuthView("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={authView === "signup" ? "active" : ""}
              onClick={() => setAuthView("signup")}
            >
              Signup
            </button>
            <button
              type="button"
              className={authView === "forgot" ? "active" : ""}
              onClick={() => setAuthView("forgot")}
            >
              Forgot Password
            </button>
          </div>

          {authView === "login" && (
            <form className="portal-auth-form" onSubmit={handlePortalLogin}>
              <input
                type="text"
                placeholder="Username"
                value={loginData.username}
                onChange={(event) => setLoginData({ ...loginData, username: event.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? "Verifying..." : "Enter Portal"}
              </button>
            </form>
          )}

          {authView === "signup" && (
            <form className="portal-auth-form" onSubmit={handlePortalSignup}>
              <input
                type="text"
                placeholder="Username"
                value={signupData.username}
                onChange={(event) => setSignupData({ ...signupData, username: event.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={signupData.email}
                onChange={(event) => setSignupData({ ...signupData, email: event.target.value })}
              />
              <input
                type="text"
                placeholder="First Name"
                value={signupData.first_name}
                onChange={(event) => setSignupData({ ...signupData, first_name: event.target.value })}
              />
              <input
                type="text"
                placeholder="Last Name"
                value={signupData.last_name}
                onChange={(event) => setSignupData({ ...signupData, last_name: event.target.value })}
              />
              <input
                type="password"
                placeholder="Password"
                value={signupData.password}
                onChange={(event) => setSignupData({ ...signupData, password: event.target.value })}
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? "Creating..." : "Create Account"}
              </button>
            </form>
          )}

          {authView === "forgot" && (
            <div className="portal-forgot-wrap">
              <form className="portal-auth-form" onSubmit={handlePortalForgotPassword}>
                <input
                  type="text"
                  placeholder="Username or Email"
                  value={forgotData.username_or_email}
                  onChange={(event) => setForgotData({ username_or_email: event.target.value })}
                  required
                />
                <button type="submit" disabled={authLoading}>
                  {authLoading ? "Generating..." : "Get Reset Code"}
                </button>
              </form>

              <form className="portal-auth-form" onSubmit={handlePortalResetPassword}>
                <input
                  type="text"
                  placeholder="Username"
                  value={resetData.username}
                  onChange={(event) => setResetData({ ...resetData, username: event.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Reset Code"
                  value={resetData.code}
                  onChange={(event) => setResetData({ ...resetData, code: event.target.value })}
                  required
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={resetData.new_password}
                  onChange={(event) =>
                    setResetData({ ...resetData, new_password: event.target.value })
                  }
                  required
                />
                <button type="submit" disabled={authLoading}>
                  {authLoading ? "Updating..." : "Reset Password"}
                </button>
              </form>

              {resetCodePreview && (
                <p className="portal-reset-dev-note">
                  Reset code (dev preview): <b>{resetCodePreview}</b>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="main-header">
        <p className="eyebrow">Citizen Toilet Portal</p>
        <h1>Smart Public Toilet</h1>
        <h2>Nearby Toilets</h2>
        <div className="portal-userbar">
          <span>Welcome, {portalProfile?.username || "User"}</span>
          <button type="button" onClick={handlePortalLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="map-tools">
        <form className="map-search-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="map-search-input"
            placeholder="Search toilets by name or location..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <button type="submit" className="map-search-btn">
            Search
          </button>
        </form>

        {query && (
          <div className="map-search-results">
            {matchingToilets.length === 0 && (
              <div className="search-empty">No toilet matched this keyword.</div>
            )}

            {matchingToilets.length > 0 && (
              <div className="search-results-list">
                {matchingToilets.map((toilet) => (
                  <button
                    key={toilet.id}
                    type="button"
                    className="search-result-card"
                    onClick={() => handleViewDetailsFromMap(toilet.id)}
                  >
                    <span className="search-result-name">{toilet.name}</span>
                    <span className="search-result-location">{toilet.location}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="map-section">
        <ToiletMap
          toilets={toilets}
          highlightedToiletIds={highlightedToiletIds}
          onSelectToilet={(id) => setSelectedToilet(id)}
          onViewDetails={handleViewDetailsFromMap}
        />
      </section>

      <div className="toilets-toggle-wrap">
        <button className="all-toilets-btn" onClick={handleToggleAllToilets}>
          {toggleLabel}
        </button>
      </div>

      {showAllToilets && (
        <div>
          {detailsOnlyId !== null && (
            <div className="details-mode-note">Showing selected toilet details</div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Finding toilets near you...</p>
            </div>
          )}

          {!loading && visibleToilets.length === 0 && (
            <div className="empty-state">
              <p>No toilets found in your area.</p>
            </div>
          )}

          {!loading && visibleToilets.length > 0 && (
            <div className="toilets-grid">
              {visibleToilets.map((toilet) => {
                const statusClass = getStatusClass(toilet.status);
                const healthValue = clampPercentage(toilet.health_score);
                const cleanlinessValue = clampPercentage(toilet.cleanliness);
                const waterValue = clampPercentage(toilet.water_level);

                return (
                  <div
                    id={`toilet-card-${toilet.id}`}
                    key={toilet.id}
                    className={`toilet-card ${statusClass}-card ${
                      focusedToiletId === toilet.id ? "toilet-card-focused" : ""
                    }`}
                  >
                    <div className="toilet-card-header">
                      <div>
                        <h3 className="toilet-name">{toilet.name}</h3>
                        <p className="toilet-location">{toilet.location}</p>
                      </div>

                      <span className={`status-badge ${getStatusClass(toilet.status)}`}>
                        {toilet.status || "Good"}
                      </span>
                    </div>

                    <div className="toilet-kpi-row">
                      <div className="usage-count">Used {toilet.usage_count || 0} times today</div>
                    </div>

                    <div className="toilet-metrics">
                      <div className={`metric-item ${getMetricTone(healthValue)}`}>
                        <div className="metric-label">
                          <span className="metric-name">Health Score</span>
                          <span className="metric-value">{healthValue}%</span>
                        </div>
                        <div className="metric-bar">
                          <div
                            className="metric-bar-fill health"
                            style={{ width: `${healthValue}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className={`metric-item ${getMetricTone(cleanlinessValue)}`}>
                        <div className="metric-label">
                          <span className="metric-name">Cleanliness</span>
                          <span className="metric-value">{cleanlinessValue}%</span>
                        </div>
                        <div className="metric-bar">
                          <div
                            className="metric-bar-fill cleanliness"
                            style={{ width: `${cleanlinessValue}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className={`metric-item ${getMetricTone(waterValue)}`}>
                        <div className="metric-label">
                          <span className="metric-name">Water Level</span>
                          <span className="metric-value">{waterValue}%</span>
                        </div>
                        <div className="metric-bar">
                          <div
                            className="metric-bar-fill water"
                            style={{ width: `${waterValue}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <button className="complaint-btn" onClick={() => handleComplaintClick(toilet.id)}>
                      Submit Complaint
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedToilet !== null && (
        <div className="modal-overlay" onClick={() => setSelectedToilet(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedToilet(null)}>
              x
            </button>
            <h2 className="modal-title">Submit Complaint</h2>
            <ComplaintForm toiletId={selectedToilet} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
