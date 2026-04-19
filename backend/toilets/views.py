import json
import random
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.db.models import Avg, Count, FloatField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import ToiletAlert, ToiletRating, Toilets
from .serializers import ToiletSerializer, ToiletRatingSerializer


def _setting_float(name, default, minimum):
    try:
        value = float(getattr(settings, name, default))
    except (TypeError, ValueError):
        value = float(default)
    return max(value, minimum)


_BLYNK_SYNC_CACHE = {"synced_at": 0.0, "payload": None}
_BLYNK_SYNC_LOCK = threading.Lock()
_BLYNK_CACHE_TTL_SECONDS = _setting_float("BLYNK_CACHE_TTL_SECONDS", 1.0, 0.2)
_BLYNK_REQUEST_TIMEOUT_SECONDS = _setting_float("BLYNK_REQUEST_TIMEOUT_SECONDS", 1.2, 0.3)


def _safe_float(value, default=0.0):
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return float(default)


def _clamp_percent(value):
    return round(min(max(float(value), 0.0), 100.0), 2)


def _safe_non_negative_int(value, default=0):
    try:
        parsed = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return max(int(default), 0)
    return max(parsed, 0)


def _motion_to_bool(value):
    raw = str(value).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _build_blynk_url(token, pin):
    query = urlencode({"token": token})
    return f"https://blynk.cloud/external/api/get?{query}&{pin}"


def _fetch_blynk_pin_value(token, pin):
    if not token:
        return None

    url = _build_blynk_url(token, pin)
    try:
        with urlopen(url, timeout=_BLYNK_REQUEST_TIMEOUT_SECONDS) as response:
            raw_value = response.read().decode("utf-8").strip()
    except Exception:
        return None

    if not raw_value:
        return None

    try:
        parsed = json.loads(raw_value)
    except ValueError:
        return raw_value

    if isinstance(parsed, list):
        if not parsed:
            return None
        return parsed[0]
    return parsed


def _fetch_blynk_pin_values(token):
    pin_map = {
        "gas": getattr(settings, "BLYNK_GAS_PIN", "V0"),
        "water": getattr(settings, "BLYNK_WATER_PIN", "V1"),
        "dustbin": getattr(settings, "BLYNK_DUSTBIN_PIN", "V2"),
        "people": getattr(settings, "BLYNK_PEOPLE_PIN", "V3"),
        "motion": getattr(settings, "BLYNK_MOTION_PIN", "V4"),
    }
    if not token:
        return {key: None for key in pin_map}

    with ThreadPoolExecutor(max_workers=len(pin_map)) as executor:
        futures = {
            key: executor.submit(_fetch_blynk_pin_value, token, pin)
            for key, pin in pin_map.items()
        }
        values = {}
        for key, future in futures.items():
            try:
                values[key] = future.result()
            except Exception:
                values[key] = None
        return values


