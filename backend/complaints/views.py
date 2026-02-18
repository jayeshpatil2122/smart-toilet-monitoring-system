from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Complaint
from .serializers import ComplaintSerializer


@api_view(["GET"])
def get_complaints(request):
    complaints = Complaint.objects.all().select_related("toilet", "assigned_to").order_by("-created_at")
    serializer = ComplaintSerializer(complaints, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
def create_complaint(request):
    serializer = ComplaintSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


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
