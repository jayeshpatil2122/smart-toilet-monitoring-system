import random
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import Group, User
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from complaints.models import Complaint
from .models import WorkerPasswordReset
from .serializers import (
    PortalForgotPasswordSerializer,
    PortalLoginSerializer,
    PortalResetPasswordSerializer,
    PortalSignupSerializer,
    WorkerComplaintSerializer,
    WorkerForgotPasswordSerializer,
    WorkerLoginSerializer,
    WorkerResetPasswordSerializer,
    WorkerSignupSerializer,
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


@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
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

    complaint.status = status_value
    complaint.save()
    serializer = WorkerComplaintSerializer(complaint, context={"request": request})
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