def _build_sensor_snapshot():
    cached_payload = _BLYNK_SYNC_CACHE.get("payload") or {}
    token = getattr(settings, "BLYNK_AUTH_TOKEN", "").strip()

    pin_values = _fetch_blynk_pin_values(token)
    gas_raw = pin_values["gas"]
    water_raw = pin_values["water"]
    dustbin_raw = pin_values["dustbin"]
    people_raw = pin_values["people"]
    motion_raw = pin_values["motion"]

    gas_level = _safe_float(gas_raw, cached_payload.get("gas_level", 0.0))
    water_level = _clamp_percent(_safe_float(water_raw, cached_payload.get("water_level", 0.0)))
    dustbin_level = _clamp_percent(_safe_float(dustbin_raw, cached_payload.get("dustbin_level", 0.0)))
    people_count = _safe_non_negative_int(people_raw, cached_payload.get("people_count", 0))

    motion_detected = (
        _motion_to_bool(motion_raw)
        if motion_raw is not None
        else bool(cached_payload.get("motion_detected", False))
    )
    status_text = "IN USE" if motion_detected else "FREE"

    cleanliness = _clamp_percent(100.0 - dustbin_level)
    health_score = round((cleanliness + water_level) / 2.0, 2)

    gas_high_threshold = _safe_float(getattr(settings, "BLYNK_GAS_HIGH_THRESHOLD", 70), 70)
    dustbin_full_threshold = _safe_float(getattr(settings, "BLYNK_DUSTBIN_FULL_THRESHOLD", 80), 80)
    water_low_threshold = _safe_float(getattr(settings, "BLYNK_WATER_LOW_THRESHOLD", 20), 20)

    is_gas_high = gas_level > gas_high_threshold
    is_dustbin_full = dustbin_level > dustbin_full_threshold
    is_water_low = water_level < water_low_threshold
    has_critical_alert = is_gas_high or is_dustbin_full or is_water_low

    return {
        "gas_level": round(gas_level, 2),
        "water_level": water_level,
        "dustbin_level": dustbin_level,
        "people_count": people_count,
        "motion_detected": motion_detected,
        "motion": 1 if motion_detected else 0,
        "status": status_text,
        "cleanliness": cleanliness,
        "health_score": health_score,
        "alert_level": 3 if has_critical_alert else 1,
        "is_gas_high": is_gas_high,
        "is_dustbin_full": is_dustbin_full,
        "is_water_low": is_water_low,
        "fan_on_alert": is_gas_high,
        "thresholds": {
            "gas_high": gas_high_threshold,
            "dustbin_full": dustbin_full_threshold,
            "water_low": water_low_threshold,
        },
    }


def _upsert_alert(toilet, alert_type, message, priority=ToiletAlert.PRIORITY_HIGH):
    existing = (
        toilet.alerts.filter(
            alert_type=alert_type,
            status=ToiletAlert.STATUS_PENDING,
        )
        .order_by("-created_at")
        .first()
    )
    if existing:
        changed_fields = []
        if existing.message != message:
            existing.message = message
            changed_fields.append("message")
        if existing.priority != priority:
            existing.priority = priority
            changed_fields.append("priority")
        if changed_fields:
            existing.save(update_fields=changed_fields + ["updated_at"])
        return existing

    return ToiletAlert.objects.create(
        toilet=toilet,
        alert_type=alert_type,
        message=message,
        priority=priority,
        status=ToiletAlert.STATUS_PENDING,
    )


def _resolve_pending_alerts(toilet, alert_type):
    pending = toilet.alerts.filter(alert_type=alert_type, status=ToiletAlert.STATUS_PENDING)
    for alert in pending:
        alert.mark_resolved()


def _sync_alerts_for_toilet(toilet, sensor_snapshot):
    if sensor_snapshot["is_gas_high"]:
        _upsert_alert(
            toilet,
            ToiletAlert.TYPE_HIGH_GAS,
            f"Gas level is high ({sensor_snapshot['gas_level']:.1f}).",
        )
    else:
        _resolve_pending_alerts(toilet, ToiletAlert.TYPE_HIGH_GAS)

    if sensor_snapshot["is_dustbin_full"]:
        _upsert_alert(
            toilet,
            ToiletAlert.TYPE_DUSTBIN_FULL,
            f"Dustbin level is high ({sensor_snapshot['dustbin_level']:.1f}%).",
        )
    else:
        _resolve_pending_alerts(toilet, ToiletAlert.TYPE_DUSTBIN_FULL)

    if sensor_snapshot["is_water_low"]:
        _upsert_alert(
            toilet,
            ToiletAlert.TYPE_LOW_WATER,
            f"Water level is low ({sensor_snapshot['water_level']:.1f}%).",
        )
    else:
        _resolve_pending_alerts(toilet, ToiletAlert.TYPE_LOW_WATER)

    # Disable legacy cleanliness-based alerting now that Blynk sensors are source-of-truth.
    _resolve_pending_alerts(toilet, ToiletAlert.TYPE_LOW_CLEANLINESS)


