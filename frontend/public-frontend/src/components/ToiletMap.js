import React, { useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import {
  DEFAULT_MAP_CENTER_COORDS,
  buildMapsDirectionUrl,
} from "../constants/fixedLocation";

import { t } from "../constants/translations";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const createCustomIcon = (status, highlighted = false) => {
  let color = "#10b981";
  if (status === "Moderate") color = "#f59e0b";
  if (status === "Critical") color = "#ef4444";
  if (String(status || "").toLowerCase() === "in use") color = "#f97316";
  if (String(status || "").toLowerCase() === "free") color = "#22c55e";

  const ringColor = highlighted ? "#22d3ee" : "transparent";
  const ringOpacity = highlighted ? "0.45" : "0";
  const scale = highlighted ? 1.1 : 1;

  const svgIcon = `
    <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
      <g transform="scale(${scale}) translate(${highlighted ? "-2" : "0"}, ${highlighted ? "-2" : "0"})">
        <ellipse cx="18" cy="18" rx="15" ry="15" fill="${ringColor}" opacity="${ringOpacity}" />
        <path d="M18 0C8.059 0 0 8.059 0 18c0 12.5 18 30 18 30s18-17.5 18-30C36 8.059 27.941 0 18 0z" fill="${color}" />
        <circle cx="18" cy="17" r="9" fill="white"/>
        <circle cx="18" cy="17" r="6" fill="${color}"/>
      </g>
    </svg>
  `;

  return new L.DivIcon({
    html: svgIcon,
    className: `custom-marker-icon ${highlighted ? "map-pin-highlight" : ""}`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48],
  });
};

const createUserLocationIcon = () => {
  const html = `
    <div class="user-location-marker-container">
      <div class="user-location-pulse"></div>
      <div class="user-location-dot"></div>
    </div>
  `;
  return new L.DivIcon({
    html,
    className: "custom-user-location-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

function UserLocationMarker({ userLocation, language = "en" }) {
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return null;
  }

  const userCoords = [userLocation.latitude, userLocation.longitude];
  const icon = createUserLocationIcon();

  return (
    <>
      {userLocation.accuracy && (
        <Circle
          center={userCoords}
          radius={Math.min(userLocation.accuracy, 500)}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 1.5,
          }}
        />
      )}
      <Marker position={userCoords} icon={icon} zIndexOffset={1000}>
        <Popup className="custom-popup user-location-popup">
          <div style={{ textAlign: "center", padding: "4px 8px" }}>
            <strong style={{ color: "#2563eb", fontSize: "14px", display: "block", marginBottom: "2px" }}>
              🔵 {t("your_location", language)}
            </strong>
            <span style={{ color: "#64748b", fontSize: "11px" }}>
              {t("live_gps", language)} ({userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)})
            </span>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

function MapViewportController({ userLocation, centerTrigger }) {
  const map = useMap();
  const initialCenteredRef = useRef(false);
  const prevTriggerRef = useRef(centerTrigger);

  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      if (!initialCenteredRef.current) {
        map.flyTo([userLocation.latitude, userLocation.longitude], 16, {
          duration: 1.2,
        });
        initialCenteredRef.current = true;
      }
    }
  }, [map, userLocation]);

  useEffect(() => {
    if (centerTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = centerTrigger;
      if (userLocation?.latitude && userLocation?.longitude) {
        map.flyTo([userLocation.latitude, userLocation.longitude], 16, {
          duration: 1.0,
        });
      }
    }
  }, [map, userLocation, centerTrigger]);

  return null;
}

