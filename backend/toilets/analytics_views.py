from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Count, Q
from django.shortcuts import render
from django.utils import timezone

from complaints.models import Complaint
from toilets.models import CleaningHistory, SensorFailureLog, SensorStatus, Toilets


@staff_member_required
def admin_analytics_view(request):
    # Ensure sensor state evaluation is current
    try:
        SensorStatus.refresh_all_from_blynk()
    except Exception:
        pass

    # 1. Toilet Cleanliness Analytics
    total_toilets = Toilets.objects.count()
    clean_toilets = Toilets.objects.filter(cleanliness__gte=70).count()
    moderate_toilets = Toilets.objects.filter(cleanliness__gte=40, cleanliness__lt=70).count()
    dirty_toilets = Toilets.objects.filter(cleanliness__lt=40).count()

    toilets_list = Toilets.objects.all().order_by("-cleanliness")
    toilet_cleanliness_data = [
        {
            "name": t.name,
            "cleanliness": float(t.cleanliness),
            "water": float(t.water_level),
            "health": float(t.health_score),
            "status": t.status,
        }
        for t in toilets_list
    ]

    # 2. Complaint Analytics
    total_complaints = Complaint.objects.count()
    pending_complaints = Complaint.objects.filter(status="Pending").count()
    in_progress_complaints = Complaint.objects.filter(status="In Progress").count()
    resolved_complaints = Complaint.objects.filter(status="Resolved").count()

    complaints_by_toilet = list(
        Complaint.objects.values("toilet__name")
        .annotate(
            total=Count("id"),
            pending=Count("id", filter=Q(status="Pending")),
            in_progress=Count("id", filter=Q(status="In Progress")),
            resolved=Count("id", filter=Q(status="Resolved")),
        )
        .order_by("-total")
    )

    complaint_types = list(
        Complaint.objects.values("issue_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    # 3. Complaint Resolution Analytics
    resolution_rate = round((resolved_complaints / total_complaints * 100), 1) if total_complaints > 0 else 100.0
    avg_resolution_hours = 0.0
    resolved_qs = Complaint.objects.filter(status="Resolved", resolution_time__isnull=False)
    if resolved_qs.exists():
        total_seconds = sum(c.resolution_time.total_seconds() for c in resolved_qs if c.resolution_time)
        avg_resolution_hours = round(total_seconds / max(1, resolved_qs.count()) / 3600.0, 1)

    # 4. Sensor Status Analytics
    total_sensors = SensorStatus.objects.count()
    online_sensors = SensorStatus.objects.filter(is_working=True).count()
    offline_sensors = SensorStatus.objects.filter(is_working=False).count()
    active_failure_alerts = list(SensorFailureLog.objects.filter(is_active=True))
    failed_sensors_count = len(active_failure_alerts)
    invalid_data_sensors = sum(1 for a in active_failure_alerts if a.status == SensorFailureLog.STATUS_INVALID_DATA)

    sensor_statuses_list = list(SensorStatus.objects.all().order_by("sensor_name"))

    # 5. Cleaning Activity Analytics
    total_cleanings = CleaningHistory.objects.count()
    cleanings_by_toilet = list(
        CleaningHistory.objects.values("toilet__name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    recent_cleanings = list(
        CleaningHistory.objects.select_related("toilet", "cleaned_by").order_by("-cleaned_at")[:15]
    )

    context = {
        "title": "Analytics & Graphs Dashboard",
        "total_toilets": total_toilets,
        "clean_toilets": clean_toilets,
        "moderate_toilets": moderate_toilets,
        "dirty_toilets": dirty_toilets,
        "toilet_cleanliness_data": toilet_cleanliness_data,
        "total_complaints": total_complaints,
        "pending_complaints": pending_complaints,
        "in_progress_complaints": in_progress_complaints,
        "resolved_complaints": resolved_complaints,
        "complaints_by_toilet": complaints_by_toilet,
        "complaint_types": complaint_types,
        "resolution_rate": resolution_rate,
        "avg_resolution_hours": avg_resolution_hours,
        "total_sensors": total_sensors,
        "online_sensors": online_sensors,
        "offline_sensors": offline_sensors,
        "failed_sensors_count": failed_sensors_count,
        "invalid_data_sensors": invalid_data_sensors,
        "active_failure_alerts": active_failure_alerts,
        "sensor_statuses_list": sensor_statuses_list,
        "total_cleanings": total_cleanings,
        "cleanings_by_toilet": cleanings_by_toilet,
        "recent_cleanings": recent_cleanings,
    }
    return render(request, "admin/analytics.html", context)