def _sync_all_toilets_from_blynk(force=False):
    def _perform_sync():
        synced_at = time.monotonic()
        sensor_snapshot = _build_sensor_snapshot()
        toilets = list(Toilets.objects.only("id"))
        toilet_ids = [toilet.id for toilet in toilets]
        if toilet_ids:
            Toilets.objects.filter(id__in=toilet_ids).update(
                usage_count=sensor_snapshot["people_count"],
                water_level=sensor_snapshot["water_level"],
                gas_level=sensor_snapshot["gas_level"],
                dustbin_level=sensor_snapshot["dustbin_level"],
                motion_detected=sensor_snapshot["motion_detected"],
                cleanliness=sensor_snapshot["cleanliness"],
                health_score=sensor_snapshot["health_score"],
                alert_level=sensor_snapshot["alert_level"],
                status=sensor_snapshot["status"],
                updated_at=timezone.now(),
            )

            for toilet in toilets:
                _sync_alerts_for_toilet(toilet, sensor_snapshot)

        sensor_snapshot["updated_toilets"] = len(toilet_ids)
        _BLYNK_SYNC_CACHE["synced_at"] = synced_at
        _BLYNK_SYNC_CACHE["payload"] = sensor_snapshot
        return sensor_snapshot

    now = time.monotonic()
    cached_at = _BLYNK_SYNC_CACHE.get("synced_at") or 0.0
    cached_payload = _BLYNK_SYNC_CACHE.get("payload")
    if not force and cached_payload and now - cached_at < _BLYNK_CACHE_TTL_SECONDS:
        return cached_payload

    if force:
        with _BLYNK_SYNC_LOCK:
            return _perform_sync()

    lock_acquired = _BLYNK_SYNC_LOCK.acquire(blocking=False)
    if not lock_acquired:
        # Serve the latest cached snapshot immediately while another request refreshes Blynk.
        if cached_payload:
            return cached_payload
        with _BLYNK_SYNC_LOCK:
            latest_payload = _BLYNK_SYNC_CACHE.get("payload")
            if latest_payload:
                return latest_payload
            return _perform_sync()

    try:
        now = time.monotonic()
        cached_at = _BLYNK_SYNC_CACHE.get("synced_at") or 0.0
        cached_payload = _BLYNK_SYNC_CACHE.get("payload")
        if cached_payload and now - cached_at < _BLYNK_CACHE_TTL_SECONDS:
            return cached_payload
        return _perform_sync()
    finally:
        _BLYNK_SYNC_LOCK.release()


def _inject_sensor_fields(toilet_data, sensor_snapshot):
    toilet_data["usage_count"] = sensor_snapshot["people_count"]
    toilet_data["water_level"] = sensor_snapshot["water_level"]
    toilet_data["cleanliness"] = sensor_snapshot["cleanliness"]
    toilet_data["health_score"] = sensor_snapshot["health_score"]
    toilet_data["alert_level"] = sensor_snapshot["alert_level"]
    toilet_data["status"] = sensor_snapshot["status"]
    toilet_data["gas_level"] = sensor_snapshot["gas_level"]
    toilet_data["dustbin_level"] = sensor_snapshot["dustbin_level"]
    toilet_data["motion_detected"] = sensor_snapshot["motion_detected"]
    toilet_data["people_count"] = sensor_snapshot["people_count"]
    toilet_data["motion"] = sensor_snapshot["motion"]
    toilet_data["fan_on_alert"] = sensor_snapshot["fan_on_alert"]


def _toilet_payload(toilet, message, action, added_users=0):
    return {
        "message": message,
        "action": action,
        "added_users": added_users,
        "toilet": ToiletSerializer(toilet).data,
    }


def _safe_positive_int(value, default=1):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(parsed, 0)


