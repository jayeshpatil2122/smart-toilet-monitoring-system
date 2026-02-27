import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)

try:
    import numpy as np
except Exception as exc:  # pragma: no cover - import guard
    np = None
    NUMPY_IMPORT_ERROR = exc
else:
    NUMPY_IMPORT_ERROR = None

try:
    import cv2
except Exception as exc:  # pragma: no cover - import guard
    cv2 = None
    CV2_IMPORT_ERROR = exc
else:
    CV2_IMPORT_ERROR = None

try:
    from ultralytics import YOLO
except Exception as exc:  # pragma: no cover - import guard
    YOLO = None
    YOLO_IMPORT_ERROR = exc
else:
    YOLO_IMPORT_ERROR = None


TOILET_CLASS_ID = 61
SCREEN_FRAME_THRESHOLD_RATIO = 0.55
MAX_VIDEO_DURATION_SEC = 15.0
MIN_VIDEO_DURATION_SEC = 14.5
MAX_ANALYSIS_DURATION_SEC = 15.2
MAX_SCREEN_SAMPLES = 60
MAX_TOILET_SAMPLES = 36
SCREEN_SAMPLE_EVERY_N = 10
TOILET_SAMPLE_EVERY_N = 20
MAX_REASONABLE_FRAME_COUNT = 10_000_000


def _scan_video_stats(video_path, fallback_fps=0.0):
    if cv2 is None:
        return {
            "fps": 0.0,
            "frames": 0,
            "duration_sec": 0.0,
            "duration_source": "scan",
        }

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return {
            "fps": 0.0,
            "frames": 0,
            "duration_sec": 0.0,
            "duration_source": "scan",
        }

    frames = 0
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    if fps <= 0 and fallback_fps > 0:
        fps = float(fallback_fps)
    if fps <= 0:
        fps = 15.0

    # Videos are capped to 15s in product flow, so bounded frame scan is safe.
    max_scan_frames = int(max(MAX_VIDEO_DURATION_SEC + 5.0, 20.0) * max(fps, 1.0))
    last_pos_msec = 0.0
    try:
        while frames < max_scan_frames:
            ok, _frame = capture.read()
            if not ok:
                break
            frames += 1
            pos_msec = float(capture.get(cv2.CAP_PROP_POS_MSEC) or 0.0)
            if pos_msec > last_pos_msec:
                last_pos_msec = pos_msec
    finally:
        capture.release()

    if last_pos_msec > 0:
        duration_sec = round(last_pos_msec / 1000.0, 2)
    elif fps > 0 and frames > 0:
        duration_sec = round(frames / fps, 2)
    else:
        duration_sec = 0.0

    return {
        "fps": round(fps, 2),
        "frames": int(frames),
        "duration_sec": duration_sec,
        "duration_source": "scan",
    }


def _iter_sampled_frames(
    video_path,
    sample_every_n=8,
    max_samples=120,
    max_duration_sec=MAX_ANALYSIS_DURATION_SEC,
):
    if cv2 is None:
        raise RuntimeError(
            f"OpenCV is not available. Install opencv-python. Error: {CV2_IMPORT_ERROR}"
        )

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise RuntimeError("Unable to open uploaded video for AI verification.")

    frame_index = 0
    sampled = 0
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            if max_duration_sec and fps > 0 and (frame_index / fps) > max_duration_sec:
                break

            if frame_index % sample_every_n == 0:
                sampled += 1
                yield frame_index, frame
                if max_samples and sampled >= max_samples:
                    break

            frame_index += 1
    finally:
        capture.release()


def _safe_video_stats(video_path):
    if cv2 is None:
        return {
            "fps": 0.0,
            "frames": 0,
            "duration_sec": 0.0,
            "duration_source": "metadata",
        }

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return {
            "fps": 0.0,
            "frames": 0,
            "duration_sec": 0.0,
            "duration_source": "metadata",
        }

    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps_valid = fps > 0 and fps < 240
        frames_valid = frames > 0 and frames < MAX_REASONABLE_FRAME_COUNT
        duration_sec = round(frames / fps, 2) if fps_valid and frames_valid else 0.0
        metadata_stats = {
            "fps": round(fps, 2) if fps_valid else 0.0,
            "frames": int(frames) if frames_valid else 0,
            "duration_sec": duration_sec if duration_sec > 0 else 0.0,
            "duration_source": "metadata",
        }
    finally:
        capture.release()

    if metadata_stats["duration_sec"] > 0:
        return metadata_stats

    scanned_stats = _scan_video_stats(video_path, fallback_fps=metadata_stats["fps"])
    scanned_stats["metadata_fps"] = metadata_stats["fps"]
    scanned_stats["metadata_frames"] = metadata_stats["frames"]
    return scanned_stats


