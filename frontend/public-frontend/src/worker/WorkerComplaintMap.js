import React, { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { buildMapsDirectionUrl } from "../constants/fixedLocation";

const DEFAULT_CENTER = [20.9333, 77.7513];

const getPriorityColor = (priority) => {
  const normalized = String(priority || "").toLowerCase();
  if (normalized === "high") return "#ef4444";
  if (normalized === "medium") return "#f97316";
  return "#22c55e";
};

const getPriorityClass = (priority) => {
  const normalized = String(priority || "").toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
};

const createPriorityIcon = (priority, active = false) => {
  const color = getPriorityColor(priority);
  const ringColor = active ? "rgba(34, 197, 94, 0.25)" : "transparent";
  const ringWidth = active ? 3 : 0;

  return new L.DivIcon({
    className: "worker-map-marker-wrap",
    html: `
      <svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg">
        <circle cx="19" cy="19" r="15" fill="${ringColor}" stroke="${color}" stroke-width="${ringWidth}" />
        <path d="M19 0C8.507 0 0 8.507 0 19c0 12.878 19 31 19 31s19-18.122 19-31C38 8.507 29.493 0 19 0z" fill="${color}" />
        <circle cx="19" cy="18.5" r="7.2" fill="#ffffff" />
      </svg>
    `,
    iconSize: [38, 50],
    iconAnchor: [19, 50],
    popupAnchor: [0, -48],
  });
};

function WorkerComplaintMap({ complaints, activeComplaintId, onSelectComplaint }) {
  const mappedComplaints = useMemo(
    () =>
      complaints.filter(
        (item) =>
          Number.isFinite(Number(item.toilet_latitude)) &&
          Number.isFinite(Number(item.toilet_longitude))
      ),
    [complaints]
  );

  const center = useMemo(() => {
    if (!mappedComplaints.length) return DEFAULT_CENTER;
    return [
      Number(mappedComplaints[0].toilet_latitude),
      Number(mappedComplaints[0].toilet_longitude),
    ];
  }, [mappedComplaints]);

  if (!mappedComplaints.length) {
    return <p className="worker-map-empty">No assigned complaint has mappable coordinates yet.</p>;
  }

  return (
    <MapContainer center={center} zoom={14} className="worker-complaint-map" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {mappedComplaints.map((complaint) => (
        <Marker
          key={complaint.id}
          position={[Number(complaint.toilet_latitude), Number(complaint.toilet_longitude)]}
          icon={createPriorityIcon(complaint.priority, activeComplaintId === complaint.id)}
          eventHandlers={{
            click: () => onSelectComplaint?.(complaint.id),
          }}
        >
          <Popup className="worker-map-popup">
            <div className="worker-map-popup-card">
              <h4>{complaint.toilet_name}</h4>
              <p className="worker-map-popup-type">{complaint.issue_type}</p>
              <div className="worker-map-popup-meta">
                <span className={`worker-map-priority ${getPriorityClass(complaint.priority)}`}>
                  {complaint.priority} Priority
                </span>
                <span
                  className={`worker-map-status ${String(complaint.status || "")
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {complaint.status}
                </span>
              </div>
              <p className="worker-map-popup-location">{complaint.toilet_location}</p>

              <button
                type="button"
                className="worker-map-nav-btn"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  window.open(
                    buildMapsDirectionUrl(complaint.toilet_latitude, complaint.toilet_longitude),
                    "_blank"
                  );
                }}
              >
                Navigate
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default WorkerComplaintMap;
