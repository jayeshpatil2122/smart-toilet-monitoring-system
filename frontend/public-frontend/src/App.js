import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import appLogo from "./logo.svg";
import ComplaintForm from "./ComplaintForm.js";
import ToiletMap from "./components/ToiletMap";
import "./App.css";

const API_BASE = (
  process.env.REACT_APP_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const PORTAL_API_BASE = `${API_BASE}/api/workers/portal`;
const COMPLAINTS_API_BASE = `${API_BASE}/api/complaints`;
const TOILETS_API_BASE = `${API_BASE}/api/toilets`;
const SPLASH_DURATION_MS = 3500;
const LOGIN_BG_VIDEO_PATH =
  process.env.REACT_APP_LOGIN_BG_VIDEO_URL?.trim() || "https://cdn.pixabay.com/video/2021/10/05/90875-629483572_large.mp4";
const PROFILE_STORAGE_PREFIX = "portal_profile_meta_";
const DEFAULT_PROFILE_META = {
  phone: "",
  country: "",
  avatarData: "",
};

const SIDE_MENU_ITEMS = [
  { id: "profile", label: "View Profile", iconType: "profile" },
  { id: "toilets", label: "Show Toilets", iconType: "toilets" },
  { id: "complaints", label: "Complaints", iconType: "complaints" },
  { id: "contact", label: "Contact Us", iconType: "contact" },
  { id: "faq", label: "FAQs", iconType: "faq" },
  { id: "settings", label: "Settings", iconType: "settings" },
];

const CONTACT_INFO = {
  title: "City Toilet Response Cell",
  address: "Ward Office Complex, Main Civil Line, City Center",
  phone: "+91 90000 12345",
  email: "support@smarttoilet.local",
  supportHours: "Mon - Sat, 8:00 AM - 8:00 PM",
};

const FAQ_ITEMS = [
  {
    question: "How do I submit a complaint?",
    answer:
      "Open a toilet card, tap Submit Complaint, choose issue type, add details and submit.",
  },
  {
    question: "Where can I see my complaint status?",
    answer:
      "Open the Complaints section from the left menu to see Pending, In Progress, and Resolved updates.",
  },
  {
    question: "Can I update my profile details?",
    answer:
      "Yes. Use View Profile to upload DP, add phone/country, and save your details.",
  },
  {
    question: "How can I reset my password?",
    answer:
      "Use Forgot Password to get a reset code, then use the reset form in your profile section.",
  },
];

const parseJsonOr = (rawValue, fallbackValue) => {
  if (!rawValue) return fallbackValue;
  try {
    return JSON.parse(rawValue);
  } catch (_error) {
    return fallbackValue;
  }
};

const getProfileStorageKey = (username = "") => `${PROFILE_STORAGE_PREFIX}${username}`;
const EARTH_RADIUS_KM = 6371;

const hasCoordinates = (toilet) =>
  Number.isFinite(Number(toilet?.latitude)) && Number.isFinite(Number(toilet?.longitude));

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const PortalIcon = ({ type }) => {
  switch (type) {
    case "map":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18L3 20V6l6-2m0 14l6 2m-6-2V4m6 16l6-2V4l-6 2m0 14V6" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 21a8 8 0 10-16 0m8-9a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      );
    case "toilets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 21V3h9v18M5 10h9m5-4v11m-3 0h6M8 6h2m0 4h2m-2 4h2" />
        </svg>
      );
    case "complaints":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8v5m0 3h.01M10.3 3.9l-7 12.1A2 2 0 005 19h14a2 2 0 001.7-3l-7-12.1a2 2 0 00-3.4 0z" />
        </svg>
      );
    case "contact":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .4 2 .9 2.8a2 2 0 01-.5 2.1L8.1 10a16 16 0 005.9 5.9l1.4-1.4a2 2 0 012.1-.5c.9.5 1.8.8 2.8.9A2 2 0 0122 16.9z" />
        </svg>
      );
    case "faq":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.1 9a3 3 0 115.8 1c0 2-3 2-3 4m.1 4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5A3.5 3.5 0 1012 8a3.5 3.5 0 000 7.5zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.6 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
        </svg>
      );
    case "address":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22s7-5.8 7-12a7 7 0 10-14 0c0 6.2 7 12 7 12zm0-9a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .4 2 .9 2.8a2 2 0 01-.5 2.1L8.1 10a16 16 0 005.9 5.9l1.4-1.4a2 2 0 012.1-.5c.9.5 1.8.8 2.8.9A2 2 0 0122 16.9z" />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2zm0 2l8 5 8-5" />
        </svg>
      );
    case "time":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8v4l3 3m7-3a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v16m8-8H4" />
        </svg>
      );
  }
};

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
  const [portalProfile, setPortalProfile] = useState(() =>
    parseJsonOr(localStorage.getItem("portal_profile"), null)
  );

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

  const [activeSection, setActiveSection] = useState("map");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [portalTheme, setPortalTheme] = useState(localStorage.getItem("portal_theme") || "dark");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem("portal_notifications_enabled") !== "false"
  );
  const [compactCards, setCompactCards] = useState(
    localStorage.getItem("portal_compact_cards") === "true"
  );
  const [mapFilterMode, setMapFilterMode] = useState("default");
  const [nearestToiletInfo, setNearestToiletInfo] = useState(null);
  const [mapFilterMessage, setMapFilterMessage] = useState("");

  const [myComplaints, setMyComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState("");

  const [profileMeta, setProfileMeta] = useState({ ...DEFAULT_PROFILE_META });
  const [profileSaveNotice, setProfileSaveNotice] = useState("");
  const [profileResetData, setProfileResetData] = useState({ code: "", new_password: "" });
  const [profileResetLoading, setProfileResetLoading] = useState(false);
  const [profileResetMessage, setProfileResetMessage] = useState("");
  const [profileResetError, setProfileResetError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!portalToken) {
      setToilets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    axios
      .get(`${TOILETS_API_BASE}/`)
      .then((response) => {
        setToilets(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching toilets:", error);
        setLoading(false);
      });
  }, [portalToken]);

  useEffect(() => {
    if (!portalToken) return undefined;

    const intervalId = setInterval(() => {
      axios
        .get(`${TOILETS_API_BASE}/`)
        .then((response) => {
          setToilets(response.data);
        })
        .catch((error) => {
          console.error("Error refreshing toilets:", error);
        });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [portalToken]);

  const refreshMyComplaints = useCallback(async () => {
    if (!portalToken) return;
    setComplaintsLoading(true);
    setComplaintsError("");
    try {
      const response = await axios.get(`${COMPLAINTS_API_BASE}/my/`, {
        headers: { Authorization: `Token ${portalToken}` },
      });
      setMyComplaints(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setComplaintsError(error?.response?.data?.detail || "Unable to load your complaints.");
      setMyComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  }, [portalToken]);

  useEffect(() => {
    if (!portalToken) {
      setMyComplaints([]);
      return;
    }
    refreshMyComplaints();
  }, [portalToken, refreshMyComplaints]);

  useEffect(() => {
    const username = portalProfile?.username;
    if (!username) {
      setProfileMeta({ ...DEFAULT_PROFILE_META });
      return;
    }
    const parsedMeta = parseJsonOr(localStorage.getItem(getProfileStorageKey(username)), {});
    setProfileMeta({ ...DEFAULT_PROFILE_META, ...parsedMeta });
  }, [portalProfile?.username]);

  useEffect(() => {
    localStorage.setItem("portal_theme", portalTheme);
    document.body.classList.toggle("portal-light-mode", portalTheme === "light");
    return () => {
      document.body.classList.remove("portal-light-mode");
    };
  }, [portalTheme]);

  useEffect(() => {
    localStorage.setItem("portal_notifications_enabled", notificationsEnabled ? "true" : "false");
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("portal_compact_cards", compactCards ? "true" : "false");
  }, [compactCards]);

  useEffect(() => {
    if (focusedToiletId === null) return;
    const card = document.getElementById(`toilet-card-${focusedToiletId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedToiletId, activeSection, showAllToilets]);

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
      setActiveSection("map");
      setIsDrawerOpen(false);
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
    setActiveSection("map");
    setIsDrawerOpen(false);
    setMyComplaints([]);
    setMapFilterMode("default");
    setNearestToiletInfo(null);
    setMapFilterMessage("");
  };

  const openSection = (sectionId) => {
    setActiveSection(sectionId);
    setIsDrawerOpen(false);

    if (sectionId === "toilets") {
      setShowAllToilets(true);
      setDetailsOnlyId(null);
      setFocusedToiletId(null);
    }
  };

  const handleComplaintClick = (toiletId) => {
    setSelectedToilet(toiletId);
  };

  const handleComplaintSubmitted = async () => {
    await refreshMyComplaints();
  };

  const persistProfileMeta = (nextMeta, notice) => {
    const username = portalProfile?.username;
    if (!username) return;
    localStorage.setItem(getProfileStorageKey(username), JSON.stringify(nextMeta));
    setProfileSaveNotice(notice);
    setTimeout(() => setProfileSaveNotice(""), 2500);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const nextMeta = { ...profileMeta, avatarData: String(reader.result || "") };
      setProfileMeta(nextMeta);
      persistProfileMeta(nextMeta, "Profile photo updated.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleProfilePasswordReset = async (event) => {
    event.preventDefault();
    if (!portalProfile?.username) return;

    setProfileResetLoading(true);
    setProfileResetMessage("");
    setProfileResetError("");

    try {
      const response = await axios.post(`${PORTAL_API_BASE}/reset-password/`, {
        username: portalProfile.username,
        code: profileResetData.code,
        new_password: profileResetData.new_password,
      });
      setProfileResetMessage(response.data?.detail || "Password reset successful.");
      setProfileResetData({ code: "", new_password: "" });
    } catch (error) {
      setProfileResetError(error?.response?.data?.detail || "Password reset failed.");
    } finally {
      setProfileResetLoading(false);
    }
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

  const mappableToilets = useMemo(
    () => toilets.filter((toilet) => hasCoordinates(toilet)),
    [toilets]
  );

  const cleanestTopToilets = useMemo(() => {
    return [...mappableToilets]
      .sort((first, second) => {
        const cleanlinessDiff =
          Number(second.cleanliness || 0) - Number(first.cleanliness || 0);
        if (cleanlinessDiff !== 0) return cleanlinessDiff;
        return Number(second.health_score || 0) - Number(first.health_score || 0);
      })
      .slice(0, 5);
  }, [mappableToilets]);

  const nearestToiletData = useMemo(() => {
    if (!nearestToiletInfo) return null;
    return toilets.find((toilet) => toilet.id === nearestToiletInfo.toiletId) || null;
  }, [nearestToiletInfo, toilets]);

  const mapToilets = useMemo(() => {
    if (mapFilterMode === "nearby" && nearestToiletData) return [nearestToiletData];
    if (mapFilterMode === "cleanest" && cleanestTopToilets.length > 0) return cleanestTopToilets;
    return toilets;
  }, [mapFilterMode, nearestToiletData, cleanestTopToilets, toilets]);

  const mapHighlightedToiletIds = useMemo(() => {
    if (mapFilterMode === "nearby" && nearestToiletData) return [nearestToiletData.id];
    if (mapFilterMode === "cleanest" && cleanestTopToilets.length > 0) {
      return cleanestTopToilets.map((toilet) => toilet.id);
    }
    return highlightedToiletIds;
  }, [mapFilterMode, nearestToiletData, cleanestTopToilets, highlightedToiletIds]);

  const toiletLookup = useMemo(() => {
    const map = new Map();
    toilets.forEach((toilet) => map.set(toilet.id, toilet));
    return map;
  }, [toilets]);

  const complaintsStats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;

    myComplaints.forEach((complaint) => {
      if (complaint.status === "Pending") pending += 1;
      else if (complaint.status === "In Progress") inProgress += 1;
      else if (complaint.status === "Resolved") resolved += 1;
    });

    return { total: myComplaints.length, pending, inProgress, resolved };
  }, [myComplaints]);

  const displayName = useMemo(() => {
    const first = portalProfile?.first_name?.trim() || "";
    const last = portalProfile?.last_name?.trim() || "";
    const joined = `${first} ${last}`.trim();
    return joined || portalProfile?.username || "Citizen User";
  }, [portalProfile]);

  const profileInitial = useMemo(() => {
    const source = displayName || portalProfile?.username || "U";
    return String(source).charAt(0).toUpperCase();
  }, [displayName, portalProfile]);

  const handleViewDetailsFromMap = (toiletId) => {
    setSelectedToilet(null);
    setActiveSection("map");
    setShowAllToilets(true);
    setDetailsOnlyId(toiletId);
    setFocusedToiletId(toiletId);
  };

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

  const requestCurrentPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });

  const handleShowNearbyToilet = async () => {
    setMapFilterMessage("");
    setActiveSection("map");

    if (mappableToilets.length === 0) {
      setMapFilterMode("default");
      setMapFilterMessage("No toilets with location coordinates are available.");
      return;
    }

    try {
      const position = await requestCurrentPosition();
      const userLat = Number(position.coords.latitude);
      const userLng = Number(position.coords.longitude);

      let nearestToilet = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      mappableToilets.forEach((toilet) => {
        const distance = getDistanceKm(
          userLat,
          userLng,
          Number(toilet.latitude),
          Number(toilet.longitude)
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestToilet = toilet;
        }
      });

      if (!nearestToilet) {
        setMapFilterMode("default");
        setMapFilterMessage("Could not find a nearby toilet.");
        return;
      }

      setNearestToiletInfo({
        toiletId: nearestToilet.id,
        distanceKm: nearestDistance,
      });
      setMapFilterMode("nearby");
      setShowAllToilets(false);
      setDetailsOnlyId(null);
      setFocusedToiletId(null);
    } catch (_error) {
      setMapFilterMode("default");
      setMapFilterMessage("Please allow location access to find nearby toilets.");
    }
  };

  const handleShowCleanestToilets = () => {
    setMapFilterMessage("");
    setActiveSection("map");
    setNearestToiletInfo(null);

    if (cleanestTopToilets.length === 0) {
      setMapFilterMode("default");
      setMapFilterMessage("No toilets available for cleanliness ranking.");
      return;
    }

    setMapFilterMode("cleanest");
    setShowAllToilets(false);
    setDetailsOnlyId(null);
    setFocusedToiletId(null);
  };

  const handleShowAllMapPins = () => {
    setMapFilterMode("default");
    setNearestToiletInfo(null);
    setMapFilterMessage("");
  };

  const handleNavigateToToilet = (toilet) => {
    if (!toilet || !hasCoordinates(toilet)) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${toilet.latitude},${toilet.longitude}`,
      "_blank"
    );
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!query) return;
    if (matchingToilets.length > 0) {
      setMapFilterMode("default");
      setNearestToiletInfo(null);
      setMapFilterMessage("");
      handleViewDetailsFromMap(matchingToilets[0].id);
    }
  };

  const toggleLabel = !showAllToilets
    ? "Show All Toilets"
    : detailsOnlyId !== null
      ? "Show All Toilets"
      : "Hide All Toilets";

  const formatDateTime = (isoValue) => {
    if (!isoValue) return "-";
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const renderToiletCards = (cards, showDetailsNote = false) => (
    <div>
      {showDetailsNote && detailsOnlyId !== null && (
        <div className="details-mode-note">Showing selected toilet details</div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Finding toilets near you...</p>
        </div>
      )}

      {!loading && cards.length === 0 && (
        <div className="empty-state">
          <p>No toilets found in your area.</p>
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className={`toilets-grid ${compactCards ? "compact-layout" : ""}`}>
          {cards.map((toilet) => {
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
                  <span className={`status-badge ${statusClass}`}>{toilet.status || "Good"}</span>
                </div>

                <div className="toilet-kpi-row">
                  <div className="usage-count">
                    Used {toilet.usage_count || 0} times today
                  </div>
                </div>

                <div className="toilet-metrics">
                  <div className={`metric-item ${getMetricTone(healthValue)}`}>
                    <div className="metric-label">
                      <span className="metric-name">Health Score</span>
                      <span className="metric-value">{healthValue}%</span>
                    </div>
                    <div className="metric-bar">
                      <div className="metric-bar-fill health" style={{ width: `${healthValue}%` }}></div>
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
                      <div className="metric-bar-fill water" style={{ width: `${waterValue}%` }}></div>
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
  );

  const renderMapSection = () => (
    <>
      <section className="map-tools">
        <div className="map-quick-actions">
          <button
            type="button"
            className={`map-quick-btn ${mapFilterMode === "nearby" ? "active" : ""}`}
            onClick={handleShowNearbyToilet}
          >
            Nearby Toilets
          </button>
          <button
            type="button"
            className={`map-quick-btn ${mapFilterMode === "cleanest" ? "active" : ""}`}
            onClick={handleShowCleanestToilets}
          >
            Cleanest Toilets
          </button>
          {mapFilterMode !== "default" && (
            <button
              type="button"
              className="map-quick-btn map-quick-btn-reset"
              onClick={handleShowAllMapPins}
            >
              Show All Pins
            </button>
          )}
        </div>

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

        {mapFilterMessage && <div className="map-filter-message">{mapFilterMessage}</div>}

        {mapFilterMode === "nearby" && nearestToiletData && (
          <div className="map-focus-card">
            <div className="map-focus-head">
              <h4>Nearest Toilet</h4>
              <span>{nearestToiletInfo?.distanceKm?.toFixed(2)} km</span>
            </div>
            <p>{nearestToiletData.name}</p>
            <small>{nearestToiletData.location}</small>
            <div className="map-focus-actions">
              <button type="button" onClick={() => handleViewDetailsFromMap(nearestToiletData.id)}>
                Toilet Details
              </button>
              <button type="button" onClick={() => handleNavigateToToilet(nearestToiletData)}>
                Navigate
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="map-section">
        <ToiletMap
          toilets={mapToilets}
          highlightedToiletIds={mapHighlightedToiletIds}
          onSelectToilet={(id) => setSelectedToilet(id)}
          onViewDetails={handleViewDetailsFromMap}
        />
      </section>

      {mapFilterMode === "cleanest" && cleanestTopToilets.length > 0 && (
        <section className="cleanest-panel">
          <div className="cleanest-panel-head">
            <h3>Cleanest Toilets</h3>
            <p>Top 5 by cleanliness level</p>
          </div>

          <div className="cleanest-list">
            {cleanestTopToilets.map((toilet, index) => (
              <article
                key={toilet.id}
                className={`cleanest-item ${index === 0 ? "best" : ""}`}
              >
                <span className="cleanest-rank">#{index + 1}</span>
                <div className="cleanest-info">
                  <h4>{toilet.name}</h4>
                  <p>{toilet.location}</p>
                </div>
                <span className="cleanest-score">{clampPercentage(toilet.cleanliness)}%</span>
                <div className="cleanest-actions">
                  <button type="button" onClick={() => handleViewDetailsFromMap(toilet.id)}>
                    Details
                  </button>
                  <button type="button" onClick={() => handleNavigateToToilet(toilet)}>
                    Navigate
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="toilets-toggle-wrap">
        <button className="all-toilets-btn" onClick={handleToggleAllToilets}>
          {toggleLabel}
        </button>
      </div>

      {showAllToilets && renderToiletCards(visibleToilets, true)}
    </>
  );

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
        <video className="portal-auth-video" autoPlay muted loop playsInline>
          <source src={LOGIN_BG_VIDEO_PATH} type="video/mp4" />
        </video>
        <div className="portal-auth-aurora"></div>

        <div className="portal-auth-card-wrap">
          <div className="portal-auth-card">
            <div className="portal-auth-head">
              <img src={appLogo} alt="Portal Logo" className="portal-auth-logo" />
              <h1>User Access Portal</h1>
              <p>Secure entry required</p>
              <button
                type="button"
                className="portal-auth-sim-btn"
                onClick={() => window.location.assign("/simulation")}
              >
                Open Simulation Panel
              </button>
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
      </div>
    );
  }

  return (
    <div
      className={`app-container ${portalTheme === "light" ? "portal-theme-light" : ""} ${
        compactCards ? "portal-compact-cards" : ""
      }`}
    >
      <button
        type="button"
        className={`portal-menu-toggle ${isDrawerOpen ? "open" : ""}`}
        onClick={() => setIsDrawerOpen((prev) => !prev)}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div
        className={`portal-side-overlay ${isDrawerOpen ? "show" : ""}`}
        onClick={() => setIsDrawerOpen(false)}
      ></div>

      <aside className={`portal-side-drawer ${isDrawerOpen ? "open" : ""}`}>
        <button type="button" className="portal-side-close" onClick={() => setIsDrawerOpen(false)}>
          x
        </button>

        <button type="button" className="portal-side-profile" onClick={() => openSection("profile")}>
          <div className="portal-side-avatar">
            {profileMeta.avatarData ? <img src={profileMeta.avatarData} alt="DP" /> : <span>{profileInitial}</span>}
          </div>
          <div className="portal-side-profile-text">
            <strong>{portalProfile?.username || "Citizen"}</strong>
            <small>View Profile</small>
          </div>
        </button>

        <nav className="portal-side-nav">
          <button
            type="button"
            className={`portal-side-item ${activeSection === "map" ? "active" : ""}`}
            onClick={() => openSection("map")}
          >
            <span className="portal-side-icon"><PortalIcon type="map" /></span>
            <span>Map Home</span>
          </button>

          {SIDE_MENU_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`portal-side-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => openSection(item.id)}
            >
              <span className="portal-side-icon"><PortalIcon type={item.iconType} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="portal-side-logout" onClick={handlePortalLogout}>
          <span className="portal-side-icon"><PortalIcon type="logout" /></span>
          <span>Logout</span>
        </button>
      </aside>

      <header className="main-header">
        <p className="eyebrow">Citizen Toilet Portal</p>
        <h1>Smart Public Toilet</h1>
        <h2>Nearby Toilets</h2>
        <div className="portal-userbar">
          <span>Welcome, {displayName || portalProfile?.username || "User"} 👋</span>
        </div>
      </header>

      <main className="portal-main-content">
        {activeSection === "map" && renderMapSection()}

        {activeSection === "toilets" && (
          <section className="portal-content-panel">
            <div className="portal-panel-header">
              <h3>All Toilets</h3>
              <p>Complete card view with live status metrics</p>
            </div>
            {renderToiletCards(toilets, false)}
          </section>
        )}

        {activeSection === "complaints" && (
          <section className="portal-content-panel">
            <div className="portal-panel-header">
              <h3>My Complaints</h3>
              <p>Track all complaints submitted from your account</p>
            </div>

            <div className="portal-complaint-stats">
              <div className="complaint-stat-card"><span>Total</span><b>{complaintsStats.total}</b></div>
              <div className="complaint-stat-card pending"><span>Pending</span><b>{complaintsStats.pending}</b></div>
              <div className="complaint-stat-card inprogress"><span>In Progress</span><b>{complaintsStats.inProgress}</b></div>
              <div className="complaint-stat-card resolved"><span>Resolved</span><b>{complaintsStats.resolved}</b></div>
            </div>

            {complaintsLoading && <div className="portal-panel-empty"><p>Loading your complaints...</p></div>}
            {!complaintsLoading && complaintsError && <div className="portal-panel-error">{complaintsError}</div>}
            {!complaintsLoading && !complaintsError && myComplaints.length === 0 && (
              <div className="portal-panel-empty"><p>No complaints submitted yet.</p></div>
            )}

            {!complaintsLoading && myComplaints.length > 0 && (
              <div className="portal-complaints-list">
                {myComplaints.map((complaint) => {
                  const linkedToilet = toiletLookup.get(complaint.toilet);
                  const toiletName = complaint.toilet_name || linkedToilet?.name || `Toilet #${complaint.toilet}`;
                  return (
                    <article key={complaint.id} className="portal-complaint-card">
                      <div className="portal-complaint-head">
                        <h4>{complaint.issue_type}</h4>
                        <span className={`portal-status-chip ${complaint.status?.toLowerCase().replace(" ", "-")}`}>
                          {complaint.status}
                        </span>
                      </div>
                      <p className="portal-complaint-toilet">{toiletName}</p>
                      <p className="portal-complaint-desc">{complaint.description}</p>
                      <div className="portal-complaint-meta">
                        <span>Priority: {complaint.priority}</span>
                        <span>Submitted: {formatDateTime(complaint.created_at)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeSection === "profile" && (
          <section className="portal-content-panel profile-panel">
            <div className="portal-panel-header">
              <h3>My Profile</h3>
              <p>Manage your account details and password reset</p>
            </div>

            <div className="portal-profile-hero">
              <label className="portal-profile-avatar-wrap">
                {profileMeta.avatarData ? (
                  <img src={profileMeta.avatarData} alt="Profile" className="portal-profile-avatar-img" />
                ) : (
                  <span className="portal-profile-avatar-fallback">{profileInitial}</span>
                )}
                <input type="file" accept="image/*" onChange={handleAvatarChange} />
                <span className="portal-avatar-edit">Change Photo</span>
              </label>

              <div className="portal-profile-identity">
                <h4>{displayName}</h4>
                <p>@{portalProfile?.username || "user"}</p>
                <small>View Profile</small>
              </div>
            </div>

            <div className="portal-profile-grid">
              <label>
                Username
                <input type="text" value={portalProfile?.username || ""} readOnly />
              </label>
              <label>
                Email
                <input type="email" value={portalProfile?.email || ""} readOnly />
              </label>
              <label>
                Phone Number
                <input
                  type="text"
                  placeholder="+91..."
                  value={profileMeta.phone}
                  onChange={(event) => setProfileMeta({ ...profileMeta, phone: event.target.value })}
                />
              </label>
              <label>
                Country
                <input
                  type="text"
                  placeholder="India"
                  value={profileMeta.country}
                  onChange={(event) => setProfileMeta({ ...profileMeta, country: event.target.value })}
                />
              </label>
            </div>

            <button
              type="button"
              className="portal-action-btn"
              onClick={() => persistProfileMeta(profileMeta, "Profile details saved.")}
            >
              Save Profile Details
            </button>
            {profileSaveNotice && <div className="portal-auth-msg ok">{profileSaveNotice}</div>}

            <form className="portal-profile-reset-form" onSubmit={handleProfilePasswordReset}>
              <h4>Password Reset</h4>
              <p>Use reset code from Forgot Password, then set your new password here.</p>
              <input
                type="text"
                placeholder="Reset code"
                value={profileResetData.code}
                onChange={(event) =>
                  setProfileResetData((prev) => ({ ...prev, code: event.target.value }))
                }
                required
              />
              <input
                type="password"
                placeholder="New password"
                value={profileResetData.new_password}
                onChange={(event) =>
                  setProfileResetData((prev) => ({ ...prev, new_password: event.target.value }))
                }
                required
              />
              <button type="submit" disabled={profileResetLoading}>
                {profileResetLoading ? "Updating..." : "Reset Password"}
              </button>
              {profileResetMessage && <div className="portal-auth-msg ok">{profileResetMessage}</div>}
              {profileResetError && <div className="portal-auth-msg err">{profileResetError}</div>}
            </form>

            <div className="portal-submissions-box">
              <h4>Your Submitted Complaints</h4>
              <div className="portal-submission-inline"><span>Total:</span><strong>{complaintsStats.total}</strong></div>
              <div className="portal-submission-inline"><span>Pending:</span><strong>{complaintsStats.pending}</strong></div>
              <div className="portal-submission-inline"><span>In Progress:</span><strong>{complaintsStats.inProgress}</strong></div>
              <div className="portal-submission-inline"><span>Resolved:</span><strong>{complaintsStats.resolved}</strong></div>
            </div>
          </section>
        )}

        {activeSection === "contact" && (
          <section className="portal-content-panel">
            <div className="portal-panel-header">
              <h3>Contact Us</h3>
              <p>Support details for public toilet complaints and app help</p>
            </div>

            <div className="portal-contact-card">
              <h4>{CONTACT_INFO.title}</h4>
              <div className="portal-contact-row"><span className="portal-contact-icon"><PortalIcon type="address" /></span><p>{CONTACT_INFO.address}</p></div>
              <div className="portal-contact-row"><span className="portal-contact-icon"><PortalIcon type="phone" /></span><p>{CONTACT_INFO.phone}</p></div>
              <div className="portal-contact-row"><span className="portal-contact-icon"><PortalIcon type="email" /></span><p>{CONTACT_INFO.email}</p></div>
              <div className="portal-contact-row"><span className="portal-contact-icon"><PortalIcon type="time" /></span><p>{CONTACT_INFO.supportHours}</p></div>
            </div>
          </section>
        )}

        {activeSection === "faq" && (
          <section className="portal-content-panel">
            <div className="portal-panel-header">
              <h3>Frequently Asked Questions</h3>
              <p>Quick help for common citizen portal questions</p>
            </div>

            <div className="portal-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="portal-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {activeSection === "settings" && (
          <section className="portal-content-panel">
            <div className="portal-panel-header">
              <h3>Settings</h3>
              <p>Personalize your citizen panel experience</p>
            </div>

            <div className="portal-settings-grid">
              <button
                type="button"
                className={`portal-setting-tile ${portalTheme === "light" ? "active" : ""}`}
                onClick={() => setPortalTheme(portalTheme === "light" ? "dark" : "light")}
              >
                <span>Theme</span>
                <strong>{portalTheme === "light" ? "Light" : "Dark"}</strong>
              </button>

              <button
                type="button"
                className={`portal-setting-tile ${notificationsEnabled ? "active" : ""}`}
                onClick={() => setNotificationsEnabled((prev) => !prev)}
              >
                <span>Notifications</span>
                <strong>{notificationsEnabled ? "Enabled" : "Disabled"}</strong>
              </button>

              <button
                type="button"
                className={`portal-setting-tile ${compactCards ? "active" : ""}`}
                onClick={() => setCompactCards((prev) => !prev)}
              >
                <span>Compact Cards</span>
                <strong>{compactCards ? "On" : "Off"}</strong>
              </button>
            </div>
          </section>
        )}
      </main>

      {selectedToilet !== null && (
        <div className="modal-overlay" onClick={() => setSelectedToilet(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedToilet(null)}>
              x
            </button>
            <h2 className="modal-title">Submit Complaint</h2>
            <ComplaintForm
              toiletId={selectedToilet}
              portalToken={portalToken}
              onComplaintSubmitted={handleComplaintSubmitted}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

