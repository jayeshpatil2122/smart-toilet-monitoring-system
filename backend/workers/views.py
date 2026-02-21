import json
import random
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group, User
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    parser_classes,
    permission_classes,
)
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from complaints.models import Complaint
from toilets.models import ToiletAlert
from .models import WorkerPasswordReset
from .serializers import (
    PortalForgotPasswordSerializer,
    PortalGoogleLoginSerializer,
    PortalLoginSerializer,
    PortalResetPasswordSerializer,
    PortalSignupSerializer,
    WorkerComplaintSerializer,
    WorkerForgotPasswordSerializer,
    WorkerLoginSerializer,
    WorkerResetPasswordSerializer,
    WorkerSignupSerializer,
    WorkerToiletAlertSerializer,
)

WORKER_GROUP_NAME = "Worker"
PORTAL_GROUP_NAME = "PortalUser"


def _is_worker(user):
    return user.groups.filter(name=WORKER_GROUP_NAME).exists()


def _worker_user_queryset():
    return User.objects.filter(groups__name=WORKER_GROUP_NAME).distinct()


def _is_portal_user(user):
    return user.groups.filter(name=PORTAL_GROUP_NAME).exists()


def _portal_user_queryset():
    return User.objects.filter(groups__name=PORTAL_GROUP_NAME).distinct()


def _build_google_username(email):
    seed = (email.split("@", 1)[0] if email else "").lower()
    seed = "".join(ch for ch in seed if ch.isalnum() or ch in {"_", "."})
    base_username = (seed or "portaluser")[:150]

    candidate = base_username
    counter = 1
    while User.objects.filter(username=candidate).exists():
        suffix = f"_{counter}"
        candidate = f"{base_username[: 150 - len(suffix)]}{suffix}"
        counter += 1
    return candidate


def _verify_google_id_token(id_token):
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        return None, "Google login is not configured."

    token_info_url = (
        "https://oauth2.googleapis.com/tokeninfo?"
        f"{urlencode({'id_token': id_token})}"
    )
    try:
        with urlopen(token_info_url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError:
        return None, "Invalid Google token."
    except (URLError, TimeoutError, ValueError):
        return None, "Unable to verify Google token right now."

    if payload.get("aud") != settings.GOOGLE_OAUTH_CLIENT_ID:
        return None, "Google token audience mismatch."

    issuer = payload.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        return None, "Invalid Google token issuer."

    if payload.get("email_verified") not in {"true", True}:
        return None, "Google account email is not verified."

    email = str(payload.get("email", "")).strip().lower()
    if not email:
        return None, "Google account email is missing."

    payload["email"] = email
    return payload, None


@api_view(["POST"])
def worker_signup(request):
    serializer = WorkerSignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    if User.objects.filter(username=username).exists():
        return Response({"detail": "Username already exists."}, status=400)

    email = serializer.validated_data.get("email", "")
    if email and User.objects.filter(email=email).exists():
        return Response({"detail": "Email already exists."}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=serializer.validated_data["password"],
        first_name=serializer.validated_data.get("first_name", ""),
        last_name=serializer.validated_data.get("last_name", ""),
    )

    worker_group, _ = Group.objects.get_or_create(name=WORKER_GROUP_NAME)
    user.groups.add(worker_group)

    return Response({"detail": "Worker account created successfully."}, status=201)


@api_view(["POST"])
def worker_login(request):
    serializer = WorkerLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
    )
    if not user:
        return Response({"detail": "Invalid username or password."}, status=401)

    if not _is_worker(user):
        return Response({"detail": "This account is not registered as a worker."}, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "worker": {
                "id": user.id,
                "username": user.username,
                "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                "email": user.email,
            },
        }
    )


@api_view(["POST"])
def worker_forgot_password(request):
    serializer = WorkerForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    value = serializer.validated_data["username_or_email"]

    user = _worker_user_queryset().filter(username=value).first()
    if not user:
        user = _worker_user_queryset().filter(email=value).first()

    if not user:
        return Response({"detail": "If the account exists, a reset code was generated."})

    WorkerPasswordReset.objects.filter(user=user, is_used=False).update(is_used=True)
    code = f"{random.randint(100000, 999999)}"
    WorkerPasswordReset.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=15),
    )

    # In production this code should be sent over email/SMS instead of response body.
    return Response(
        {
            "detail": "Reset code generated. It expires in 15 minutes.",
            "reset_code": code,
        }
    )


