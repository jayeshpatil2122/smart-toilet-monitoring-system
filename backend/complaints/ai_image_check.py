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
    from PIL import Image
except Exception as exc:  # pragma: no cover - import guard
    Image = None
    PIL_IMPORT_ERROR = exc
else:
    PIL_IMPORT_ERROR = None

try:
    from ultralytics import YOLO
except Exception as exc:  # pragma: no cover - import guard
    YOLO = None
    YOLO_IMPORT_ERROR = exc
else:
    YOLO_IMPORT_ERROR = None


TOILET_CLASS_ID = 61
MIN_ACCEPTED_CONFIDENCE = 0.2
MIN_LAPLACIAN_VARIANCE = 28.0
MIN_BRIGHTNESS = 20.0
MAX_BRIGHTNESS = 245.0


def _read_image(image_path):
    if np is None:
        raise RuntimeError(
            f"NumPy is not available. Install numpy. Error: {NUMPY_IMPORT_ERROR}"
        )

    if cv2 is not None:
        image = cv2.imread(image_path)
        if image is None:
            raise RuntimeError("Unable to read uploaded image for AI verification.")
        return image, "bgr"

    if Image is None:
        raise RuntimeError(
            "OpenCV and Pillow are unavailable on server. "
            f"OpenCV error: {CV2_IMPORT_ERROR}; Pillow error: {PIL_IMPORT_ERROR}"
        )

    try:
        with Image.open(image_path) as pil_image:
            rgb = pil_image.convert("RGB")
            image = np.array(rgb)
    except Exception as exc:
        raise RuntimeError(f"Unable to read uploaded image for AI verification. {exc}") from exc

    return image, "rgb"


def _to_gray_array(image, color_order):
    if image.ndim == 2:
        return image.astype(np.float32)

    if cv2 is not None and color_order == "bgr":
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)

    if color_order == "rgb":
        red = image[..., 0].astype(np.float32)
        green = image[..., 1].astype(np.float32)
        blue = image[..., 2].astype(np.float32)
    else:
        blue = image[..., 0].astype(np.float32)
        green = image[..., 1].astype(np.float32)
        red = image[..., 2].astype(np.float32)

    return 0.299 * red + 0.587 * green + 0.114 * blue


def _fallback_edge_map(gray):
    grad_y, grad_x = np.gradient(gray)
    grad_mag = np.hypot(grad_x, grad_y)
    threshold = max(12.0, float(np.percentile(grad_mag, 75)))
    return grad_mag > threshold


def _image_quality_check(image, color_order):
    gray = _to_gray_array(image, color_order)
    brightness = float(np.mean(gray))
    variance = float(np.var(gray))
    has_large_rectangle = False
    opencv_error = ""

    if cv2 is not None and color_order == "bgr":
        try:
            # Keep grayscale in uint8 for OpenCV filters to avoid unsupported dtype combos.
            gray_u8 = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = gray_u8.astype(np.float32)
            brightness = float(np.mean(gray))
            variance = float(np.var(gray))
            laplacian_variance = float(cv2.Laplacian(gray_u8, cv2.CV_32F).var())
            edges = cv2.Canny(gray_u8, 50, 150)
            edge_pixels = int(np.sum(edges > 0))
            edge_ratio = edge_pixels / float(edges.size or 1)

            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            frame_area = float(gray.shape[0] * gray.shape[1] or 1)
            for contour in contours:
                contour_area = cv2.contourArea(contour)
                if contour_area < frame_area * 0.22:
                    continue
                perimeter = cv2.arcLength(contour, True)
                if perimeter <= 0:
                    continue
                polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
                if len(polygon) == 4:
                    has_large_rectangle = True
                    break
            quality_engine = "opencv"
        except Exception as exc:
            logger.warning("OpenCV complaint image quality path failed, switching to numpy fallback: %s", exc)
            opencv_error = str(exc)
            laplacian = (
                np.roll(gray, 1, axis=0)
                + np.roll(gray, -1, axis=0)
                + np.roll(gray, 1, axis=1)
                + np.roll(gray, -1, axis=1)
                - (4.0 * gray)
            )
            if gray.shape[0] > 2 and gray.shape[1] > 2:
                laplacian = laplacian[1:-1, 1:-1]
            laplacian_variance = float(np.var(laplacian))

            edges = _fallback_edge_map(gray)
            edge_pixels = int(np.sum(edges))
            edge_ratio = edge_pixels / float(edges.size or 1)
            quality_engine = "numpy_fallback"
    else:
        laplacian = (
            np.roll(gray, 1, axis=0)
            + np.roll(gray, -1, axis=0)
            + np.roll(gray, 1, axis=1)
            + np.roll(gray, -1, axis=1)
            - (4.0 * gray)
        )
        if gray.shape[0] > 2 and gray.shape[1] > 2:
            laplacian = laplacian[1:-1, 1:-1]
        laplacian_variance = float(np.var(laplacian))

        edges = _fallback_edge_map(gray)
        edge_pixels = int(np.sum(edges))
        edge_ratio = edge_pixels / float(edges.size or 1)
        quality_engine = "numpy_fallback"

    checks = {
        "quality_engine": quality_engine,
        "brightness": round(brightness, 2),
        "variance": round(variance, 2),
        "laplacian_variance": round(laplacian_variance, 2),
        "edge_pixels": edge_pixels,
        "edge_ratio": round(edge_ratio, 4),
        "large_rectangle": has_large_rectangle,
    }
    if opencv_error:
        checks["opencv_fallback_reason"] = opencv_error

    if laplacian_variance < MIN_LAPLACIAN_VARIANCE:
        return {
            "ok": False,
            "message": "Rejected: Image is too blurry. Please upload a clear toilet photo.",
            "checks": checks,
        }

    if brightness < MIN_BRIGHTNESS or brightness > MAX_BRIGHTNESS:
        return {
            "ok": False,
            "message": "Rejected: Image lighting is not valid. Please retake in normal light.",
            "checks": checks,
        }

    screenshot_like = (edge_ratio > 0.24 and variance < 950) or (
        has_large_rectangle and edge_ratio > 0.2 and brightness > 150
    )
    if quality_engine == "numpy_fallback":
        screenshot_like = screenshot_like or (edge_ratio > 0.28 and variance < 1100)

    if screenshot_like:
        return {
            "ok": False,
            "message": (
                "Rejected: Screenshot or display-captured image detected. "
                "Upload a real camera photo of the toilet issue."
            ),
            "checks": checks,
        }

    return {
        "ok": True,
        "checks": checks,
    }


