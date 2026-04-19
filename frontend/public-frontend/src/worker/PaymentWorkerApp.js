import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { QrReader } from "react-qr-reader";
import "./PaymentWorkerApp.css";

const API_BASE = (
  process.env.REACT_APP_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const PAYMENTS_API_BASE = `${API_BASE}/api/payments`;

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
};

const normalizeQrToken = (rawToken) => {
  const trimmed = String(rawToken || "").trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get("qr_token") || trimmed;
  } catch (_error) {
    return trimmed;
  }
};

const resolveScannerErrorMessage = (error) => {
  const rawMessage = String(error?.message || "").trim();
  const rawName = String(error?.name || "").trim();
  const normalized = `${rawName} ${rawMessage}`.toLowerCase();

  // Normal scan loop decode misses should not be shown as hard errors.
  if (
    normalized.includes("notfound") ||
    normalized.includes("no multiformat readers") ||
    normalized.includes("no qr code found") ||
    normalized.includes("checksum") ||
    normalized.includes("format")
  ) {
    return "";
  }

  if (
    normalized.includes("notallowed") ||
    normalized.includes("permission denied") ||
    normalized.includes("permission")
  ) {
    return "Camera permission denied. Allow camera access and restart scanner.";
  }

  if (
    normalized.includes("notreadable") ||
    normalized.includes("trackstarterror") ||
    normalized.includes("could not start video source")
  ) {
    return "Camera is in use by another app. Close other camera apps and retry.";
  }

  if (
    normalized.includes("secure origin") ||
    normalized.includes("secure context") ||
    normalized.includes("only secure")
  ) {
    return "Scanner works only on HTTPS or localhost.";
  }

  if (
    normalized.includes("notsupported") ||
    normalized.includes("media devices") ||
    normalized.includes("enumerateDevices")
  ) {
    return "This browser does not support camera scanning.";
  }

  return rawMessage || "Scanner error.";
};

