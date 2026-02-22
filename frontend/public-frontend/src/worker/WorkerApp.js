import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import WorkerComplaintMap from "./WorkerComplaintMap";
import "./WorkerApp.css";

const API_BASE = (
  process.env.REACT_APP_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const WORKER_API_BASE = `${API_BASE}/api/workers`;
const COMPLAINT_API_BASE = `${API_BASE}/api/complaints`;
const TOILETS_API_BASE = `${API_BASE}/api/toilets`;
const DASHBOARD_TAB_ASSIGNED = "assigned";
const DASHBOARD_TAB_ALERTS = "alerts";
const DASHBOARD_TAB_RANKING = "ranking";
const DASHBOARD_TAB_SIMULATION = "simulation";
const SLA_TOTAL_SECONDS = 6 * 60 * 60;
const STATUS_PENDING = "pending";
const STATUS_IN_PROGRESS = "in progress";
const STATUS_RESOLVED = "resolved";
const APP_NAME = "SANITRAX";

const PRIORITY_ORDER = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const AI_SUGGESTIONS = {
  dirty: {
    title: "Suggested Cleaning Kit",
    lines: [
      "Floor disinfectant and toilet cleaner",
      "Mop, bucket and scrub brush",
      "Wear gloves and mask",
      "Clean seat, floor and high-touch points",
      "Spray deodorizer after deep cleaning",
    ],
  },
  "no water": {
    title: "AI Suggested Action",
    lines: [
      "Check water tank level",
      "Inspect motor pump",
      "Check municipal supply",
      "Inspect valve blockage",
      "Run flow test after restoring supply",
    ],
  },
  broken: {
    title: "AI Suggested Repair Steps",
    lines: [
      "Inspect damaged fitting or fixture",
      "Shut off inlet valve before repair",
      "Replace broken part with spare unit",
      "Check for leakage after fitting",
      "Sanitize repaired area before closure",
    ],
  },
  other: {
    title: "AI Suggested Inspection Steps",
    lines: [
      "Review complaint description carefully",
      "Capture clear before-condition photos",
      "Perform quick safety and hygiene check",
      "Escalate to supervisor if parts are required",
      "Add detailed notes after completion",
    ],
  },
};

const getPriorityClass = (priority) => {
  const normalized = String(priority || "").toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
};

const getSmartSuggestion = (issueType) => {
  const normalized = String(issueType || "").trim().toLowerCase();
  return AI_SUGGESTIONS[normalized] || null;
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const hasCoordinates = (complaint) =>
  complaint &&
  Number.isFinite(Number(complaint.toilet_latitude)) &&
  Number.isFinite(Number(complaint.toilet_longitude));

const medalLabel = (rank) => {
  if (rank === 1) return "Gold";
  if (rank === 2) return "Silver";
  if (rank === 3) return "Bronze";
  return `Rank ${rank}`;
};

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const parseDurationToSeconds = (value) => {
  if (!value) return 0;
  const match = String(value).match(
    /(?:(\d+)\s+day[s]?,\s*)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?/
  );
  if (!match) return 0;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
};

const formatAverageHours = (seconds) => {
  if (!seconds || Number.isNaN(seconds)) return "0.0 hrs";
  return `${(seconds / 3600).toFixed(1)} hrs`;
};

const clampMetric = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const getToiletMetricTone = (value) => {
  const safe = clampMetric(value);
  if (safe < 40) return "critical";
  if (safe < 70) return "warning";
  return "healthy";
};

const getToiletStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "moderate") return "moderate";
  return "good";
};

const getSlaMeta = (complaint, nowTick) => {
  if (!complaint || normalizeStatus(complaint.status) === STATUS_RESOLVED) {
    return {
      text: "Resolved",
      tone: "resolved",
      remainingSeconds: 0,
    };
  }

  const createdMs = new Date(complaint.created_at).getTime();
  if (!Number.isFinite(createdMs)) {
    return {
      text: "SLA unavailable",
      tone: "normal",
      remainingSeconds: SLA_TOTAL_SECONDS,
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowTick - createdMs) / 1000));
  const remainingSeconds = SLA_TOTAL_SECONDS - elapsedSeconds;

  if (remainingSeconds <= 0) {
    return {
      text: "Escalation overdue",
      tone: "overdue",
      remainingSeconds,
    };
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  return {
    text: `Time Remaining Before Escalation: ${hours}h ${minutes}m`,
    tone: remainingSeconds < 3600 ? "critical" : "normal",
    remainingSeconds,
  };
};