@api_view(["POST"])
def worker_reset_password(request):
    serializer = WorkerResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    code = serializer.validated_data["code"]
    new_password = serializer.validated_data["new_password"]

    user = _worker_user_queryset().filter(username=username).first()
    if not user:
        return Response({"detail": "Invalid reset request."}, status=400)

    reset_obj = (
        WorkerPasswordReset.objects.filter(
            user=user,
            code=code,
            is_used=False,
            expires_at__gt=timezone.now(),
        )
        .order_by("-created_at")
        .first()
    )
    if not reset_obj:
        return Response({"detail": "Invalid or expired reset code."}, status=400)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    reset_obj.is_used = True
    reset_obj.save(update_fields=["is_used"])

    Token.objects.filter(user=user).delete()
    return Response({"detail": "Password reset successful. Please login again."})


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def worker_my_complaints(request):
    if not _is_worker(request.user):
        return Response({"detail": "Worker access required."}, status=403)

    complaints = (
        Complaint.objects.filter(assigned_to=request.user)
        .select_related("toilet", "assigned_to")
        .order_by("-created_at")
    )
    serializer = WorkerComplaintSerializer(complaints, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["PATCH", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def worker_update_complaint_status(request, complaint_id):
    if not _is_worker(request.user):
        return Response({"detail": "Worker access required."}, status=403)

    complaint = Complaint.objects.filter(id=complaint_id, assigned_to=request.user).first()
    if not complaint:
        return Response({"detail": "Complaint not found for this worker."}, status=404)

    status_value = request.data.get("status")
    valid_statuses = {choice[0] for choice in Complaint.STATUS_CHOICES}
    if status_value not in valid_statuses:
        return Response(
            {"detail": f"Invalid status. Allowed values: {', '.join(sorted(valid_statuses))}."},
            status=400,
        )

    after_image = request.FILES.get("after_image")
    if status_value == "Resolved" and not after_image and not complaint.after_image:
        return Response(
            {"detail": "Upload AFTER image before marking complaint as resolved."},
            status=400,
        )

    if after_image:
        complaint.after_image = after_image

    complaint.status = status_value
    complaint.save()
    serializer = WorkerComplaintSerializer(complaint, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def worker_my_alerts(request):
    if not _is_worker(request.user):
        return Response({"detail": "Worker access required."}, status=403)

    alerts = (
        ToiletAlert.objects.filter(assigned_to=request.user)
        .select_related("toilet", "assigned_to", "resolved_by")
        .order_by("status", "-created_at")
    )
    serializer = WorkerToiletAlertSerializer(alerts, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["PATCH", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def worker_update_alert_status(request, alert_id):
    if not _is_worker(request.user):
        return Response({"detail": "Worker access required."}, status=403)

    alert = (
        ToiletAlert.objects.filter(id=alert_id, assigned_to=request.user)
        .select_related("toilet", "assigned_to", "resolved_by")
        .first()
    )
    if not alert:
        return Response({"detail": "Alert not found for this worker."}, status=404)

    status_value = request.data.get("status")
    valid_statuses = {choice[0] for choice in ToiletAlert.STATUS_CHOICES}
    if status_value not in valid_statuses:
        return Response(
            {"detail": f"Invalid status. Allowed values: {', '.join(sorted(valid_statuses))}."},
            status=400,
        )

    if status_value == ToiletAlert.STATUS_RESOLVED:
        alert.toilet.reset_to_optimal_state(resolved_by=request.user)
        alert.refresh_from_db()
    else:
        alert.mark_pending()

    serializer = WorkerToiletAlertSerializer(alert, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
def portal_signup(request):
    serializer = PortalSignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    if User.objects.filter(username=username).exists():
        return Response({"detail": "Username already exists."}, status=400)

    email = serializer.validated_data.get("email", "")
    if email and User.objects.filter(email=email).exists():
        return Response({"detail": "Email already exists."}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=serializer.validated_data["password"],
        first_name=serializer.validated_data.get("first_name", ""),
        last_name=serializer.validated_data.get("last_name", ""),
    )

    group, _ = Group.objects.get_or_create(name=PORTAL_GROUP_NAME)
    user.groups.add(group)

    return Response({"detail": "User account created successfully."}, status=201)


@api_view(["POST"])
def portal_login(request):
    serializer = PortalLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
    )
    if not user:
        return Response({"detail": "Invalid username or password."}, status=401)

    if not _is_portal_user(user):
        return Response({"detail": "This account is not registered for the user portal."}, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                "email": user.email,
            },
        }
    )


@api_view(["POST"])
def portal_google_login(request):
    serializer = PortalGoogleLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    payload, error_message = _verify_google_id_token(serializer.validated_data["id_token"])
    if error_message:
        return Response({"detail": error_message}, status=401)

    email = payload["email"]
    first_name = str(payload.get("given_name", "")).strip()
    last_name = str(payload.get("family_name", "")).strip()

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        user = User(
            username=_build_google_username(email),
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        user.set_unusable_password()
        user.save()
    else:
        updates = []
        if first_name and not user.first_name:
            user.first_name = first_name
            updates.append("first_name")
        if last_name and not user.last_name:
            user.last_name = last_name
            updates.append("last_name")
        if updates:
            user.save(update_fields=updates)

    group, _ = Group.objects.get_or_create(name=PORTAL_GROUP_NAME)
    user.groups.add(group)

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                "email": user.email,
            },
        }
    )


@api_view(["POST"])
def portal_forgot_password(request):
    serializer = PortalForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    value = serializer.validated_data["username_or_email"]

    user = _portal_user_queryset().filter(username=value).first()
    if not user:
        user = _portal_user_queryset().filter(email=value).first()

    if not user:
        return Response({"detail": "If the account exists, a reset code was generated."})

    WorkerPasswordReset.objects.filter(user=user, is_used=False).update(is_used=True)
    code = f"{random.randint(100000, 999999)}"
    WorkerPasswordReset.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=15),
    )

    return Response(
        {
            "detail": "Reset code generated. It expires in 15 minutes.",
            "reset_code": code,
        }
    )


@api_view(["POST"])
def portal_reset_password(request):
    serializer = PortalResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    code = serializer.validated_data["code"]
    new_password = serializer.validated_data["new_password"]

    user = _portal_user_queryset().filter(username=username).first()
    if not user:
        return Response({"detail": "Invalid reset request."}, status=400)

    reset_obj = (
        WorkerPasswordReset.objects.filter(
            user=user,
            code=code,
            is_used=False,
            expires_at__gt=timezone.now(),
        )
        .order_by("-created_at")
        .first()
    )
    if not reset_obj:
        return Response({"detail": "Invalid or expired reset code."}, status=400)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    reset_obj.is_used = True
    reset_obj.save(update_fields=["is_used"])

    Token.objects.filter(user=user).delete()
    return Response({"detail": "Password reset successful. Please login again."})
