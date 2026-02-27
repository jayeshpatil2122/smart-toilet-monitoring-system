import os
import tempfile

from django.db.models import Count
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .ai_image_check import verify_complaint_image
from .models import Complaint
from .serializers import ComplaintSerializer


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


def _save_upload_to_temp_file(upload, default_suffix=".jpg"):
    suffix = os.path.splitext(str(getattr(upload, "name", "")))[1] or default_suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        for chunk in upload.chunks():
            temp_file.write(chunk)
        return temp_file.name


@api_view(["GET"])
def get_complaints(request):
    complaints = Complaint.objects.all().select_related("toilet", "assigned_to").order_by("-created_at")
    serializer = ComplaintSerializer(complaints, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
def create_complaint(request):
    uploaded_image = request.FILES.get("image")
    if not uploaded_image:
        return Response(
            {"detail": "Capture and upload live toilet image before submitting complaint."},
            status=400,
        )

    content_type = str(getattr(uploaded_image, "content_type", "") or "").lower()
    if content_type and not content_type.startswith("image/"):
        return Response({"detail": "Invalid file type. Upload a valid image."}, status=400)

    temp_image_path = None
    verification_result = None

    try:
        temp_image_path = _save_upload_to_temp_file(uploaded_image, default_suffix=".jpg")
        try:
            verification_result = verify_complaint_image(temp_image_path)
        except Exception as exc:
            verification_result = {
                "approved": False,
                "message": f"Rejected: Complaint image AI verification failed. {exc}",
                "checks": {},
            }
    finally:
        if temp_image_path and os.path.exists(temp_image_path):
            os.remove(temp_image_path)
        try:
            uploaded_image.seek(0)
        except Exception:
            pass

    if not verification_result.get("approved"):
        return Response(
            {
                "detail": verification_result.get(
                    "message",
                    "Complaint image verification failed.",
                ),
                "verification": verification_result,
            },
            status=400,
        )

    serializer = ComplaintSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        submitting_user = _resolve_request_user_from_token(request)
        serializer.save(submitted_by=submitting_user)
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def my_complaints(request):
    complaints = (
        Complaint.objects.filter(submitted_by=request.user)
        .select_related("toilet", "assigned_to", "submitted_by")
        .order_by("-created_at")
    )
    serializer = ComplaintSerializer(complaints, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
def complaint_dashboard(request):
    total = Complaint.objects.count()
    pending = Complaint.objects.filter(status="Pending").count()
    resolved = Complaint.objects.filter(status="Resolved").count()
    high_priority = Complaint.objects.filter(priority="High").count()
    escalated = Complaint.objects.filter(is_escalated=True).count()

    data = {
        "total_complaints": total,
        "pending_complaints": pending,
        "resolved_complaints": resolved,
        "high_priority_complaints": high_priority,
        "escalated_complaints": escalated,
    }
    return Response(data)


@api_view(["GET"])
def complaints_per_toilet(request):
    data = (
        Complaint.objects.values("toilet_id", "toilet__name")
        .annotate(total_complaints=Count("id"))
        .order_by("-total_complaints")
    )

    formatted_data = [
        {
            "toilet_id": item["toilet_id"],
            "toilet_name": item["toilet__name"],
            "total_complaints": item["total_complaints"],
        }
        for item in data
    ]
    return Response(formatted_data)


@api_view(["GET"])
def staff_performance(request):
    data = (
        Complaint.objects.filter(status="Resolved", assigned_to__isnull=False)
        .values("assigned_to__username")
        .annotate(resolved_count=Count("id"))
        .order_by("-resolved_count")
    )

    formatted = [
        {
            "staff_name": item["assigned_to__username"],
            "resolved_complaints": item["resolved_count"],
        }
        for item in data
    ]
    return Response(formatted)