function WorkerApp() {
  const [view, setView] = useState("login");
  const [dashboardTab, setDashboardTab] = useState(DASHBOARD_TAB_ASSIGNED);
  const [token, setToken] = useState(localStorage.getItem("worker_token") || "");
  const [worker, setWorker] = useState(() => {
    const raw = localStorage.getItem("worker_profile");
    return raw ? JSON.parse(raw) : null;
  });

  const [complaints, setComplaints] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [toilets, setToilets] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [loadingToilets, setLoadingToilets] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [alertStatusLoadingId, setAlertStatusLoadingId] = useState(null);
  const [simulationBusyAction, setSimulationBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetCodePreview, setResetCodePreview] = useState("");
  const [activeComplaintId, setActiveComplaintId] = useState(null);
  const [afterImageFiles, setAfterImageFiles] = useState({});
  const [aiActionsVisible, setAiActionsVisible] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [workerLocation, setWorkerLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [selectedToiletId, setSelectedToiletId] = useState("");
  const [qrCopied, setQrCopied] = useState(false);

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

  const fetchAssignedComplaints = useCallback(
    async (currentToken) => {
      const activeToken = currentToken || token;
      if (!activeToken) return;
      setLoadingComplaints(true);
      clearAlerts();
      try {
        const response = await axios.get(`${WORKER_API_BASE}/my-complaints/`, {
          headers: { Authorization: `Token ${activeToken}` },
        });
        setComplaints(response.data || []);
      } catch (err) {
        setError(err?.response?.data?.detail || "Could not load assigned complaints.");
      } finally {
        setLoadingComplaints(false);
      }
    },
    [token]
  );

  const fetchAssignedAlerts = useCallback(
    async (currentToken) => {
      const activeToken = currentToken || token;
      if (!activeToken) return;
      setLoadingAlerts(true);
      try {
        const response = await axios.get(`${WORKER_API_BASE}/my-alerts/`, {
          headers: { Authorization: `Token ${activeToken}` },
        });
        setAlerts(response.data || []);
      } catch (err) {
        setError(err?.response?.data?.detail || "Could not load assigned alerts.");
      } finally {
        setLoadingAlerts(false);
      }
    },
    [token]
  );

  const fetchRanking = useCallback(async () => {
    setLoadingRanking(true);
    try {
      const response = await axios.get(`${COMPLAINT_API_BASE}/staff-performance/`);
      setRanking(response.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load ranking data.");
    } finally {
      setLoadingRanking(false);
    }
  }, []);

  const fetchToilets = useCallback(async () => {
    setLoadingToilets(true);
    try {
      const response = await axios.get(`${TOILETS_API_BASE}/`);
      const nextToilets = Array.isArray(response.data) ? response.data : [];
      setToilets(nextToilets);
      setSelectedToiletId((previous) => {
        if (previous && nextToilets.some((item) => String(item.id) === String(previous))) {
          return previous;
        }
        return nextToilets.length > 0 ? String(nextToilets[0].id) : "";
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load toilets for simulation.");
      setToilets([]);
    } finally {
      setLoadingToilets(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      setView("dashboard");
      fetchAssignedComplaints(token);
      fetchAssignedAlerts(token);
      fetchRanking();
      fetchToilets();
    }
  }, [token, fetchAssignedComplaints, fetchAssignedAlerts, fetchRanking, fetchToilets]);

  useEffect(() => {
    if (view === "dashboard" && dashboardTab === DASHBOARD_TAB_RANKING && ranking.length === 0) {
      fetchRanking();
    }
  }, [view, dashboardTab, ranking.length, fetchRanking]);

  useEffect(() => {
    if (view === "dashboard" && dashboardTab === DASHBOARD_TAB_ALERTS && alerts.length === 0) {
      fetchAssignedAlerts();
    }
  }, [view, dashboardTab, alerts.length, fetchAssignedAlerts]);

  useEffect(() => {
    if (
      view === "dashboard" &&
      dashboardTab === DASHBOARD_TAB_SIMULATION &&
      toilets.length === 0
    ) {
      fetchToilets();
    }
  }, [view, dashboardTab, toilets.length, fetchToilets]);

  useEffect(() => {
    if (view !== "dashboard" || !token) return undefined;
    const intervalId = setInterval(() => {
      fetchAssignedComplaints();
      fetchAssignedAlerts();
      fetchToilets();
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(intervalId);
  }, [view, token, fetchAssignedComplaints, fetchAssignedAlerts, fetchToilets]);

  useEffect(() => {
    if (view !== "dashboard") return;
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setWorkerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError("");
      },
      () => {
        setLocationError("Could not read worker location. Enable location for work-order sorting.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 120000,
      }
    );
  }, [view]);

  useEffect(() => {
    if (!activeComplaintId) return;
    const el = document.getElementById(`complaint-${activeComplaintId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeComplaintId]);

  useEffect(() => {
    setQrCopied(false);
  }, [selectedToiletId]);

  const sortedComplaints = useMemo(() => {
    return [...complaints].sort((a, b) => {
      const byPriority =
        (PRIORITY_ORDER[a.priority] ?? 999) - (PRIORITY_ORDER[b.priority] ?? 999);
      if (byPriority !== 0) return byPriority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [complaints]);

  const mappableComplaints = useMemo(
    () => sortedComplaints.filter((item) => hasCoordinates(item)),
    [sortedComplaints]
  );

  const complaintsByDistance = useMemo(() => {
    if (!workerLocation) return [];
    return mappableComplaints
      .map((complaint) => ({
        ...complaint,
        distance: getDistance(
          workerLocation.lat,
          workerLocation.lng,
          Number(complaint.toilet_latitude),
          Number(complaint.toilet_longitude)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [mappableComplaints, workerLocation]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const aResolved = normalizeStatus(a.status) === STATUS_RESOLVED;
      const bResolved = normalizeStatus(b.status) === STATUS_RESOLVED;
      if (aResolved !== bResolved) return aResolved ? 1 : -1;
      const byPriority =
        (PRIORITY_ORDER[a.priority] ?? 999) - (PRIORITY_ORDER[b.priority] ?? 999);
      if (byPriority !== 0) return byPriority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [alerts]);

  const workerResolvedCount = useMemo(() => {
    if (!worker?.username) return 0;
    const current = ranking.find((item) => item.staff_name === worker.username);
    return current ? current.resolved_complaints : 0;
  }, [worker, ranking]);

  const rankingTopScore = useMemo(() => {
    if (ranking.length === 0) return 1;
    return Math.max(
      ...ranking.map((entry) => Number(entry.resolved_complaints) || 0),
      1
    );
  }, [ranking]);

  const dashboardStats = useMemo(() => {
    const pending = complaints.filter(
      (item) => normalizeStatus(item.status) === STATUS_PENDING
    ).length;
    const inProgress = complaints.filter(
      (item) => normalizeStatus(item.status) === STATUS_IN_PROGRESS
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = complaints.filter((item) => {
      if (normalizeStatus(item.status) !== STATUS_RESOLVED || !item.resolved_at) return false;
      return new Date(item.resolved_at) >= today;
    }).length;

    const resolutionDurations = complaints
      .filter(
        (item) => normalizeStatus(item.status) === STATUS_RESOLVED && item.resolution_time
      )
      .map((item) => parseDurationToSeconds(item.resolution_time))
      .filter((value) => value > 0);

    const avgResolutionSeconds = resolutionDurations.length
      ? resolutionDurations.reduce((sum, val) => sum + val, 0) / resolutionDurations.length
      : 0;

    return {
      totalAssigned: complaints.length,
      pending,
      inProgress,
      resolvedToday,
      avgResolutionSeconds,
    };
  }, [complaints]);

  const selectedToilet = useMemo(() => {
    if (!selectedToiletId) return null;
    return toilets.find((item) => String(item.id) === String(selectedToiletId)) || null;
  }, [toilets, selectedToiletId]);

  const isSimulationBusy = simulationBusyAction !== "";

  const selectedToiletStatusClass = useMemo(
    () => getToiletStatusClass(selectedToilet?.status),
    [selectedToilet]
  );

  const qrSimulationUrl = useMemo(() => {
    if (!selectedToiletId) return "";
    return `${window.location.origin}/simulation/scan?toilet_id=${selectedToiletId}&users=1`;
  }, [selectedToiletId]);

  const qrImageUrl = useMemo(() => {
    if (!qrSimulationUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      qrSimulationUrl
    )}`;
  }, [qrSimulationUrl]);

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
    setAlerts([]);
    setRanking([]);
    setToilets([]);
    setAfterImageFiles({});
    setActiveComplaintId(null);
    setWorkerLocation(null);
    setLocationError("");
    setAlertStatusLoadingId(null);
    setSimulationBusyAction("");
    setSelectedToiletId("");
    setQrCopied(false);
    setView("login");
    setDashboardTab(DASHBOARD_TAB_ASSIGNED);
    clearAlerts();
  };

  const updateComplaintStatus = async (complaintId, status, afterImageFile = null) => {
    clearAlerts();
    setStatusLoadingId(complaintId);
    try {
      const formData = new FormData();
      formData.append("status", status);
      if (afterImageFile) {
        formData.append("after_image", afterImageFile);
      }

      const response = await axios.post(
        `${WORKER_API_BASE}/my-complaints/${complaintId}/status/`,
        formData,
        authHeaders
      );

      setComplaints((prev) =>
        prev.map((item) => (item.id === complaintId ? response.data : item))
      );
      setAfterImageFiles((prev) => {
        const next = { ...prev };
        delete next[complaintId];
        return next;
      });
      setMessage(`Complaint updated to ${status}.`);
      setNowTick(Date.now());
      if (status === "Resolved") {
        fetchRanking();
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update complaint status.");
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleStartWork = (complaintId) => {
    updateComplaintStatus(complaintId, "In Progress");
  };

  const updateAlertStatus = async (alertId, status) => {
    clearAlerts();
    setAlertStatusLoadingId(alertId);
    try {
      const response = await axios.post(
        `${WORKER_API_BASE}/my-alerts/${alertId}/status/`,
        { status },
        authHeaders
      );
      setAlerts((prev) =>
        prev.map((item) => (item.id === alertId ? response.data : item))
      );
      setMessage(`Alert updated to ${status}.`);
      fetchAssignedComplaints();
      setNowTick(Date.now());
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update alert status.");
    } finally {
      setAlertStatusLoadingId(null);
    }
  };

  const handleResolved = (complaint) => {
    const selectedAfterImage = afterImageFiles[complaint.id];
    if (!selectedAfterImage && !complaint.after_image) {
      setError("Upload AFTER image before marking this complaint as resolved.");
      return;
    }
    updateComplaintStatus(complaint.id, "Resolved", selectedAfterImage || null);
  };

  const handleAfterImageSelect = (complaintId, file) => {
    setAfterImageFiles((prev) => ({
      ...prev,
      [complaintId]: file || null,
    }));
  };

  const handleSubmitAfterPhoto = (complaint) => {
    const selectedAfterImage = afterImageFiles[complaint.id];
    if (!selectedAfterImage) {
      setError("Select an AFTER image first.");
      return;
    }
    updateComplaintStatus(complaint.id, complaint.status, selectedAfterImage);
  };

  const toggleAiActions = (complaintId) => {
    setAiActionsVisible((prev) => ({
      ...prev,
      [complaintId]: !prev[complaintId],
    }));
  };

  const openImagePreview = (src, title) => {
    if (!src) return;
    setImagePreview({ src, title });
  };

  const closeImagePreview = () => {
    setImagePreview(null);
  };

  const openNavigation = (complaint) => {
    if (!hasCoordinates(complaint)) {
      setError("This item does not have valid toilet coordinates.");
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${complaint.toilet_latitude},${complaint.toilet_longitude}`,
      "_blank"
    );
  };

  const upsertToiletState = useCallback((updatedToilet) => {
    if (!updatedToilet?.id) return;
    setToilets((previous) => {
      const alreadyThere = previous.some((item) => item.id === updatedToilet.id);
      if (!alreadyThere) {
        return [updatedToilet, ...previous];
      }
      return previous.map((item) => (item.id === updatedToilet.id ? updatedToilet : item));
    });
  }, []);

  const runSimulationAction = useCallback(
    async (action, value = null) => {
      if (!selectedToiletId) {
        setError("Select a toilet to run simulation.");
        return;
      }

      clearAlerts();
      setQrCopied(false);
      setSimulationBusyAction(action);

      const simulationUrl = `${TOILETS_API_BASE}/simulate/${selectedToiletId}/`;
      const buildLegacyPayload = () => {
        if (action === "increase_usage") {
          return { action: "incraese_usage", value: value ?? 1 };
        }
        if (action === "bulk_usage") {
          return { action: "incraese_usage", value: value ?? 1 };
        }
        if (action === "peak_hour") {
          return { action: "incraese_usage", value: Math.floor(Math.random() * 21) + 30 };
        }
        if (action === "force_critical") {
          // Legacy fallback: force many users to guarantee critical threshold.
          return { action: "incraese_usage", value: 220 };
        }
        if (action === "reset") {
          return { action: "reset" };
        }
        return null;
      };

      try {
        const payload = { action };
        if (value !== null) {
          payload.value = value;
        }

        let response;
        try {
          response = await axios.post(simulationUrl, payload);
        } catch (err) {
          const errMsg = String(
            err?.response?.data?.error || err?.response?.data?.detail || ""
          ).toLowerCase();
          const fallbackPayload = buildLegacyPayload();
          if (!fallbackPayload || !errMsg.includes("invalid action")) {
            throw err;
          }
          response = await axios.post(simulationUrl, fallbackPayload);
        }

        const updatedToilet = response?.data?.toilet;
        if (updatedToilet) {
          upsertToiletState(updatedToilet);
        } else {
          fetchToilets();
        }
        setMessage(response?.data?.message || "Simulation action completed.");
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.detail ||
            "Could not run simulation action."
        );
      } finally {
        setSimulationBusyAction("");
      }
    },
    [selectedToiletId, fetchToilets, upsertToiletState]
  );

  const runQrSimulation = useCallback(async () => {
    if (!selectedToiletId) {
      setError("Select a toilet to run simulation.");
      return;
    }

    clearAlerts();
    setQrCopied(false);
    setSimulationBusyAction("qr_scan");

    try {
      let response;
      try {
        response = await axios.get(`${TOILETS_API_BASE}/simulate/${selectedToiletId}/`, {
          params: { users: 1, action: "incraese_usage", value: 1 },
        });
      } catch (_err) {
        response = await axios.post(`${TOILETS_API_BASE}/simulate/${selectedToiletId}/`, {
          action: "incraese_usage",
          value: 1,
        });
      }
      const updatedToilet = response?.data?.toilet;
      if (updatedToilet) {
        upsertToiletState(updatedToilet);
      } else {
        fetchToilets();
      }
      setMessage(response?.data?.message || "QR simulation completed.");
    } catch (err) {
      setError(
        err?.response?.data?.error || err?.response?.data?.detail || "QR simulation failed."
      );
    } finally {
      setSimulationBusyAction("");
    }
  }, [selectedToiletId, fetchToilets, upsertToiletState]);

  const handleCopyQrLink = useCallback(async () => {
    if (!qrSimulationUrl) return;
    try {
      await navigator.clipboard.writeText(qrSimulationUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 1800);
    } catch (_error) {
      setError("Could not copy QR link. You can copy it manually from the textbox.");
    }
  }, [qrSimulationUrl]);

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

  const isAuthView = view !== "dashboard";

  return (
    <div className={`worker-shell ${isAuthView ? "worker-shell-auth" : ""}`}>
      <div className={`worker-card ${isAuthView ? "worker-card-auth" : ""}`}>
        <div className={`worker-header ${isAuthView ? "worker-header-auth" : ""}`}>
          {isAuthView && <span className="worker-auth-kicker">{APP_NAME} Workforce</span>}
          <h1>{isAuthView ? `${APP_NAME} Worker Access` : `${APP_NAME} Worker Panel`}</h1>
          <p>
            {isAuthView
              ? "Secure login for complaint operations and live field updates."
              : "Assigned complaints and updates"}
          </p>
          {view === "dashboard" && worker && (
            <div className="worker-profile">
              <span>
                Logged in as <b>{worker.username}</b>
              </span>
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
              <div>
                <h2>{APP_NAME} Worker Dashboard</h2>
                <p>Fast complaint handling with map routing and SLA tracking.</p>
              </div>
              <div className="worker-dashboard-head-actions">
                <button
                  type="button"
                  onClick={() => {
                    fetchAssignedComplaints();
                    fetchAssignedAlerts();
                    fetchRanking();
                    fetchToilets();
                  }}
                  className="worker-refresh-btn"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="worker-live-dashboard">
              <article className="worker-live-card pending">
                <h3>Pending</h3>
                <p>{dashboardStats.pending}</p>
              </article>
              <article className="worker-live-card in-progress">
                <h3>In Progress</h3>
                <p>{dashboardStats.inProgress}</p>
              </article>
              <article className="worker-live-card resolved">
                <h3>Resolved Today</h3>
                <p>{dashboardStats.resolvedToday}</p>
              </article>
              <article className="worker-live-card total">
                <h3>Total Assigned</h3>
                <p>{dashboardStats.totalAssigned}</p>
              </article>
              <article className="worker-live-card avg">
                <h3>Avg Resolution Time</h3>
                <p>{formatAverageHours(dashboardStats.avgResolutionSeconds)}</p>
              </article>
              <article className="worker-live-card rank">
                <h3>Resolved by You</h3>
                <p>{workerResolvedCount}</p>
              </article>
            </div>

            <div className="worker-dashboard-tabs">
              <button
                type="button"
                className={dashboardTab === DASHBOARD_TAB_ASSIGNED ? "active" : ""}
                onClick={() => setDashboardTab(DASHBOARD_TAB_ASSIGNED)}
              >
                Assigned Operations
              </button>
              <button
                type="button"
                className={dashboardTab === DASHBOARD_TAB_ALERTS ? "active" : ""}
                onClick={() => setDashboardTab(DASHBOARD_TAB_ALERTS)}
              >
                Toilet Alerts
              </button>
              <button
                type="button"
                className={dashboardTab === DASHBOARD_TAB_RANKING ? "active" : ""}
                onClick={() => setDashboardTab(DASHBOARD_TAB_RANKING)}
              >
                Worker Ranking
              </button>
            </div>

            {dashboardTab === DASHBOARD_TAB_ASSIGNED && (
              <>
                <section className="worker-map-panel">
                  <div className="worker-section-head">
                    <h3>Assigned Complaints Map</h3>
                    <p>Marker Priority: Red High, Orange Medium, Green Low.</p>
                  </div>
                  <WorkerComplaintMap
                    complaints={mappableComplaints}
                    activeComplaintId={activeComplaintId}
                    onSelectComplaint={setActiveComplaintId}
                  />
                </section>

                <section className="worker-work-order">
                  <div className="worker-section-head">
                    <h3>Suggested Work Order</h3>
                    <p>
                      {workerLocation
                        ? `Location locked at ${workerLocation.lat.toFixed(4)}, ${workerLocation.lng.toFixed(4)}`
                        : "Waiting for worker location..."}
                    </p>
                  </div>
                  {locationError && <p className="worker-empty">{locationError}</p>}
                  {!locationError && workerLocation && complaintsByDistance.length === 0 && (
                    <p className="worker-empty">No mappable assigned complaints yet.</p>
                  )}
                  {!locationError && workerLocation && complaintsByDistance.length > 0 && (
                    <div className="worker-work-order-list">
                      {complaintsByDistance.map((complaint, index) => (
                        <div key={`work-order-${complaint.id}`} className="worker-work-order-item">
                          <span className="worker-work-order-index">{index + 1}</span>
                          <span className="worker-work-order-main">
                            <b>{complaint.toilet_name}</b>
                            <small>
                              {complaint.issue_type} - {complaint.distance.toFixed(2)} km away
                            </small>
                          </span>
                          <span className={`worker-priority ${getPriorityClass(complaint.priority)}`}>
                            {complaint.priority}
                          </span>
                          <span className="worker-work-order-actions">
                            <button
                              type="button"
                              className="worker-work-view-btn"
                              onClick={() => setActiveComplaintId(complaint.id)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="worker-work-nav-btn"
                              onClick={() => openNavigation(complaint)}
                            >
                              Navigate
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {loadingComplaints && <p className="worker-empty">Loading complaints...</p>}
                {!loadingComplaints && complaints.length === 0 && (
                  <p className="worker-empty">No complaints assigned yet.</p>
                )}

                <div className="worker-complaint-grid">
                  {sortedComplaints.map((complaint) => {
                    const suggestion = getSmartSuggestion(complaint.issue_type);
                    const beforeImage = complaint.before_image || complaint.image;
                    const selectedAfterFile = afterImageFiles[complaint.id];
                    const normalizedStatus = normalizeStatus(complaint.status);
                    const resolved = normalizedStatus === STATUS_RESOLVED;
                    const inProgress = normalizedStatus === STATUS_IN_PROGRESS;
                    const canStartWork = !resolved && statusLoadingId !== complaint.id;
                    const hasAfterImage = Boolean(complaint.after_image);
                    const canResolve = inProgress && hasAfterImage && statusLoadingId !== complaint.id;
                    const sla = getSlaMeta(complaint, nowTick);
                    const showAiActions = Boolean(aiActionsVisible[complaint.id]);

                    return (
                      <article
                        id={`complaint-${complaint.id}`}
                        key={complaint.id}
                        className={`worker-complaint-card priority-${getPriorityClass(
                          complaint.priority
                        )} ${activeComplaintId === complaint.id ? "active" : ""}`}
                      >
                        <div className="worker-complaint-top">
                          <h3>{complaint.toilet_name}</h3>
                          <div className="worker-chip-row">
                            <span className={`worker-priority ${getPriorityClass(complaint.priority)}`}>
                              {complaint.priority}
                            </span>
                            <span
                              className={`worker-status ${complaint.status
                                .toLowerCase()
                                .replace(" ", "-")}`}
                            >
                              {complaint.status}
                            </span>
                          </div>
                        </div>

                        <p>
                          <b>Issue:</b> {complaint.issue_type}
                        </p>
                        <p>
                          <b>Location:</b> {complaint.toilet_location}
                        </p>
                        <p>
                          <b>Description:</b> {complaint.description}
                        </p>

                        <div className={`worker-sla ${sla.tone}`}>
                          <span>{sla.text}</span>
                        </div>

                        {suggestion && (
                          <div className="worker-ai-suggestion">
                            <h4>Suggested AI Action</h4>
                            <p>{suggestion.title}</p>
                            <button
                              type="button"
                              className="worker-ai-toggle-btn"
                              onClick={() => toggleAiActions(complaint.id)}
                            >
                              {showAiActions ? "Hide AI Actions" : "Show AI Actions"}
                            </button>
                            {showAiActions && (
                              <ul>
                                {suggestion.lines.map((line) => (
                                  <li key={`${complaint.id}-${line}`}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        <div className="worker-image-compare">
                          <div className="worker-image-block">
                            <h4>Before (Citizen)</h4>
                            {beforeImage ? (
                              <>
                                <img src={beforeImage} alt={`Before complaint ${complaint.id}`} />
                                <button
                                  type="button"
                                  className="worker-full-image-btn"
                                  onClick={() =>
                                    openImagePreview(beforeImage, `Before Image - ${complaint.toilet_name}`)
                                  }
                                >
                                  View Full Image
                                </button>
                              </>
                            ) : (
                              <div className="worker-image-empty">No before image uploaded.</div>
                            )}
                          </div>
                          <div className="worker-image-block">
                            <h4>After (Worker)</h4>
                            {complaint.after_image ? (
                              <>
                                <img src={complaint.after_image} alt={`After complaint ${complaint.id}`} />
                                <button
                                  type="button"
                                  className="worker-full-image-btn"
                                  onClick={() =>
                                    openImagePreview(
                                      complaint.after_image,
                                      `After Image - ${complaint.toilet_name}`
                                    )
                                  }
                                >
                                  View Full Image
                                </button>
                              </>
                            ) : (
                              <div className="worker-image-empty">
                                Upload after-cleaning image to enable resolve.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="worker-upload-box">
                          <label htmlFor={`after-image-${complaint.id}`}>Upload AFTER Image</label>
                          <input
                            id={`after-image-${complaint.id}`}
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              handleAfterImageSelect(complaint.id, event.target.files?.[0] || null)
                            }
                            disabled={resolved || statusLoadingId === complaint.id}
                          />
                          {selectedAfterFile && <small>Selected: {selectedAfterFile.name}</small>}
                          <button
                            type="button"
                            className="worker-submit-photo-btn"
                            disabled={
                              resolved ||
                              statusLoadingId === complaint.id ||
                              !selectedAfterFile
                            }
                            onClick={() => handleSubmitAfterPhoto(complaint)}
                          >
                            {statusLoadingId === complaint.id ? "Submitting..." : "Submit After Photo"}
                          </button>
                        </div>

                        <div className="worker-status-actions">
                          <button
                            type="button"
                            className="worker-start-btn"
                            disabled={!canStartWork}
                            onClick={() => handleStartWork(complaint.id)}
                          >
                            {statusLoadingId === complaint.id
                              ? "Updating..."
                              : "Start Work"}
                          </button>
                          <button
                            type="button"
                            className="worker-resolve-btn"
                            disabled={resolved || !canResolve}
                            onClick={() => handleResolved(complaint)}
                          >
                            {resolved
                              ? "Resolved"
                              : statusLoadingId === complaint.id
                                ? "Updating..."
                                : "Mark Resolved"}
                          </button>
                          <button
                            type="button"
                            className="worker-navigate-btn"
                            disabled={!hasCoordinates(complaint)}
                            onClick={() => openNavigation(complaint)}
                          >
                            Navigate
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {dashboardTab === DASHBOARD_TAB_ALERTS && (
              <section className="worker-alerts-panel">
                <div className="worker-section-head">
                  <h3>Assigned Toilet Alerts</h3>
                  <p>Low water or low cleanliness alerts assigned to you.</p>
                </div>

                {loadingAlerts && <p className="worker-empty">Loading alerts...</p>}
                {!loadingAlerts && alerts.length === 0 && (
                  <p className="worker-empty">No alerts assigned right now.</p>
                )}

                {!loadingAlerts && alerts.length > 0 && (
                  <div className="worker-alert-grid">
                    {sortedAlerts.map((alert) => {
                      const isResolved = normalizeStatus(alert.status) === STATUS_RESOLVED;
                      const canResolveAlert = !isResolved && alertStatusLoadingId !== alert.id;

                      return (
                        <article
                          key={`toilet-alert-${alert.id}`}
                          className={`worker-alert-card priority-${getPriorityClass(alert.priority)} ${
                            isResolved ? "resolved" : ""
                          }`}
                        >
                          <div className="worker-alert-top">
                            <h3>{alert.toilet_name}</h3>
                            <div className="worker-chip-row">
                              <span className={`worker-priority ${getPriorityClass(alert.priority)}`}>
                                {alert.priority}
                              </span>
                              <span
                                className={`worker-status ${String(alert.status || "")
                                  .toLowerCase()
                                  .replace(" ", "-")}`}
                              >
                                {alert.status}
                              </span>
                            </div>
                          </div>

                          <p>
                            <b>Location:</b> {alert.toilet_location}
                          </p>
                          <p>
                            <b>Issue Alert:</b> {alert.alert_type}
                          </p>
                          <p>
                            <b>Alert Details:</b> {alert.message}
                          </p>
                          <p>
                            <b>Created:</b> {new Date(alert.created_at).toLocaleString()}
                          </p>
                          {alert.assigned_to_username && (
                            <p>
                              <b>Assigned Worker:</b> {alert.assigned_to_username}
                            </p>
                          )}

                          <div className="worker-status-actions">
                            <button
                              type="button"
                              className="worker-navigate-btn"
                              disabled={!hasCoordinates(alert)}
                              onClick={() => openNavigation(alert)}
                            >
                              Navigate
                            </button>
                            <button
                              type="button"
                              className="worker-resolve-btn"
                              disabled={!canResolveAlert}
                              onClick={() => updateAlertStatus(alert.id, "Resolved")}
                            >
                              {isResolved
                                ? "Resolved"
                                : alertStatusLoadingId === alert.id
                                  ? "Updating..."
                                  : "Resolve Alert"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {dashboardTab === DASHBOARD_TAB_SIMULATION && (
              <section className="worker-sim-panel">
                <div className="worker-section-head">
                  <h3>{APP_NAME} Judge Demo Simulation Panel</h3>
                  <button
                    type="button"
                    className="worker-refresh-btn"
                    onClick={fetchToilets}
                    disabled={loadingToilets}
                  >
                    {loadingToilets ? "Loading Toilets..." : "Refresh Toilets"}
                  </button>
                </div>

                {loadingToilets && toilets.length === 0 && (
                  <p className="worker-empty">Loading toilets...</p>
                )}

                {!loadingToilets && toilets.length === 0 && (
                  <p className="worker-empty">No toilets found. Add toilets to run demo simulation.</p>
                )}

                {toilets.length > 0 && (
                  <div className="worker-sim-grid">
                    <article className="worker-sim-card">
                      <h4>Toilet Selector</h4>
                      <label htmlFor="worker-simulation-toilet">Select Toilet</label>
                      <select
                        id="worker-simulation-toilet"
                        value={selectedToiletId}
                        onChange={(event) => setSelectedToiletId(event.target.value)}
                      >
                        {toilets.map((item) => (
                          <option key={`sim-toilet-${item.id}`} value={item.id}>
                            #{item.id} - {item.name} ({item.location})
                          </option>
                        ))}
                      </select>

                      {selectedToilet && (
                        <div className="worker-sim-live">
                          <div className="worker-sim-live-head">
                            <strong>{selectedToilet.name}</strong>
                            <span className={`worker-sim-status ${selectedToiletStatusClass}`}>
                              {selectedToilet.status}
                            </span>
                          </div>
                          <p>{selectedToilet.location}</p>
                          <div className="worker-sim-metrics">
                            <span>Usage: {selectedToilet.usage_count}</span>
                            <span
                              className={`metric-${getToiletMetricTone(
                                selectedToilet.cleanliness
                              )}`}
                            >
                              Cleanliness: {clampMetric(selectedToilet.cleanliness)}%
                            </span>
                            <span
                              className={`metric-${getToiletMetricTone(
                                selectedToilet.water_level
                              )}`}
                            >
                              Water: {clampMetric(selectedToilet.water_level)}%
                            </span>
                            <span
                              className={`metric-${getToiletMetricTone(
                                selectedToilet.health_score
                              )}`}
                            >
                              Health: {clampMetric(selectedToilet.health_score)}%
                            </span>
                            <span>Alert Level: {selectedToilet.alert_level}</span>
                          </div>
                          <div className="worker-sim-logic">
                            <h5>Auto Status Logic</h5>
                            <ul>
                              <li>Moderate: cleanliness below 70%</li>
                              <li>Critical: cleanliness below 40% or water below 20%</li>
                              <li>Good: all metrics healthy</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </article>

                    <article className="worker-sim-card">
                      <h4>Usage Simulation Shortcuts</h4>
                      <p>Use one tap shortcuts for quick demo of status transitions.</p>
                      <div className="worker-sim-action-grid">
                        <button
                          type="button"
                          onClick={() => runSimulationAction("increase_usage", 1)}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          +1 User
                        </button>
                        <button
                          type="button"
                          onClick={() => runSimulationAction("bulk_usage", 10)}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          +10 Users
                        </button>
                        <button
                          type="button"
                          onClick={() => runSimulationAction("bulk_usage", 20)}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          +20 Users
                        </button>
                        <button
                          type="button"
                          onClick={() => runSimulationAction("bulk_usage", 50)}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          +50 Users
                        </button>
                        <button
                          type="button"
                          onClick={() => runSimulationAction("peak_hour")}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          Peak Hour (30-50)
                        </button>
                      </div>
                    </article>

                    <article className="worker-sim-card">
                      <h4>Emergency and Reset</h4>
                      <p>
                        Trigger critical condition instantly, then reset to repeat demo for judges.
                      </p>
                      <div className="worker-sim-action-grid">
                        <button
                          type="button"
                          className="worker-sim-emergency-btn"
                          onClick={() => runSimulationAction("force_critical")}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          Trigger Emergency
                        </button>
                        <button
                          type="button"
                          className="worker-sim-reset-btn"
                          onClick={() => runSimulationAction("reset")}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          Reset Toilet
                        </button>
                      </div>
                      {isSimulationBusy && <p className="worker-sim-running">Running simulation...</p>}
                    </article>

                    <article className="worker-sim-card worker-sim-qr">
                      <h4>QR Simulation</h4>
                      <p>
                        Scan this QR to call <code>/simulate/&lt;toilet_id&gt;/?users=1</code> and
                        increment usage by one.
                      </p>
                      {qrImageUrl && (
                        <img
                          src={qrImageUrl}
                          alt={`QR simulation for toilet ${selectedToiletId}`}
                          className="worker-sim-qr-image"
                        />
                      )}
                      <input type="text" value={qrSimulationUrl} readOnly />
                      <div className="worker-sim-qr-actions">
                        <button
                          type="button"
                          onClick={handleCopyQrLink}
                          disabled={!qrSimulationUrl}
                        >
                          {qrCopied ? "Copied" : "Copy QR Link"}
                        </button>
                        <a href={qrSimulationUrl} target="_blank" rel="noreferrer">
                          Open QR Link
                        </a>
                        <button
                          type="button"
                          onClick={runQrSimulation}
                          disabled={isSimulationBusy || !selectedToilet}
                        >
                          Test QR (+1)
                        </button>
                      </div>
                    </article>
                  </div>
                )}
              </section>
            )}

            {dashboardTab === DASHBOARD_TAB_RANKING && (
              <section className="worker-ranking-panel">
                <div className="worker-section-head">
                  <h3>Worker Ranking Leaderboard</h3>
                  <button type="button" className="worker-refresh-btn" onClick={fetchRanking}>
                    Refresh Ranking
                  </button>
                </div>

                {loadingRanking && <p className="worker-empty">Loading ranking...</p>}
                {!loadingRanking && ranking.length === 0 && (
                  <p className="worker-empty">No ranking data available yet.</p>
                )}

                {!loadingRanking && ranking.length > 0 && (
                  <>
                    <div className="worker-ranking-podium">
                      {ranking.slice(0, 3).map((entry, index) => {
                        const score = Number(entry.resolved_complaints) || 0;
                        const progressWidth = Math.max(
                          10,
                          Math.round((score / rankingTopScore) * 100)
                        );

                        return (
                          <div
                            key={`${entry.staff_name}-podium`}
                            className={`worker-podium-card rank-${index + 1} ${
                              entry.staff_name === worker?.username ? "mine" : ""
                            }`}
                          >
                            <span className="worker-podium-rank-tag">#{index + 1}</span>
                            <div className="worker-podium-medal">{medalLabel(index + 1)}</div>
                            <h4>{entry.staff_name}</h4>
                            <p>{score} resolved</p>
                            <div className="worker-podium-meter">
                              <span style={{ width: `${progressWidth}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="worker-ranking-list">
                      {ranking.map((entry, index) => {
                        const score = Number(entry.resolved_complaints) || 0;
                        const progressWidth = Math.max(
                          8,
                          Math.round((score / rankingTopScore) * 100)
                        );
                        const gapFromTop = Math.max(0, rankingTopScore - score);

                        return (
                          <div
                            key={`${entry.staff_name}-${index}`}
                            className={`worker-ranking-row ${
                              entry.staff_name === worker?.username ? "mine" : ""
                            }`}
                          >
                            <span className="worker-ranking-position">#{index + 1}</span>
                            <span className="worker-ranking-name-wrap">
                              <span className="worker-ranking-name">{entry.staff_name}</span>
                              <span className="worker-ranking-tag">
                                {index === 0 ? "Top Performer" : `${gapFromTop} behind top`}
                              </span>
                            </span>
                            <span className="worker-ranking-score">{score} resolved</span>
                            <div className="worker-ranking-progress">
                              <span style={{ width: `${progressWidth}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        )}

        <footer className="worker-footer">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        </footer>

        {imagePreview && (
          <div className="worker-image-modal" onClick={closeImagePreview}>
            <div className="worker-image-modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="worker-image-modal-head">
                <h3>{imagePreview.title}</h3>
                <button type="button" onClick={closeImagePreview}>
                  Close
                </button>
              </div>
              <img src={imagePreview.src} alt={imagePreview.title} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkerApp;