def _normalize_action(action):
    raw = str(action or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return normalized


def _extract_users_from_action(action):
    match = re.search(r"(\d+)", str(action or ""))
    if not match:
        return None
    return _safe_positive_int(match.group(1), default=0)


def _resolve_request_user_from_token(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "token":
        return None

    token_key = parts[1].strip()
    if not token_key:
        return None

    token_obj = Token.objects.select_related("user").filter(key=token_key).first()
    return token_obj.user if token_obj else None


def _annotated_toilet_queryset(user=None):
    toilets = Toilets.objects.all().annotate(
        average_rating=Coalesce(
            Avg("ratings__rating"),
            Value(0.0),
            output_field=FloatField(),
        ),
        ratings_count=Count("ratings"),
    )

    if user:
        user_rating_query = ToiletRating.objects.filter(
            toilet_id=OuterRef("pk"),
            submitted_by=user,
        ).values("rating")[:1]
        toilets = toilets.annotate(my_rating=Subquery(user_rating_query))

    return toilets


@api_view(["GET"])
def get_toilets(request):
    sensor_snapshot = _sync_all_toilets_from_blynk()
    requesting_user = _resolve_request_user_from_token(request)
    toilets = _annotated_toilet_queryset(user=requesting_user)
    serializer = ToiletSerializer(
        toilets,
        many=True,
        context={
            "request": request,
            "rating_user_id": requesting_user.id if requesting_user else None,
        },
    )
    response_data = serializer.data
    for toilet_data in response_data:
        _inject_sensor_fields(toilet_data, sensor_snapshot)
    return Response(response_data)


@api_view(["GET"])
def get_sensor_data(request):
    sensor_snapshot = _sync_all_toilets_from_blynk(force=True)
    alerts = []
    if sensor_snapshot["is_gas_high"]:
        alerts.append(ToiletAlert.TYPE_HIGH_GAS)
    if sensor_snapshot["is_dustbin_full"]:
        alerts.append(ToiletAlert.TYPE_DUSTBIN_FULL)
    if sensor_snapshot["is_water_low"]:
        alerts.append(ToiletAlert.TYPE_LOW_WATER)

    return Response(
        {
            "gas": sensor_snapshot["gas_level"],
            "water": sensor_snapshot["water_level"],
            "dustbin": sensor_snapshot["dustbin_level"],
            "people": sensor_snapshot["people_count"],
            "motion": sensor_snapshot["motion"],
            "status": sensor_snapshot["status"],
            "alerts": alerts,
            "fan_on_alert": sensor_snapshot["fan_on_alert"],
            "updated_toilets": sensor_snapshot.get("updated_toilets", 0),
        }
    )


@api_view(["POST"])
def enter_toilet(request, pk):
    toilet = get_object_or_404(Toilets, id=pk)
    toilet.usage_count += 1
    toilet.save()
    serializer = ToiletSerializer(toilet)
    return Response(serializer.data)


@api_view(["PUT"])
def clean_toilet(request, pk):
    toilet = get_object_or_404(Toilets, id=pk)
    toilet.usage_count = 0
    toilet.cleanliness = 100
    toilet.water_level = 100
    toilet.status = "Good"
    toilet.health_score = 100
    toilet.alert_level = 1
    toilet.save()
    serializer = ToiletSerializer(toilet)
    return Response(serializer.data)


@api_view(["POST"])
def rate_toilet(request, pk):
    user = _resolve_request_user_from_token(request)
    if not user:
        return Response({"detail": "Login is required to submit rating."}, status=401)

    toilet = get_object_or_404(Toilets, id=pk)
    raw_rating = request.data.get("rating")
    raw_comment = request.data.get("comment", "").strip()
    
    try:
        rating_value = int(raw_rating)
    except (TypeError, ValueError):
        return Response({"detail": "Rating must be an integer from 1 to 5."}, status=400)

    if rating_value < 1 or rating_value > 5:
        return Response({"detail": "Rating must be between 1 and 5."}, status=400)

    if len(raw_comment) > 500:
        return Response({"detail": "Comment must be 500 characters or less."}, status=400)

    ToiletRating.objects.update_or_create(
        toilet=toilet,
        submitted_by=user,
        defaults={"rating": rating_value, "comment": raw_comment},
    )

    refreshed_toilet = _annotated_toilet_queryset(user=user).filter(pk=toilet.pk).first()
    serializer = ToiletSerializer(
        refreshed_toilet,
        context={
            "request": request,
            "rating_user_id": user.id,
        },
    )
    return Response(
        {
            "detail": "Review submitted successfully.",
            "toilet": serializer.data,
        }
    )


@api_view(["GET"])
def get_toilet_reviews(request, pk):
    requesting_user = _resolve_request_user_from_token(request)
    toilet = get_object_or_404(Toilets, id=pk)
    ratings = toilet.ratings.select_related("submitted_by").order_by("-created_at")[:20]  # Recent 20
    serializer = ToiletRatingSerializer(ratings, many=True)
    return Response({
        "toilet_id": pk,
        "count": toilet.ratings.count(),
        "reviews": serializer.data
    })


@api_view(["GET", "POST"])
def simulate_usage(request, pk):
    toilet = get_object_or_404(Toilets, pk=pk)

    if request.method == "GET":
        users = _safe_positive_int(
            request.query_params.get("users", request.query_params.get("value", 1)),
            default=1,
        )
        if users <= 0:
            return Response({"error": "users must be at least 1."}, status=400)

        toilet.usage_count += users
        toilet.save()
        return Response(
            _toilet_payload(
                toilet,
                message=f"QR simulation recorded {users} user(s).",
                action="qr_scan",
                added_users=users,
            )
        )

    raw_action = request.data.get("action", request.query_params.get("action", "increase_usage"))
    action = _normalize_action(raw_action)
    value = _safe_positive_int(
        request.data.get("value", request.query_params.get("value", request.query_params.get("users", 1))),
        default=1,
    )
    added_users = 0

    if action in {
        "increase_usage",
        "incraese_usage",
        "increase",
        "add_users",
        "add_user",
        "plus_1_user",
        "one_user",
        "qr_scan",
        "qr",
    }:
        if value <= 0:
            return Response({"error": "value must be at least 1."}, status=400)
        toilet.usage_count += value
        added_users = value
        message = f"Usage increased by {value}."
    elif action in {"bulk_usage", "bulk", "bulk_users", "simulate_users", "simulate"}:
        if value <= 0:
            return Response({"error": "value must be at least 1."}, status=400)
        toilet.usage_count += value
        added_users = value
        message = f"Bulk simulation added {value} users."
    elif action in {"peak_hour", "morning_rush", "rush_hour", "peak"}:
        rush_users = random.randint(30, 50)
        toilet.usage_count += rush_users
        added_users = rush_users
        message = f"Peak hour simulation added {rush_users} users."
    elif action in {"force_critical", "trigger_emergency", "emergency", "critical"}:
        toilet.cleanliness = 20
        toilet.water_level = 10
        message = "Emergency simulation triggered. Toilet forced to critical."
    elif action in {"reset", "reset_toilet", "reset_state"}:
        toilet.usage_count = 0
        toilet.cleanliness = 100
        toilet.water_level = 100
        toilet.health_score = 100
        toilet.status = "Good"
        toilet.alert_level = 1
        message = "Toilet reset to optimal state."
    else:
        users_from_action = _extract_users_from_action(action)
        if users_from_action and users_from_action > 0:
            toilet.usage_count += users_from_action
            added_users = users_from_action
            message = f"Usage increased by {users_from_action}."
        elif value > 0:
            toilet.usage_count += value
            added_users = value
            message = f"Usage increased by {value}."
        else:
            return Response({"error": "Invalid action."}, status=400)

    toilet.save()
    return Response(_toilet_payload(toilet, message=message, action=action, added_users=added_users))
