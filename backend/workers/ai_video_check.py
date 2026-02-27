import logging
import os
from functools import lru_cache

import numpy as np

logger = logging.getLogger(__name__)

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
SCREEN_FRAME_THRESHOLD_RATIO = 0.30
MAX_FRAME_SAMPLES = 140


def _iter_sampled_frames(video_path, sample_every_n=8, max_samples=MAX_FRAME_SAMPLES):
    if cv2 is None:
        raise RuntimeError(
            f"OpenCV is not available. Install opencv-python. Error: {CV2_IMPORT_ERROR}"
        )

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise RuntimeError("Unable to open uploaded video for AI verification.")

    frame_index = 0
    sampled = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
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
        }

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return {
            "fps": 0.0,
            "frames": 0,
            "duration_sec": 0.0,
        }

    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_sec = round(frames / fps, 2) if fps > 0 and frames > 0 else 0.0
        return {
            "fps": round(fps, 2),
            "frames": frames,
            "duration_sec": duration_sec,
        }
    finally:
        capture.release()


def detect_screen_frame(frame):
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
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        contour_area = cv2.contourArea(contour)
        if contour_area < frame_area * 0.18:
            continue
        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue
        polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(polygon) == 4:
            has_large_rectangle = True
            break

    is_screen_like = (
        brightness > 180
        or edge_pixels > 15000
        or variance < 400
        or edge_ratio > 0.17
        or (has_large_rectangle and brightness > 150)
    )

    return is_screen_like, {
        "brightness": round(brightness, 2),
        "edge_pixels": edge_pixels,
        "edge_ratio": round(edge_ratio, 4),
        "variance": round(variance, 2),
        "large_rectangle": has_large_rectangle,
    }


def screen_video_check(video_path):
    fake_frames = 0
    sampled_frames = 0
    sample_metrics = []

    for _frame_idx, frame in _iter_sampled_frames(video_path, sample_every_n=8):
        sampled_frames += 1
        is_screen_like, metrics = detect_screen_frame(frame)
        if len(sample_metrics) < 8:
            sample_metrics.append(metrics)
        if is_screen_like:
            fake_frames += 1

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
    is_screen_video = screen_like_ratio > SCREEN_FRAME_THRESHOLD_RATIO
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
        return None, f"Ultralytics YOLO is not available. Install ultralytics. Error: {YOLO_IMPORT_ERROR}"

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

    for _frame_idx, frame in _iter_sampled_frames(video_path, sample_every_n=20):
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

    detected_ratio = (
        toilet_detected_frames / sampled_frames if sampled_frames > 0 else 0.0
    )
    toilet_detected = toilet_detected_frames > 0 and detected_ratio >= 0.08
    return {
        "ok": True,
        "toilet_detected": toilet_detected,
        "sampled_frames": sampled_frames,
        "toilet_detected_frames": toilet_detected_frames,
        "toilet_detected_ratio": round(detected_ratio, 4),
        "best_confidence": round(best_confidence, 4),
    }


def verify_video(video_path):
    if not video_path or not os.path.exists(video_path):
        return {
            "approved": False,
            "message": "Rejected: Uploaded video file is missing on server.",
            "checks": {},
        }

    if cv2 is None:
        return {
            "approved": False,
            "message": (
                "Rejected: OpenCV is not installed on server. "
                "Install opencv-python to enable AI video verification."
            ),
            "checks": {},
        }

    stats = _safe_video_stats(video_path)
    if stats["duration_sec"] < 2.5:
        return {
            "approved": False,
            "message": "Rejected: Video is too short. Record at least 3 seconds of cleaning.",
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
        return {
            "approved": False,
            "message": "Rejected: Screen Recorded Video Detected",
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
            "message": "Rejected: No Toilet Detected",
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
