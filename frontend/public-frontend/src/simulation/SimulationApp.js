import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./SimulationApp.css";

const API_BASE = (
  process.env.REACT_APP_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const TOILETS_API_BASE = `${API_BASE}/api/toilets`;
const FRONTEND_ORIGIN = window.location.origin;
const SIMULATION_SCAN_PATH_PREFIX = "/simulation/scan";

const clampMetric = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const metricTone = (value) => {
  const safe = clampMetric(value);
  if (safe < 40) return "critical";
  if (safe < 70) return "warning";
  return "healthy";
};

const statusClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "moderate") return "moderate";
  return "good";
};

const parsePositiveInt = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

function SimulationApp() {
  const [toilets, setToilets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [selectedToiletId, setSelectedToiletId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrCopied, setQrCopied] = useState(false);
  const [scanProcessed, setScanProcessed] = useState(false);

  const isScanRoute = window.location.pathname.startsWith(SIMULATION_SCAN_PATH_PREFIX);
  const scanQuery = useMemo(() => new URLSearchParams(window.location.search), []);
  const scanToiletId = String(
    scanQuery.get("toilet_id") || scanQuery.get("toilet") || ""
  ).trim();
  const scanUsers = parsePositiveInt(scanQuery.get("users"), 1);

  const clearNotices = () => {
    setMessage("");
    setError("");
  };

  const fetchToilets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${TOILETS_API_BASE}/`);
      const next = Array.isArray(response.data) ? response.data : [];
      setToilets(next);
      setSelectedToiletId((previous) => {
        if (previous && next.some((item) => String(item.id) === String(previous))) {
          return previous;
        }
        return next.length > 0 ? String(next[0].id) : "";
      });
    } catch (_err) {
      setError("Could not load toilets.");
      setToilets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToilets();
  }, [fetchToilets]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchToilets();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [fetchToilets]);

  useEffect(() => {
    setQrCopied(false);
  }, [selectedToiletId]);

  const selectedToilet = useMemo(() => {
    if (!selectedToiletId) return null;
    return toilets.find((item) => String(item.id) === String(selectedToiletId)) || null;
  }, [toilets, selectedToiletId]);

  const qrSimulationUrl = useMemo(() => {
    if (!selectedToiletId) return "";
    return `${FRONTEND_ORIGIN}/simulation/scan?toilet_id=${selectedToiletId}&users=1`;
  }, [selectedToiletId]);

  const qrImageUrl = useMemo(() => {
    if (!qrSimulationUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      qrSimulationUrl
    )}`;
  }, [qrSimulationUrl]);

  const upsertToilet = useCallback((updatedToilet) => {
    if (!updatedToilet?.id) return;
    setToilets((prev) =>
      prev.map((item) => (item.id === updatedToilet.id ? updatedToilet : item))
    );
  }, []);

  const incrementUsageWithFallback = useCallback(async (toiletId, users) => {
    const simulationUrl = `${TOILETS_API_BASE}/simulate/${toiletId}/`;
    const attempts = [
      { action: "increase_usage", value: users },
      { action: "bulk_usage", value: users },
      { action: "incraese_usage", value: users },
    ];

    let lastError = null;
    for (const payload of attempts) {
      try {
        return await axios.post(simulationUrl, payload);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }, []);

  const runAction = useCallback(
    async (action, value = null) => {
      if (!selectedToiletId) return;
      clearNotices();
      setBusy(action);
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
          // Legacy fallback: enough usage to always cross critical threshold.
          return { action: "incraese_usage", value: 220 };
        }
        if (action === "reset") {
          return { action: "reset" };
        }
        return null;
      };
      try {
        const payload = { action };
        if (value !== null) payload.value = value;

        let response;
        try {
          response = await axios.post(simulationUrl, payload);
        } catch (err) {
          const errMsg = String(err?.response?.data?.error || err?.response?.data?.detail || "").toLowerCase();
          const fallbackPayload = buildLegacyPayload();
          if (!fallbackPayload || !errMsg.includes("invalid action")) {
            throw err;
          }
          response = await axios.post(simulationUrl, fallbackPayload);
        }
        const updated = response?.data?.toilet;
        if (updated) {
          upsertToilet(updated);
        } else {
          fetchToilets();
        }
        setMessage(response?.data?.message || "Simulation completed.");
      } catch (err) {
        setError(err?.response?.data?.error || "Simulation action failed.");
      } finally {
        setBusy("");
      }
    },
    [selectedToiletId, upsertToilet, fetchToilets]
  );

  const runQrTest = useCallback(async () => {
    if (!selectedToiletId) return;
    clearNotices();
    setBusy("qr");
    try {
      const response = await incrementUsageWithFallback(selectedToiletId, 1);
      const updated = response?.data?.toilet;
      if (updated) {
        upsertToilet(updated);
      } else {
        fetchToilets();
      }
      setMessage(response?.data?.message || "QR simulation completed.");
    } catch (err) {
      setError(err?.response?.data?.error || "QR simulation failed.");
    } finally {
      setBusy("");
    }
  }, [selectedToiletId, upsertToilet, fetchToilets, incrementUsageWithFallback]);

  const handleCopyQrLink = useCallback(async () => {
    if (!qrSimulationUrl) return;
    try {
      await navigator.clipboard.writeText(qrSimulationUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 1800);
    } catch (_error) {
      setError("Could not copy QR link.");
    }
  }, [qrSimulationUrl]);

  useEffect(() => {
    if (!isScanRoute || !scanToiletId || scanProcessed) return;

    let ignore = false;
    const recordScan = async () => {
      clearNotices();
      setBusy("scan");
      try {
        const response = await incrementUsageWithFallback(scanToiletId, scanUsers);
        if (ignore) return;

        setSelectedToiletId(String(scanToiletId));
        const updated = response?.data?.toilet;
        if (updated) {
          upsertToilet(updated);
        } else {
          fetchToilets();
        }
        setMessage(response?.data?.message || `QR simulation recorded ${scanUsers} user(s).`);
      } catch (err) {
        if (ignore) return;
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.detail ||
            "QR simulation failed."
        );
      } finally {
        if (!ignore) {
          setBusy("");
          setScanProcessed(true);
        }
      }
    };

    recordScan();
    return () => {
      ignore = true;
    };
  }, [
    isScanRoute,
    scanToiletId,
    scanUsers,
    scanProcessed,
    incrementUsageWithFallback,
    upsertToilet,
    fetchToilets,
  ]);

  return (
    <div className="sim-shell">
      <div className="sim-card">
        <div className="sim-head">
          <div>
            <h1>Simulation Panel</h1>
            <p>Standalone judge demo panel for per-toilet simulation.</p>
          </div>
          <button type="button" onClick={fetchToilets} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div className="sim-alert success">{message}</div>}
        {error && <div className="sim-alert error">{error}</div>}

        {toilets.length === 0 && !loading && <p className="sim-empty">No toilets found.</p>}

        {toilets.length > 0 && (
          <div className="sim-grid">
            <article className="sim-panel">
              <h3>Select Toilet</h3>
              <select
                value={selectedToiletId}
                onChange={(event) => setSelectedToiletId(event.target.value)}
              >
                {toilets.map((item) => (
                  <option key={`sim-${item.id}`} value={item.id}>
                    #{item.id} - {item.name}
                  </option>
                ))}
              </select>

              {selectedToilet && (
                <div className="sim-live-box">
                  <div className="sim-live-head">
                    <strong>{selectedToilet.name}</strong>
                    <span className={`sim-status ${statusClass(selectedToilet.status)}`}>
                      {selectedToilet.status}
                    </span>
                  </div>
                  <p>{selectedToilet.location}</p>
                  <div className="sim-metrics">
                    <span>Usage: {selectedToilet.usage_count}</span>
                    <span className={`metric-${metricTone(selectedToilet.cleanliness)}`}>
                      Cleanliness: {clampMetric(selectedToilet.cleanliness)}%
                    </span>
                    <span className={`metric-${metricTone(selectedToilet.water_level)}`}>
                      Water: {clampMetric(selectedToilet.water_level)}%
                    </span>
                    <span className={`metric-${metricTone(selectedToilet.health_score)}`}>
                      Health: {clampMetric(selectedToilet.health_score)}%
                    </span>
                    <span>Alert Level: {selectedToilet.alert_level}</span>
                  </div>
                </div>
              )}
            </article>

            <article className="sim-panel">
              <h3>Usage Buttons</h3>
              <div className="sim-action-grid">
                <button type="button" disabled={Boolean(busy)} onClick={() => runAction("increase_usage", 1)}>
                  +1 User
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => runAction("bulk_usage", 10)}>
                  +10 Users
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => runAction("bulk_usage", 20)}>
                  +20 Users
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => runAction("bulk_usage", 50)}>
                  +50 Users
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => runAction("peak_hour")}>
                  Peak Hour (30-50)
                </button>
              </div>
              <div className="sim-action-grid">
                <button
                  type="button"
                  className="emergency"
                  disabled={Boolean(busy)}
                  onClick={() => runAction("force_critical")}
                >
                  Trigger Emergency
                </button>
                <button
                  type="button"
                  className="reset"
                  disabled={Boolean(busy)}
                  onClick={() => runAction("reset")}
                >
                  Reset Toilet
                </button>
              </div>
            </article>

            <article className="sim-panel">
              <h3>QR Simulation</h3>
              <p>Each toilet has a different QR URL.</p>
              {qrImageUrl && <img src={qrImageUrl} alt={`QR for toilet ${selectedToiletId}`} />}
              <input type="text" value={qrSimulationUrl} readOnly />
              <div className="sim-qr-actions">
                <button type="button" onClick={handleCopyQrLink} disabled={!qrSimulationUrl}>
                  {qrCopied ? "Copied" : "Copy QR Link"}
                </button>
                <a href={qrSimulationUrl} target="_blank" rel="noreferrer">
                  Open QR Link
                </a>
                <button type="button" disabled={Boolean(busy)} onClick={runQrTest}>
                  Test QR (+1)
                </button>
              </div>
            </article>

            <article className="sim-panel">
              <h3>All Toilets Snapshot</h3>
              <div className="sim-list">
                {toilets.map((item) => (
                  <div
                    key={`snap-${item.id}`}
                    className={`sim-list-row ${String(item.id) === String(selectedToiletId) ? "active" : ""}`}
                  >
                    <span>
                      #{item.id} {item.name}
                    </span>
                    <span>{item.usage_count} users</span>
                    <span className={`sim-status ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

export default SimulationApp;
