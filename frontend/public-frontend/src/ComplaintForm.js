import React, { useState } from "react";
import axios from "axios";

function ComplaintForm({ toiletId }) {
  const [issueType, setIssueType] = useState("Dirty");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("toilet", toiletId);
      formData.append("issue_type", issueType);
      formData.append("description", description);

      if (image) {
        formData.append("image", image);
      }

      await axios.post("http://127.0.0.1:8000/api/complaints/create/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Complaint submitted successfully.");
      setIssueType("Dirty");
      setDescription("");
      setImage(null);
    } catch (error) {
      const responseData = error?.response?.data;
      let detail = "Failed to submit complaint. Please try again.";

      if (typeof responseData === "string") {
        detail = responseData;
      } else if (responseData?.detail) {
        detail = responseData.detail;
      } else if (responseData && typeof responseData === "object") {
        detail = Object.entries(responseData)
          .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : value}`)
          .join(" | ");
      }

      setMessage(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="issueType">Issue Type</label>
        <br />
        <select
          id="issueType"
          value={issueType}
          onChange={(event) => setIssueType(event.target.value)}
        >
          <option value="Dirty">Dirty</option>
          <option value="No Water">No Water</option>
          <option value="Broken">Broken</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="description">Description</label>
        <br />
        <textarea
          id="description"
          rows="4"
          style={{ width: "100%", maxWidth: "500px" }}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="image">Upload Image (optional)</label>
        <br />
        <input
          id="image"
          type="file"
          accept="image/*"
          onChange={(event) => setImage(event.target.files?.[0] || null)}
        />
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit"}
      </button>

      {message && <p style={{ marginTop: "12px" }}>{message}</p>}
    </form>
  );
}

export default ComplaintForm;