function MyLocationButton({ userLocation, onRequestLocation, onCenterUser }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (userLocation?.latitude && userLocation?.longitude) {
      onCenterUser();
    } else {
      onRequestLocation();
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: "10px", marginRight: "10px", zIndex: 1000 }}>
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={handleClick}
          className="my-location-control-btn"
          title="Recenter on My Location"
          aria-label="Recenter on My Location"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8"></circle>
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToiletMap({
  toilets,
  onSelectToilet,
  onViewDetails,
  highlightedToiletIds = [],
  userLocation = null,
  onRequestLocation = () => {},
  language = "en",
}) {
  const [centerTrigger, setCenterTrigger] = useState(0);
  const highlightedSet = new Set(highlightedToiletIds);

  const initialCenter = userLocation?.latitude && userLocation?.longitude
    ? [userLocation.latitude, userLocation.longitude]
    : DEFAULT_MAP_CENTER_COORDS;

  const getSafeGasValue = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const getToiletTypeSymbols = (toiletType) => {
    const normalized = String(toiletType || "").trim().toLowerCase();
    if (normalized === "male") return "♂";
    if (normalized === "female") return "♀";
    return "♂ ♀";
  };

  const getStatusColor = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "moderate") return "#f59e0b";
    if (normalized === "critical") return "#ef4444";
    if (normalized === "in use") return "#f97316";
    if (normalized === "free") return "#22c55e";
    return "#10b981";
  };

  const getStatusLabel = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "moderate") return t("status_moderate", language);
    if (normalized === "critical") return t("status_critical", language);
    if (normalized === "in use") return t("status_in_use", language);
    if (normalized === "free") return t("status_free", language);
    return t("status_good", language);
  };

  const handleCenterUser = () => {
    setCenterTrigger((prev) => prev + 1);
  };

  return (
    <MapContainer center={initialCenter} zoom={15} className="toilet-map" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewportController userLocation={userLocation} centerTrigger={centerTrigger} />
      <MyLocationButton
        userLocation={userLocation}
        onRequestLocation={onRequestLocation}
        onCenterUser={handleCenterUser}
      />

      <UserLocationMarker userLocation={userLocation} language={language} />

      {toilets.map((toilet) =>
        toilet.latitude && toilet.longitude ? (
          <Marker
            key={toilet.id}
            position={[toilet.latitude, toilet.longitude]}
            icon={createCustomIcon(toilet.status, highlightedSet.has(toilet.id))}
            eventHandlers={{
              mouseover: (event) => event.target.openTooltip(),
              mouseout: (event) => event.target.closeTooltip(),
              click: (event) => event.target.openPopup(),
            }}
          >
            <Tooltip direction="top" offset={[0, -30]} opacity={1} className="custom-tooltip">
              <div className="tooltip-card">
                <div className="tooltip-header">
                  <span className="tooltip-name">{toilet.name}</span>
                </div>
                <div className="tooltip-status-row">
                  <span
                    className="tooltip-status-dot"
                    style={{ backgroundColor: getStatusColor(toilet.status) }}
                  ></span>
                  <span
                    className="tooltip-status-text"
                    style={{ color: getStatusColor(toilet.status) }}
                  >
                    {getStatusLabel(toilet.status)}
                  </span>
                  <span className="tooltip-score">{toilet.health_score || 0}%</span>
                </div>
              </div>
            </Tooltip>

            <Popup className="custom-popup" closeButton={true}>
              <div className="popup-card">
                <div className="popup-header">
                  <div className="popup-title-wrap">
                    <h3 className="popup-title">{toilet.name}</h3>
                    {toilet.is_disabled_friendly && (
                      <span
                        className="popup-accessibility-badge"
                        aria-label={t("disabled_friendly", language)}
                        title={t("disabled_friendly", language)}
                      >
                        <span className="popup-accessibility-icon" aria-hidden="true">
                          {"\u267F"}
                        </span>
                        {t("disabled_friendly", language)}
                      </span>
                    )}
                  </div>
                  <span
                    className="popup-badge"
                    style={{
                      backgroundColor: getStatusColor(toilet.status),
                      boxShadow: `0 0 15px ${getStatusColor(toilet.status)}40`,
                    }}
                  >
                    {getStatusLabel(toilet.status)}
                  </span>
                </div>

                <p className="popup-location">{toilet.location}</p>
                <p className="popup-location">
                  {getToiletTypeSymbols(toilet.toilet_type)} {toilet.toilet_type || "Both"}
                </p>
                <p className="popup-location">{t("gas", language)}: {getSafeGasValue(toilet.gas_level).toFixed(1)}</p>
                <p className="popup-location">{t("dustbin", language)}: {Math.max(0, Math.min(100, Math.round(Number(toilet.dustbin_level || 0))))}%</p>
                {getSafeGasValue(toilet.gas_level) > 70 && (
                  <p className="popup-location"><b>{t("fan_on_alert", language)}</b></p>
                )}

                <div className="popup-metrics">
                  <div className="popup-metric">
                    <div className="popup-metric-header">
                      <span className="popup-metric-label">{t("health_score", language)}</span>
                      <span className="popup-metric-value">{toilet.health_score || 0}%</span>
                    </div>
                    <div className="popup-metric-bar">
                      <div
                        className="popup-metric-fill health"
                        style={{ width: `${toilet.health_score || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="popup-metric">
                    <div className="popup-metric-header">
                      <span className="popup-metric-label">{t("cleanliness", language)}</span>
                      <span className="popup-metric-value">{toilet.cleanliness || 0}%</span>
                    </div>
                    <div className="popup-metric-bar">
                      <div
                        className="popup-metric-fill cleanliness"
                        style={{ width: `${toilet.cleanliness || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="popup-metric">
                    <div className="popup-metric-header">
                      <span className="popup-metric-label">{t("water_level", language)}</span>
                      <span className="popup-metric-value">{toilet.water_level || 0}%</span>
                    </div>
                    <div className="popup-metric-bar">
                      <div
                        className="popup-metric-fill water"
                        style={{ width: `${toilet.water_level || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="popup-actions">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onViewDetails(toilet.id);
                    }}
                    className="popup-btn popup-btn-details"
                  >
                    {t("view_details", language)}
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectToilet(toilet.id);
                    }}
                    className="popup-btn popup-btn-complaint"
                  >
                    {t("report_issue", language)}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!Number.isFinite(Number(toilet?.latitude)) || !Number.isFinite(Number(toilet?.longitude))) {
                      alert("Toilet coordinates are unavailable.");
                      return;
                    }
                    const url = buildMapsDirectionUrl(
                      toilet.latitude,
                      toilet.longitude,
                      userLocation?.latitude,
                      userLocation?.longitude
                    );
                    if (url) {
                      window.open(url, "_blank");
                    } else {
                      alert("Toilet coordinates are unavailable.");
                    }
                  }}
                  className="popup-btn popup-btn-directions"
                >
                  {t("get_directions", language)}
                </button>
              </div>
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}

export default ToiletMap;

