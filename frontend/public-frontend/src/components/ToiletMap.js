import React, { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import {
  FIXED_LOCATION,
  FIXED_LOCATION_COORDS,
  buildMapsDirectionUrl,
} from "../constants/fixedLocation";

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

function UserLocation() {
  return (
    <Marker position={FIXED_LOCATION_COORDS}>
      <Popup>{`${FIXED_LOCATION.label} (Fixed Location)`}</Popup>
    </Marker>
  );
}

function MapViewportController() {
  const map = useMap();
  const hasInitializedViewRef = useRef(false);

  useEffect(() => {
    if (hasInitializedViewRef.current) return;
    map.setView(FIXED_LOCATION_COORDS, 15, { animate: false });
    hasInitializedViewRef.current = true;
  }, [map]);

  return null;
}

function ToiletMap({ toilets, onSelectToilet, onViewDetails, highlightedToiletIds = [] }) {
  const highlightedSet = new Set(highlightedToiletIds);
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
    if (normalized === "moderate") return "Moderate";
    if (normalized === "critical") return "Critical";
    if (normalized === "in use") return "IN USE";
    if (normalized === "free") return "FREE";
    return "Good";
  };

  return (
    <MapContainer center={FIXED_LOCATION_COORDS} zoom={13} className="toilet-map" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewportController />

      <UserLocation />

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
                        aria-label="Disabled-friendly toilet"
                        title="Disabled-friendly toilet"
                      >
                        <span className="popup-accessibility-icon" aria-hidden="true">
                          {"\u267F"}
                        </span>
                        Disabled-Friendly
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
                <p className="popup-location">Gas: {getSafeGasValue(toilet.gas_level).toFixed(1)}</p>
                <p className="popup-location">Dustbin: {Math.max(0, Math.min(100, Math.round(Number(toilet.dustbin_level || 0))))}%</p>
                {getSafeGasValue(toilet.gas_level) > 70 && (
                  <p className="popup-location"><b>Fan ON Alert</b></p>
                )}

                <div className="popup-metrics">
                  <div className="popup-metric">
                    <div className="popup-metric-header">
                      <span className="popup-metric-label">Health</span>
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
                      <span className="popup-metric-label">Cleanliness</span>
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
                      <span className="popup-metric-label">Water</span>
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
                    View Details
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
                    Report Issue
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.open(buildMapsDirectionUrl(toilet.latitude, toilet.longitude), "_blank");
                  }}
                  className="popup-btn popup-btn-directions"
                >
                  Get Directions
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
