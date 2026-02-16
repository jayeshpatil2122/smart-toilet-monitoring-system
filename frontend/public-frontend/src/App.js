import React, { useEffect, useState } from "react";
import axios from "axios";
import ComplaintForm from "./ComplaintForm.js";


function App() {

  const [toilets, setToilets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToilet, setSelectedToilet] = useState(null);

  // Fetch toilets when component loads
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

  // When user clicks submit complaint
  const handleComplaintClick = (toiletId) => {
    setSelectedToilet(toiletId);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Smart Public Toilet</h1>
      <h2>Nearby Toilets</h2>

      {loading && <p>Loading toilets...</p>}

      {!loading && toilets.length === 0 && (
        <p>No toilets found.</p>
      )}

      {!loading &&
        toilets.map((toilet) => (
          <div
            key={toilet.id}
            style={{
              border: "1px solid #ccc",
              padding: "20px",
              marginBottom: "15px",
              borderRadius: "8px",
            }}
          >
            <h3>{toilet.name}</h3>
            <p>Location: {toilet.location}</p>

            <button
              onClick={() => handleComplaintClick(toilet.id)}
              style={{
                padding: "8px 15px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Submit Complaint
            </button>
          </div>
        ))}

      {/* Show complaint form if toilet selected */}
       {selectedToilet !== null && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        backgroundColor: "white",
        padding: "30px",
        borderRadius: "10px",
        width: "400px",
        position: "relative",
        boxShadow: "0px 10px 30px rgba(0,0,0,0.2)"
      }}
    >
      <button
        onClick={() => setSelectedToilet(null)}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          border: "none",
          background: "red",
          color: "white",
          borderRadius: "50%",
          width: "25px",
          height: "25px",
          cursor: "pointer",
        }}
      >
        X
      </button>

      <h2 style={{ marginBottom: "20px" }}>Submit Complaint</h2>

      <ComplaintForm toiletId={selectedToilet} />
    </div>
  </div>
)}
</div>
  );
}
export default App;