def detect_screen_frame(frame):
    if np is None:
        raise RuntimeError(
            f"NumPy is not available. Install numpy. Error: {NUMPY_IMPORT_ERROR}"
        )

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # 1) Brightness detection
    brightness = float(np.mean(gray))

    # 2) Edge detection
    edges = cv2.Canny(gray, 50, 150)
    edge_pixels = int(np.sum(edges > 0))
    edge_ratio = edge_pixels / float(edges.size or 1)

    # 3) Pixel variation (screen-like uniformity)
    variance = float(np.var(gray))

    # 4) Large rectangle contours are common when recording another device screen.
    frame_area = float(gray.shape[0] * gray.shape[1] or 1)
    has_large_rectangle = False
    largest_rectangle_ratio = 0.0
    rectangular_contours = 0
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        contour_area = cv2.contourArea(contour)
        if contour_area < frame_area * 0.10:
            continue
        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue
        polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(polygon) == 4:
            has_large_rectangle = True
            rectangular_contours += 1
            largest_rectangle_ratio = max(
                largest_rectangle_ratio, float(contour_area) / frame_area
            )

    # Use combined cues to avoid false rejects on real live videos.
    evidence_score = 0
    if variance < 260 and brightness > 95:
        evidence_score += 2
    if brightness > 190 and variance < 500:
        evidence_score += 2
    if has_large_rectangle and largest_rectangle_ratio > 0.42 and variance < 1200:
        evidence_score += 2
    if edge_ratio > 0.22 and variance < 1500:
        evidence_score += 1
    if rectangular_contours >= 2 and largest_rectangle_ratio > 0.30:
        evidence_score += 1

    is_screen_like = evidence_score >= 3

    return is_screen_like, {
        "brightness": round(brightness, 2),
        "edge_pixels": edge_pixels,
        "edge_ratio": round(edge_ratio, 4),
        "variance": round(variance, 2),
        "large_rectangle": has_large_rectangle,
        "largest_rectangle_ratio": round(largest_rectangle_ratio, 4),
        "rectangular_contours": rectangular_contours,
        "screen_evidence_score": evidence_score,
    }


def screen_video_check(video_path):
    fake_frames = 0
    sampled_frames = 0
    sample_metrics = []

    for _frame_idx, frame in _iter_sampled_frames(
        video_path,
        sample_every_n=SCREEN_SAMPLE_EVERY_N,
        max_samples=MAX_SCREEN_SAMPLES,
        max_duration_sec=MAX_ANALYSIS_DURATION_SEC,
    ):
        sampled_frames += 1
        is_screen_like, metrics = detect_screen_frame(frame)
        if len(sample_metrics) < 8:
            sample_metrics.append(metrics)
        if is_screen_like:
            fake_frames += 1

        # Fast fail/fast pass once enough evidence is available.
        if sampled_frames >= 12:
            current_ratio = fake_frames / sampled_frames
            if fake_frames >= 9 and current_ratio >= 0.72:
                break
            if sampled_frames >= 24 and current_ratio <= 0.12:
                break

    if sampled_frames == 0:
        return {
            "ok": False,
            "error": "Video does not contain readable frames.",
            "sampled_frames": 0,
            "screen_like_frames": 0,
            "screen_like_ratio": 0.0,
            "samples": sample_metrics,
        }

    screen_like_ratio = fake_frames / sampled_frames
    is_screen_video = (
        sampled_frames >= 8
        and fake_frames >= 4
        and screen_like_ratio >= SCREEN_FRAME_THRESHOLD_RATIO
    )
    return {
        "ok": True,
        "is_screen_video": is_screen_video,
        "sampled_frames": sampled_frames,
        "screen_like_frames": fake_frames,
        "screen_like_ratio": round(screen_like_ratio, 4),
        "threshold_ratio": SCREEN_FRAME_THRESHOLD_RATIO,
        "samples": sample_metrics,
    }


