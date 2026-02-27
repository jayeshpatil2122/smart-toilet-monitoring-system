import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE = (
  process.env.REACT_APP_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const COMPLAINTS_API_BASE = `${API_BASE}/api/complaints`;

function ComplaintForm({ toiletId, portalToken = "", onComplaintSubmitted = null }) {
  const [issueType, setIssueType] = useState("Dirty");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState("user");
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const getCameraConstraints = (facingMode) => {
    if (!facingMode) {
      return [{ video: true, audio: false }];
    }
    return [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode,
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];
  };

  const startLiveCamera = async (preferredFacingMode = cameraFacingMode) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("Live camera is not supported in this browser.");
      setMessageType("error");
      return;
    }

    setCameraFacingMode(preferredFacingMode);
    setCameraBusy(true);
    setCameraReady(false);
    setMessage("");
    setMessageType("");
    stopCameraStream();
    setCameraOpen(true);

    try {
      let stream = null;
      const constraintsList = getCameraConstraints(preferredFacingMode);

      for (let index = 0; index < constraintsList.length; index += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          stream = await navigator.mediaDevices.getUserMedia(constraintsList[index]);
          if (stream) break;
        } catch (_constraintError) {
          if (index === constraintsList.length - 1) {
            throw _constraintError;
          }
        }
      }

      if (!stream) {
        throw new Error("No camera stream available.");
      }

      streamRef.current = stream;
      setMessage("Camera opened. Hold device steady, then capture.");
      setMessageType("success");
    } catch (_error) {
      setMessage("Unable to access camera. Allow permission and try again.");
      setMessageType("error");
      setCameraOpen(false);
    } finally {
      setCameraBusy(false);
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady || (video.videoWidth || 0) === 0) {
      setMessage("Camera is not ready. Please try again.");
      setMessageType("error");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("Could not access camera frame. Please try again.");
      setMessageType("error");
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(video, 0, 0, width, height);

    try {
      const frame = context.getImageData(0, 0, width, height);
      const frameData = frame.data;
      let brightnessTotal = 0;
      for (let pixel = 0; pixel < frameData.length; pixel += 4) {
        brightnessTotal += (frameData[pixel] + frameData[pixel + 1] + frameData[pixel + 2]) / 3;
      }
      const avgBrightness = brightnessTotal / Math.max(1, frameData.length / 4);
      if (avgBrightness < 8) {
        setMessage("Captured frame is too dark/black. Increase light and capture again.");
        setMessageType("error");
        return;
      }
    } catch (_frameReadError) {
      // Ignore frame read failure and continue blob conversion.
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage("Could not capture image. Please try again.");
          setMessageType("error");
          return;
        }

        const file = new File(
          [blob],
          `complaint-live-${toiletId}-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        setImage(file);
        setCameraPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
        setCameraOpen(false);
        stopCameraStream();
        setMessage("Live image captured. You can now submit complaint.");
        setMessageType("success");
      },
      "image/jpeg",
      0.92
    );
  };

  const clearCapturedImage = () => {
    setImage(null);
    setCameraPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!image) {
      setMessage("Capture live toilet image before submitting complaint.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setMessageType("");

    try {
      const formData = new FormData();
      formData.append("toilet", toiletId);
      formData.append("issue_type", issueType);
      formData.append("description", description);

      formData.append("image", image);

      const headers = {
        "Content-Type": "multipart/form-data",
      };
      if (portalToken) {
        headers.Authorization = `Token ${portalToken}`;
      }

      const response = await axios.post(
        `${COMPLAINTS_API_BASE}/create/`,
        formData,
        { headers }
      );

      setMessage("Complaint submitted successfully.");
      setMessageType("success");
      setIssueType("Dirty");
      setDescription("");
      clearCapturedImage();
      setCameraOpen(false);
      stopCameraStream();
      if (typeof onComplaintSubmitted === "function") {
        onComplaintSubmitted(response.data);
      }
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

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return undefined;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const onReady = () => setCameraReady(true);
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    if (video.readyState >= 2) {
      setCameraReady(true);
    }
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
    };
  }, [cameraOpen, cameraBusy]);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (cameraPreviewUrl) {
        URL.revokeObjectURL(cameraPreviewUrl);
      }
    };
  }, [cameraPreviewUrl]);

  return (
    <form onSubmit={handleSubmit} className="complaint-form">
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
        <label className="form-label">
          Live Complaint Image
        </label>
        <div className="complaint-camera-box">
          <div className="complaint-camera-top-actions">
            <button
              type="button"
              className="complaint-camera-btn secondary"
              onClick={() =>
                startLiveCamera(cameraFacingMode === "user" ? "environment" : "user")
              }
              disabled={cameraBusy || submitting}
            >
              {cameraFacingMode === "user" ? "Switch to Back Camera" : "Switch to Front Camera"}
            </button>
          </div>

          {!cameraOpen && (
            <button
              type="button"
              className="complaint-camera-btn"
              onClick={() => startLiveCamera()}
              disabled={cameraBusy || submitting}
            >
              {cameraBusy ? "Opening Camera..." : image ? "Retake Live Photo" : "Open Live Camera"}
            </button>
          )}

          {cameraOpen && (
            <div className="complaint-camera-capture-wrap">
              <video
                ref={videoRef}
                className="complaint-camera-live"
                autoPlay
                muted
                playsInline
                disablePictureInPicture
              />
              <div className="complaint-camera-actions">
                <button
                  type="button"
                  className="complaint-camera-btn"
                  onClick={captureFromCamera}
                  disabled={submitting || !cameraReady}
                >
                  Capture Photo
                </button>
                <button
                  type="button"
                  className="complaint-camera-btn secondary"
                  onClick={() => {
                    setCameraOpen(false);
                    stopCameraStream();
                  }}
                  disabled={submitting}
                >
                  Close Camera
                </button>
              </div>
              {!cameraReady && (
                <small className="complaint-camera-hint">Starting live preview...</small>
              )}
            </div>
          )}

          {cameraPreviewUrl && (
            <div className="complaint-camera-preview-wrap">
              <img
                src={cameraPreviewUrl}
                alt="Captured complaint preview"
                className="complaint-camera-preview"
              />
              <button
                type="button"
                className="complaint-camera-btn secondary"
                onClick={clearCapturedImage}
                disabled={submitting}
              >
                Remove Photo
              </button>
            </div>
          )}
          <small className="complaint-camera-hint">
            Gallery upload is disabled. Capture from live camera only.
          </small>
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>

      <div className="complaint-form-submit-row">
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Complaint"}
        </button>
      </div>

      {message && <div className={`form-message ${messageType}`}>{message}</div>}
    </form>
  );
}

export default ComplaintForm;
