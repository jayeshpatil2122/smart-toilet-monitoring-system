import React, { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

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
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 15 });
    let locationMarker = null;

    const handleLocationFound = (event) => {
      if (locationMarker) {
        map.removeLayer(locationMarker);
      }
      locationMarker = L.marker(event.latlng)
        .addTo(map)
        .bindPopup("You are here", { closeButton: false })
        .openPopup();
    };

    map.on("locationfound", handleLocationFound);
    return () => {
      map.off("locationfound", handleLocationFound);
      if (locationMarker) {
        map.removeLayer(locationMarker);
      }
    };
  }, [map]);

  return null;
}

function ToiletMap({ toilets, onSelectToilet, onViewDetails, highlightedToiletIds = [] }) {
  const highlightedSet = new Set(highlightedToiletIds);

  const getStatusColor = (status) => {
    if (status === "Moderate") return "#f59e0b";
    if (status === "Critical") return "#ef4444";
    return "#10b981";
  };

  const getStatusLabel = (status) => {
    if (status === "Moderate") return "Moderate";
    if (status === "Critical") return "Critical";
    return "Good";
  };

  return (
    <MapContainer center={[20.9333, 77.7513]} zoom={14} className="toilet-map" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

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
                  <h3 className="popup-title">{toilet.name}</h3>
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
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${toilet.latitude},${toilet.longitude}`,
                      "_blank"
                    );
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