@lru_cache(maxsize=1)
def _load_yolo_model():
    if YOLO is None:
        return None, f"Ultralytics YOLO is not available. Install ultralytics. Error: {YOLO_IMPORT_ERROR}"

    weights_path = os.environ.get("YOLO_WEIGHTS_PATH", "yolov8n.pt")
    try:
        return YOLO(weights_path), ""
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.exception("Failed to load YOLO model for complaint image verification")
        return None, f"Failed to load YOLO model: {exc}"


def _detect_toilet(image):
    model, model_error = _load_yolo_model()
    if model is None:
        return {
            "ok": False,
            "message": model_error,
            "toilet_detected": False,
            "best_confidence": 0.0,
            "detections": 0,
        }

    try:
        results = model.predict(
            source=image,
            classes=[TOILET_CLASS_ID],
            conf=MIN_ACCEPTED_CONFIDENCE,
            verbose=False,
        )
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.exception("YOLO inference failed for complaint image verification")
        return {
            "ok": False,
            "message": f"YOLO inference error: {exc}",
            "toilet_detected": False,
            "best_confidence": 0.0,
            "detections": 0,
        }

    best_confidence = 0.0
    detections = 0

    for result in results:
        boxes = getattr(result, "boxes", None)
        if boxes is None or len(boxes) == 0:
            continue
        detections += int(len(boxes))
        conf_values = boxes.conf.tolist() if hasattr(boxes.conf, "tolist") else boxes.conf
        for conf_value in conf_values:
            best_confidence = max(best_confidence, float(conf_value))

    toilet_detected = detections > 0 and best_confidence >= MIN_ACCEPTED_CONFIDENCE
    if not toilet_detected:
        return {
            "ok": True,
            "toilet_detected": False,
            "best_confidence": round(best_confidence, 4),
            "detections": detections,
            "message": "Rejected: No toilet object detected in complaint image.",
        }

    return {
        "ok": True,
        "toilet_detected": True,
        "best_confidence": round(best_confidence, 4),
        "detections": detections,
        "message": "Toilet detected.",
    }


def verify_complaint_image(image_path):
    if not image_path or not os.path.exists(image_path):
        return {
            "approved": False,
            "message": "Rejected: Uploaded image file is missing on server.",
            "checks": {},
        }

    if np is None:
        return {
            "approved": False,
            "message": (
                "Rejected: NumPy is not installed on server. "
                "Install numpy to enable complaint image AI verification."
            ),
            "checks": {},
        }

    if cv2 is None and Image is None:
        return {
            "approved": False,
            "message": (
                "Rejected: Image libraries are not installed on server. "
                "Install opencv-python or pillow to enable complaint image AI verification."
            ),
            "checks": {},
        }

    try:
        image, color_order = _read_image(image_path)
    except Exception as exc:
        return {
            "approved": False,
            "message": f"Rejected: {exc}",
            "checks": {},
        }

    try:
        quality_result = _image_quality_check(image, color_order)
    except Exception as exc:
        return {
            "approved": False,
            "message": (
                "Rejected: Image quality verification failed. "
                "Please capture a clear live image and try again."
            ),
            "checks": {"quality_error": str(exc)},
        }
    if not quality_result.get("ok"):
        return {
            "approved": False,
            "message": quality_result.get("message", "Rejected: Image quality check failed."),
            "checks": {"quality": quality_result.get("checks", {})},
        }

    toilet_result = _detect_toilet(image)
    if not toilet_result.get("ok"):
        return {
            "approved": False,
            "message": f"Rejected: {toilet_result.get('message', 'Toilet detection model unavailable.')}",
            "checks": {
                "quality": quality_result.get("checks", {}),
                "toilet_detection": toilet_result,
            },
        }

    if not toilet_result.get("toilet_detected"):
        return {
            "approved": False,
            "message": toilet_result.get(
                "message", "Rejected: No toilet object detected in complaint image."
            ),
            "checks": {
                "quality": quality_result.get("checks", {}),
                "toilet_detection": toilet_result,
            },
        }

    return {
        "approved": True,
        "message": "Approved",
        "checks": {
            "quality": quality_result.get("checks", {}),
            "toilet_detection": toilet_result,
        },
    }
