import React, { useMemo } from "react";
import { t } from "../constants/translations";
import "./NearestToiletsSection.css";

const EARTH_RADIUS_KM = 6371;

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

function NearestToiletsSection({
  toilets = [],
  userLocation = null,
  language = "en",
  buildMapsDirectionUrl = () => "",
  onViewDetails = () => {},
  onReportIssue = null,
}) {
  const nearestToilets = useMemo(() => {
    if (!toilets || toilets.length === 0) return [];
    if (!userLocation?.latitude || !userLocation?.longitude) {
      // If user location is not ready, take first 4 mappable toilets
      return toilets
        .filter((t) => Number.isFinite(Number(t.latitude)) && Number.isFinite(Number(t.longitude)))
        .slice(0, 4)
        .map((t) => ({ ...t, distanceKm: null }));
    }

    const userLat = Number(userLocation.latitude);
    const userLng = Number(userLocation.longitude);

    const withDistance = toilets
      .filter((t) => Number.isFinite(Number(t.latitude)) && Number.isFinite(Number(t.longitude)))
      .map((toilet) => ({
        ...toilet,
        distanceKm: getDistanceKm(
          userLat,
          userLng,
          Number(toilet.latitude),
          Number(toilet.longitude)
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return withDistance.slice(0, 4);
  }, [toilets, userLocation]);

  const formatDistance = (distKm) => {
    if (distKm === null || distKm === undefined) return null;
    if (distKm < 1) {
      return `${Math.round(distKm * 1000)} m`;
    }
    return `${distKm.toFixed(2)} km`;
  };

  const getStatusBadge = (status) => {
    const norm = String(status || "").toLowerCase();
    if (norm === "critical") return { label: t("status_critical", language), color: "#ef4444" };
    if (norm === "moderate") return { label: t("status_moderate", language), color: "#f59e0b" };
    if (norm === "in use") return { label: t("status_in_use", language), color: "#f97316" };
    if (norm === "free") return { label: t("status_free", language), color: "#22c55e" };
    return { label: t("status_good", language), color: "#10b981" };
  };

  if (!toilets || toilets.length === 0) return null;

  return (
    <section className="nearest-toilets-section">
      <div className="nearest-toilets-header">
        <div className="nearest-header-title-wrap">
          <h3 className="nearest-section-title">
            <span className="title-icon">📍</span> {t("nearest_toilets_heading", language)}
          </h3>
          <p className="nearest-section-subtitle">
            {t("nearest_toilets_subheading", language)}
          </p>
        </div>
        {userLocation?.latitude && userLocation?.longitude && (
          <span className="live-gps-badge">
            <span className="gps-dot"></span> {t("live_gps", language)}
          </span>
        )}
      </div>

      <div className="nearest-toilets-grid">
        {nearestToilets.map((toilet) => {
          const badge = getStatusBadge(toilet.status);
          const distStr = formatDistance(toilet.distanceKm);

          return (
            <div key={toilet.id} className="nearest-toilet-card">
              <div className="nearest-card-head">
                <h4 className="nearest-toilet-name" title={toilet.name}>
                  🚻 {toilet.name}
                </h4>
                <span
                  className="nearest-status-badge"
                  style={{
                    backgroundColor: `${badge.color}20`,
                    color: badge.color,
                    borderColor: `${badge.color}50`,
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <p className="nearest-toilet-location">{toilet.location}</p>

              <div className="nearest-card-footer">
                <div className="nearest-distance-info">
                  {distStr ? (
                    <span className="distance-tag">
                      📍 <strong>{distStr}</strong> {t("away", language)}
                    </span>
                  ) : (
                    <span className="distance-tag muted">
                      📍 {t("detecting_location", language)}
                    </span>
                  )}
                </div>

                <div className="nearest-card-actions">
                  <button
                    type="button"
                    className="nearest-details-btn"
                    onClick={() => onViewDetails(toilet.id)}
                  >
                    {t("view_details", language)}
                  </button>
                  {onReportIssue && (
                    <button
                      type="button"
                      className="nearest-details-btn"
                      style={{ background: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}
                      onClick={() => onReportIssue(toilet.id)}
                    >
                      {t("submit_complaint", language)}
                    </button>
                  )}
                  <button
                    type="button"
                    className="nearest-navigate-btn"
                    onClick={() => {
                      window.open(
                        buildMapsDirectionUrl(
                          toilet.latitude,
                          toilet.longitude,
                          userLocation?.latitude,
                          userLocation?.longitude
                        ),
                        "_blank"
                      );
                    }}
                  >
                    {t("navigate", language)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default NearestToiletsSection;