@lru_cache(maxsize=1)
def _load_yolo_model():
    if YOLO is None:
        error_text = (
            "Ultralytics YOLO is not available. Install ultralytics. "
            f"Error: {YOLO_IMPORT_ERROR}"
        )
        if "libxcb.so.1" in str(YOLO_IMPORT_ERROR):
            error_text += (
                " Missing Linux shared libraries. "
                "Install libxcb1/libx11/libgl packages on server."
            )
        return None, error_text

    weights_path = os.environ.get("YOLO_WEIGHTS_PATH", "yolov8n.pt")
    try:
        return YOLO(weights_path), ""
    except Exception as exc:  # pragma: no cover - model/runtime guard
        logger.exception("Failed to load YOLO model for video verification")
        return None, f"Failed to load YOLO model: {exc}"


def detect_toilet(video_path):
    model, model_error = _load_yolo_model()
    if model is None:
        return {
            "ok": False,
            "error": model_error,
            "sampled_frames": 0,
            "toilet_detected_frames": 0,
            "toilet_detected": False,
            "best_confidence": 0.0,
        }

    sampled_frames = 0
    toilet_detected_frames = 0
    best_confidence = 0.0

    for _frame_idx, frame in _iter_sampled_frames(
        video_path,
        sample_every_n=TOILET_SAMPLE_EVERY_N,
        max_samples=MAX_TOILET_SAMPLES,
        max_duration_sec=MAX_ANALYSIS_DURATION_SEC,
    ):
        sampled_frames += 1
        try:
            results = model.predict(
                source=frame,
                classes=[TOILET_CLASS_ID],
                conf=0.2,
                verbose=False,
            )
        except Exception as exc:  # pragma: no cover - runtime guard
            logger.exception("YOLO inference failed during toilet detection")
            return {
                "ok": False,
                "error": f"YOLO inference error: {exc}",
                "sampled_frames": sampled_frames,
                "toilet_detected_frames": toilet_detected_frames,
                "toilet_detected": False,
                "best_confidence": round(best_confidence, 4),
            }

        frame_has_toilet = False
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None or len(boxes) == 0:
                continue

            cls_values = boxes.cls.tolist() if hasattr(boxes.cls, "tolist") else boxes.cls
            conf_values = boxes.conf.tolist() if hasattr(boxes.conf, "tolist") else boxes.conf

            for cls_value, conf_value in zip(cls_values, conf_values):
                if int(cls_value) == TOILET_CLASS_ID:
                    frame_has_toilet = True
                    best_confidence = max(best_confidence, float(conf_value))

        if frame_has_toilet:
            toilet_detected_frames += 1
            # Two positive sampled frames is strong enough to conclude quickly.
            if toilet_detected_frames >= 2 and sampled_frames >= 6:
                break

    detected_ratio = (
        toilet_detected_frames / sampled_frames if sampled_frames > 0 else 0.0
    )
    toilet_detected = toilet_detected_frames > 0 and (
        detected_ratio >= 0.05 or toilet_detected_frames >= 2
    )
    return {
        "ok": True,
        "toilet_detected": toilet_detected,
        "sampled_frames": sampled_frames,
        "toilet_detected_frames": toilet_detected_frames,
        "toilet_detected_ratio": round(detected_ratio, 4),
        "best_confidence": round(best_confidence, 4),
    }


