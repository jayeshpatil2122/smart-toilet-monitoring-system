import React, { useState } from "react";
import axios from "axios";

function ComplaintForm({ toiletId }) {
  const [issueType, setIssueType] = useState("Dirty");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setMessageType("");

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
      setMessageType("success");
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
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="issueType" className="form-label">
          Issue Type
        </label>
        <select
          id="issueType"
          className="form-select"
          value={issueType}
          onChange={(event) => setIssueType(event.target.value)}
        >
          <option value="Dirty">Dirty</option>
          <option value="No Water">No Water</option>
          <option value="Broken">Broken</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          className="form-textarea"
          rows="4"
          placeholder="Please describe the issue in detail..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="image" className="form-label">
          Upload Image (optional)
        </label>
        <input
          id="image"
          type="file"
          accept="image/*"
          className="form-file"
          onChange={(event) => setImage(event.target.files?.[0] || null)}
        />
      </div>

      <button type="submit" className="submit-btn" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Complaint"}
      </button>

      {message && <div className={`form-message ${messageType}`}>{message}</div>}
    </form>
  );
}

export default ComplaintForm;