function PaymentWorkerApp({ token, worker }) {
  const [code, setCode] = useState("");
  const [manualQrToken, setManualQrToken] = useState("");
  const [scanEnabled, setScanEnabled] = useState(true);
  const [scannerError, setScannerError] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState({ type: "", text: "" });
  const [revenue, setRevenue] = useState({
    total: 0,
    today_total: 0,
    verified_entries: 0,
    pending_entries: 0,
    per_toilet: [],
    transactions: [],
  });

  const lastScannedTokenRef = useRef("");
  const lastScanAtRef = useRef(0);

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Token ${token}`,
      },
    }),
    [token]
  );

  const fetchRevenue = useCallback(async () => {
    if (!token) return;
    setRevenueLoading(true);
    try {
      const response = await axios.get(`${PAYMENTS_API_BASE}/worker-revenue/`, authHeaders);
      setRevenue(response?.data || {});
      setScannerError("");
    } catch (error) {
      setStatusNotice({
        type: "error",
        text: error?.response?.data?.detail || "Could not load payment dashboard.",
      });
    } finally {
      setRevenueLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  useEffect(() => {
    if (!token) return undefined;
    const intervalId = window.setInterval(() => {
      fetchRevenue();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [token, fetchRevenue]);

  const verifyEntry = useCallback(
    async (payload) => {
      setVerifyBusy(true);
      setStatusNotice({ type: "", text: "" });
      try {
        const response = await axios.post(
          `${PAYMENTS_API_BASE}/verify-entry/`,
          payload,
          {
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const transaction = response?.data?.transaction || {};
        setStatusNotice({
          type: "success",
          text: `Verified: ${transaction.transaction_id || "Transaction"} | Toilet: ${
            transaction.toilet_name || "-"
          } | Amount: INR ${formatCurrency(transaction.amount)}`,
        });
        await fetchRevenue();
      } catch (error) {
        setStatusNotice({
          type: "error",
          text:
            error?.response?.data?.detail ||
            error?.response?.data?.error ||
            "Invalid code/QR token.",
        });
      } finally {
        setVerifyBusy(false);
      }
    },
    [token, fetchRevenue]
  );

  const verifyCode = useCallback(async () => {
    const cleanedCode = String(code || "").trim().toUpperCase();
    if (!cleanedCode) {
      setStatusNotice({ type: "error", text: "Enter a valid code." });
      return;
    }
    setCode(cleanedCode);
    await verifyEntry({ code: cleanedCode });
  }, [code, verifyEntry]);

  const verifyManualQr = useCallback(async () => {
    const cleanedToken = normalizeQrToken(manualQrToken);
    if (!cleanedToken) {
      setStatusNotice({ type: "error", text: "Enter a valid QR token." });
      return;
    }
    setManualQrToken(cleanedToken);
    await verifyEntry({ qr_token: cleanedToken });
  }, [manualQrToken, verifyEntry]);

  const handleQrResult = useCallback(
    async (result) => {
      const scannedRawText =
        (typeof result?.getText === "function" ? result.getText() : result?.text) || "";
      const scannedToken = normalizeQrToken(scannedRawText);
      if (!scannedToken) return;

      const now = Date.now();
      if (
        scannedToken === lastScannedTokenRef.current &&
        now - lastScanAtRef.current < 4000
      ) {
        return;
      }
      setScannerError("");
      lastScannedTokenRef.current = scannedToken;
      lastScanAtRef.current = now;
      await verifyEntry({ qr_token: scannedToken });
    },
    [verifyEntry]
  );

  useEffect(() => {
    if (!scanEnabled) {
      setScannerError("");
      return;
    }
    lastScannedTokenRef.current = "";
    lastScanAtRef.current = 0;
  }, [scanEnabled]);

  return (
    <div className="entry-dashboard">
      <div className="entry-dashboard-head">
        <div>
          <h2>Payment Worker Dashboard</h2>
          <p>
            Entry staff: verify citizen code/QR, approve access, and track collection.
          </p>
        </div>
        <button type="button" className="entry-refresh-btn" onClick={fetchRevenue} disabled={revenueLoading}>
          {revenueLoading ? "Refreshing..." : "Refresh Revenue"}
        </button>
      </div>

      <div className="entry-meta-row">
        <span>Logged in as <b>{worker?.username || "Worker"}</b></span>
        <span>Role: <b>{worker?.role || "Entry"}</b></span>
      </div>

      {statusNotice.text && (
        <div className={`entry-alert ${statusNotice.type === "success" ? "success" : "error"}`}>
          {statusNotice.text}
        </div>
      )}

      <div className="entry-grid">
        <section className="entry-card">
          <h3>Verify Code</h3>
          <p>Enter access code shown by citizen after payment.</p>
          <input
            type="text"
            value={code}
            placeholder="Enter access code"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button type="button" onClick={verifyCode} disabled={verifyBusy}>
            {verifyBusy ? "Verifying..." : "Verify Code"}
          </button>
        </section>

        <section className="entry-card">
          <h3>Scan QR</h3>
          <p>Scan citizen QR token from camera or verify manually below.</p>
          <button
            type="button"
            className="entry-scan-toggle"
            onClick={() => setScanEnabled((previous) => !previous)}
          >
            {scanEnabled ? "Stop Scanner" : "Start Scanner"}
          </button>
          {scanEnabled && (
            <div className="entry-qr-reader">
              <QrReader
                constraints={{ facingMode: { ideal: "environment" } }}
                onResult={(result, error) => {
                  if (result) {
                    handleQrResult(result);
                  }
                  if (error) {
                    const nextError = resolveScannerErrorMessage(error);
                    if (nextError) {
                      setScannerError(nextError);
                    }
                  }
                }}
              />
            </div>
          )}
          {scannerError && <small className="entry-scanner-error">{scannerError}</small>}

          <input
            type="text"
            value={manualQrToken}
            placeholder="Manual QR token"
            onChange={(event) => setManualQrToken(event.target.value)}
          />
          <button type="button" onClick={verifyManualQr} disabled={verifyBusy}>
            {verifyBusy ? "Verifying..." : "Verify QR Token"}
          </button>
        </section>

        <section className="entry-card">
          <h3>Revenue Dashboard</h3>
          <div className="entry-revenue-box">
            <div>
              <span>Total Collection</span>
              <strong>INR {formatCurrency(revenue.total)}</strong>
            </div>
            <div>
              <span>Today Collection</span>
              <strong>INR {formatCurrency(revenue.today_total)}</strong>
            </div>
            <div>
              <span>Verified Entries</span>
              <strong>{Number(revenue.verified_entries || 0)}</strong>
            </div>
            <div>
              <span>Pending Entries</span>
              <strong>{Number(revenue.pending_entries || 0)}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="entry-card entry-wide">
        <h3>Collection by Toilet</h3>
        {(revenue.per_toilet || []).length === 0 && <p>No transactions yet.</p>}
        {(revenue.per_toilet || []).length > 0 && (
          <div className="entry-table-wrap">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>Toilet</th>
                  <th>Transactions</th>
                  <th>Total (INR)</th>
                </tr>
              </thead>
              <tbody>
                {(revenue.per_toilet || []).map((item) => (
                  <tr key={`toilet-revenue-${item.toilet_id}`}>
                    <td>{item.toilet_name || `Toilet #${item.toilet_id}`}</td>
                    <td>{Number(item.transactions || 0)}</td>
                    <td>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="entry-card entry-wide">
        <h3>Recent Transactions</h3>
        {(revenue.transactions || []).length === 0 && <p>No transactions available.</p>}
        {(revenue.transactions || []).length > 0 && (
          <div className="entry-table-wrap">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Toilet</th>
                  <th>Amount (INR)</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Verified By</th>
                </tr>
              </thead>
              <tbody>
                {(revenue.transactions || []).map((item) => (
                  <tr key={`transaction-${item.id}`}>
                    <td>{item.transaction_id}</td>
                    <td>{item.toilet_name || `Toilet #${item.toilet_id}`}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</td>
                    <td>
                      <span className={`entry-status-chip ${item.is_verified ? "verified" : "pending"}`}>
                        {item.is_verified ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td>{item.verified_by || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default PaymentWorkerApp;