def verify_video(video_path, reported_duration_sec=None):
    if not video_path or not os.path.exists(video_path):
        return {
            "approved": False,
            "message": "Rejected: Uploaded video file is missing on server.",
            "checks": {},
        }

    if np is None:
        return {
            "approved": False,
            "message": (
                "Rejected: NumPy is not installed on server. "
                "Install numpy to enable AI video verification."
            ),
            "checks": {},
        }

    if cv2 is None:
        return {
            "approved": False,
            "message": (
                "Rejected: OpenCV is not available on server. "
                "Install opencv-python-headless (or opencv-python). "
                f"Import error: {CV2_IMPORT_ERROR}"
            ),
            "checks": {},
        }

    stats = _safe_video_stats(video_path)
    reported_duration = None
    if reported_duration_sec is not None:
        try:
            reported_duration = float(reported_duration_sec)
            if reported_duration <= 0:
                reported_duration = None
        except Exception:
            reported_duration = None

    server_detected_duration = float(stats.get("duration_sec") or 0.0)
    effective_duration = server_detected_duration
    duration_source = str(stats.get("duration_source") or "metadata")
    if reported_duration:
        if effective_duration <= 0:
            effective_duration = round(reported_duration, 2)
            duration_source = "client_reported"
        elif reported_duration > effective_duration:
            # Keep the stricter value to avoid false "too short" rejects from bad metadata.
            effective_duration = round(reported_duration, 2)
            duration_source = "server_client_max"

    if reported_duration:
        stats["reported_duration_sec"] = round(reported_duration, 2)
    stats["server_detected_duration_sec"] = round(server_detected_duration, 2)
    stats["effective_duration_sec"] = round(effective_duration, 2)
    stats["duration_source"] = duration_source

    if effective_duration > (MAX_VIDEO_DURATION_SEC + 0.5):
        return {
            "approved": False,
            "message": (
                f"Rejected: Video is too long ({round(effective_duration, 2)}s). "
                f"Record close to {int(MAX_VIDEO_DURATION_SEC)} seconds."
            ),
            "checks": {"video_stats": stats},
        }

    if effective_duration <= 0:
        return {
            "approved": False,
            "message": (
                "Rejected: Unable to determine video duration. "
                f"Record close to {int(MAX_VIDEO_DURATION_SEC)} seconds."
            ),
            "checks": {"video_stats": stats},
        }

    if effective_duration < MIN_VIDEO_DURATION_SEC:
        return {
            "approved": False,
            "message": (
                f"Rejected: Video duration not accepted ({round(effective_duration, 2)}s). "
                f"Record close to {int(MAX_VIDEO_DURATION_SEC)} seconds."
            ),
            "checks": {"video_stats": stats},
        }

    try:
        screen_result = screen_video_check(video_path)
    except Exception as exc:
        return {
            "approved": False,
            "message": f"Rejected: Screen-recording verification failed. {exc}",
            "checks": {"video_stats": stats},
        }

    if not screen_result.get("ok"):
        return {
            "approved": False,
            "message": f"Rejected: {screen_result.get('error', 'Screen verification failed.')}",
            "checks": {"video_stats": stats, "screen_recording": screen_result},
        }

    if screen_result.get("is_screen_video"):
        sampled_frames = int(screen_result.get("sampled_frames") or 0)
        screen_like_frames = int(screen_result.get("screen_like_frames") or 0)
        return {
            "approved": False,
            "message": (
                "Rejected: Screen Recorded Video Detected. "
                f"Screen-like frames: {screen_like_frames}/{sampled_frames}."
            ),
            "checks": {"video_stats": stats, "screen_recording": screen_result},
        }

    try:
        toilet_result = detect_toilet(video_path)
    except Exception as exc:
        return {
            "approved": False,
            "message": f"Rejected: Toilet detection failed. {exc}",
            "checks": {"video_stats": stats, "screen_recording": screen_result},
        }

    if not toilet_result.get("ok"):
        return {
            "approved": False,
            "message": f"Rejected: {toilet_result.get('error', 'Toilet detection model unavailable.')}",
            "checks": {
                "video_stats": stats,
                "screen_recording": screen_result,
                "toilet_detection": toilet_result,
            },
        }

    if not toilet_result.get("toilet_detected"):
        return {
            "approved": False,
            "message": "Rejected: Toilet object not matched. No Toilet Detected.",
            "checks": {
                "video_stats": stats,
                "screen_recording": screen_result,
                "toilet_detection": toilet_result,
            },
        }

    return {
        "approved": True,
        "message": "Approved",
        "checks": {
            "video_stats": stats,
            "screen_recording": screen_result,
            "toilet_detection": toilet_result,
        },
    }
