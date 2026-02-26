import random
import re

from django.db.models import Avg, Count, FloatField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import ToiletRating, Toilets
from .serializers import ToiletSerializer


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
    return Response(serializer.data)


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
    try:
        rating_value = int(raw_rating)
    except (TypeError, ValueError):
        return Response({"detail": "Rating must be an integer from 1 to 5."}, status=400)

    if rating_value < 1 or rating_value > 5:
        return Response({"detail": "Rating must be between 1 and 5."}, status=400)

    ToiletRating.objects.update_or_create(
        toilet=toilet,
        submitted_by=user,
        defaults={"rating": rating_value},
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
            "detail": "Rating submitted successfully.",
            "toilet": serializer.data,
        }
    )


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
