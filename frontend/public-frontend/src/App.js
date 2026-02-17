import React, { useEffect, useState } from "react";
import axios from "axios";
import ComplaintForm from "./ComplaintForm.js";
import ToiletMap from "./components/ToiletMap";
import "./App.css";

function App() {
  const [toilets, setToilets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToilet, setSelectedToilet] = useState(null);
  const [showAllToilets, setShowAllToilets] = useState(false);

  // Fetch toilets
  useEffect(() => {
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
  }, []);

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

  return (
    <div className="app-container">

      {/* HEADER */}
      <header className="main-header">
        <h1>Smart Public Toilet</h1>
        <h2>📍 Nearby Toilets</h2>
      </header>

      {/* MAP */}
      <div style={{ margin: "30px 0" }}>
        <ToiletMap
          toilets={toilets}
          onSelectToilet={(id) => setSelectedToilet(id)}
        />
      </div>

      {/* TOGGLE BUTTON */}
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          className="all-toilets-btn"
          onClick={() => setShowAllToilets(!showAllToilets)}
        >
          📋 {showAllToilets ? "Hide All Toilets" : "All Toilets"}
        </button>
      </div>

      {/* SHOW ALL TOILETS SECTION */}
      {showAllToilets && (
        <div>

          {/* Loading */}
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Finding toilets near you...</p>
            </div>
          )}

          {/* Empty */}
          {!loading && toilets.length === 0 && (
            <div className="empty-state">
              <p>No toilets found in your area.</p>
            </div>
          )}

          {/* Grid */}
          {!loading && toilets.length > 0 && (
            <div className="toilets-grid">
              {toilets.map((toilet) => (
                <div key={toilet.id} className="toilet-card">

                  <div className="toilet-card-header">
                    <div>
                      <h3 className="toilet-name">{toilet.name}</h3>
                      <p className="toilet-location">
                        📍 {toilet.location}
                      </p>
                    </div>

                    <span
                      className={`status-badge ${getStatusClass(toilet.status)}`}
                    >
                      {toilet.status || "Good"}
                    </span>
                  </div>

                  <div className="usage-count">
                    👥 Used {toilet.usage_count || 0} times today
                  </div>

                  <div className="toilet-metrics">

                    {/* Health */}
                    <div className="metric-item">
                      <div className="metric-label">
                        <span>❤️ Health Score</span>
                        <span className="metric-value">
                          {toilet.health_score || 0}%
                        </span>
                      </div>
                      <div className="metric-bar">
                        <div
                          className="metric-bar-fill health"
                          style={{ width: `${toilet.health_score || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Cleanliness */}
                    <div className="metric-item">
                      <div className="metric-label">
                        <span>✨ Cleanliness</span>
                        <span className="metric-value">
                          {toilet.cleanliness || 0}%
                        </span>
                      </div>
                      <div className="metric-bar">
                        <div
                          className="metric-bar-fill cleanliness"
                          style={{ width: `${toilet.cleanliness || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Water */}
                    <div className="metric-item">
                      <div className="metric-label">
                        <span>💧 Water Level</span>
                        <span className="metric-value">
                          {toilet.water_level || 0}%
                        </span>
                      </div>
                      <div className="metric-bar">
                        <div
                          className="metric-bar-fill water"
                          style={{ width: `${toilet.water_level || 0}%` }}
                        ></div>
                      </div>
                    </div>

                  </div>

                  <button
                    className="complaint-btn"
                    onClick={() => handleComplaintClick(toilet.id)}
                  >
                    📝 Submit Complaint
                  </button>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {selectedToilet !== null && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedToilet(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setSelectedToilet(null)}
            >
              ✕
            </button>

            <h2 className="modal-title">📝 Submit Complaint</h2>
            <ComplaintForm toiletId={selectedToilet} />
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
