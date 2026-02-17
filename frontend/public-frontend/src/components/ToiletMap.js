import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Create colored marker function
const getMarkerIcon = (status) => {
  let color = "green";

  if (status === "Moderate") color = "orange";
  if (status === "Critical") color = "red";

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
};

// Show user location component
function UserLocation() {
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 15 });

    map.on("locationfound", (e) => {
      L.marker(e.latlng)
        .addTo(map)
        .bindPopup("You are here")
        .openPopup();
    });
  }, [map]);

  return null;
}

function ToiletMap({ toilets, onSelectToilet }) {
  return (
    <MapContainer
      center={[20.9333, 77.7513]} // Amaravati center
      zoom={14}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <UserLocation />

      {toilets.map((toilet) =>
        toilet.latitude && toilet.longitude ? (
          <Marker
            key={toilet.id}
            position={[toilet.latitude, toilet.longitude]}
            icon={getMarkerIcon(toilet.status)}
          >
            <Popup>
              <h3>{toilet.name}</h3>
              <p>{toilet.location}</p>
              <p>Status: <b>{toilet.status}</b></p>

              <button
                onClick={() => onSelectToilet(toilet.id)}
                style={{
                  marginTop: "5px",
                  padding: "5px 10px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                }}
              >
                Submit Complaint
              </button>

              <br /><br />

              <button
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${toilet.latitude},${toilet.longitude}`,
                    "_blank"
                  )
                }
                style={{
                  padding: "5px 10px",
                  backgroundColor: "green",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                }}
              >
                Get Directions
              </button>
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}

export default ToiletMap;
