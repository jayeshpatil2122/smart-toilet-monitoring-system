from django.contrib import admin
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.template.response import TemplateResponse
from django.urls import path
from django.utils.html import format_html

from .models import Complaint
from workers.models import WorkerProfile


class ComplaintQueueFilter(admin.SimpleListFilter):
    title = "Complaint Queue"
    parameter_name = "queue"

    def lookups(self, request, model_admin):
        return (
            ("open", "Open Complaints"),
            ("closed", "Closed Complaints"),
            ("all", "All Complaints"),
        )

    def queryset(self, request, queryset):
        value = self.value()
        if value == "closed":
            return queryset.filter(status="Resolved")
        if value == "all":
            return queryset
        # Default queue: show only active complaints in dashboard.
        return queryset.exclude(status="Resolved")


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    change_list_template = "admin/complaints/complaint/change_list.html"
    list_display = (
        "id",
        "toilet",
        "issue_type",
        "priority",
        "status",
        "after_video_link",
        "video_verification_status",
        "escalation_state",
        "assigned_to",
        "created_at",
    )
    list_filter = (ComplaintQueueFilter, "priority", "status", "is_escalated", "assigned_to")
    search_fields = (
        "toilet__name",
        "issue_type",
        "description",
        "assigned_to__username",
    )
    readonly_fields = (
        "id",
        "toilet",
        "issue_type",
        "description",
        "image_preview",
        "after_image_preview",
        "after_video_link",
        "video_verification_status",
        "video_verification_reason",
        "video_verified_at",
        "video_verification_meta",
        "status",
        "priority",
        "submitted_by",
        "created_at",
        "resolved_at",
        "resolution_time",
    )
    fields = (
        "id",
        "toilet",
        "issue_type",
        "description",
        "image_preview",
        "after_image_preview",
        "after_video_link",
        "video_verification_status",
        "video_verification_reason",
        "video_verified_at",
        "video_verification_meta",
        "status",
        "priority",
        "is_escalated",
        "submitted_by",
        "assigned_to",
        "created_at",
        "resolved_at",
        "resolution_time",
    )

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<div style="display:grid;gap:8px;">'
                '<img src="{}" alt="Before Image" '
                'style="max-width:220px;max-height:140px;object-fit:cover;border-radius:8px;'
                'border:1px solid #93c5fd;background:#f8fbff;" />'
                '<a href="{}" target="_blank" rel="noopener noreferrer" '
                'style="display:inline-flex;align-items:center;justify-content:center;padding:6px 12px;'
                'border-radius:8px;background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8;'
                'font-weight:700;text-decoration:none;">Open Before Image</a>'
                '</div>',
                obj.image.url,
                obj.image.url,
            )
        return "No Image"

    image_preview.short_description = "Before Image"

    def after_image_preview(self, obj):
        if obj.after_image:
            return format_html(
                '<div style="display:grid;gap:8px;">'
                '<img src="{}" alt="After Image" '
                'style="max-width:220px;max-height:140px;object-fit:cover;border-radius:8px;'
                'border:1px solid #86efac;background:#f7fff9;" />'
                '<a href="{}" target="_blank" rel="noopener noreferrer" '
                'style="display:inline-flex;align-items:center;justify-content:center;padding:6px 12px;'
                'border-radius:8px;background:#ecfdf5;border:1px solid #86efac;color:#166534;'
                'font-weight:700;text-decoration:none;">Open After Image</a>'
                '</div>',
                obj.after_image.url,
                obj.after_image.url,
            )
        return "No After Image"

    after_image_preview.short_description = "After Image"

    def after_video_link(self, obj):
        if not obj.after_video:
            return "No After Video"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Open After Video</a>',
            obj.after_video.url,
        )

    after_video_link.short_description = "After Video"

    def escalation_state(self, obj):
        if obj.is_escalated:
            return format_html(
                '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;'
                'background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-weight:700;">'
                '<span style="width:8px;height:8px;border-radius:999px;background:#f97316;"></span>{}</span>',
                "Needs Attention",
            )
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;'
            'background:#ecfdf3;border:1px solid #86efac;color:#166534;font-weight:700;">'
            '<span style="width:8px;height:8px;border-radius:999px;background:#22c55e;"></span>{}</span>',
            "On Track",
        )

    escalation_state.short_description = "Escalation"

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        queue = request.GET.get("queue")
        if queue == "closed":
            return queryset.filter(status="Resolved")
        if queue == "all":
            return queryset
        return queryset.exclude(status="Resolved")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "assigned_to":
            kwargs["queryset"] = (
                User.objects.filter(groups__name="Worker").order_by("username").distinct()
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "workers-history/",
                self.admin_site.admin_view(self.workers_history_view),
                name="complaints_complaint_workers_history",
            ),
        ]
        return custom_urls + urls

    def _build_worker_section(self, title, profiles, summary_map, selected_worker_id):
        workers = []
        for profile in profiles:
            counts = summary_map.get(
                profile.user_id,
                {"total": 0, "pending": 0, "in_progress": 0, "resolved": 0},
            )
            workers.append(
                {
                    "id": profile.user_id,
                    "username": profile.user.username,
                    "email": profile.user.email,
                    "counts": counts,
                    "is_selected": profile.user_id == selected_worker_id,
                }
            )
        return {"title": title, "workers": workers}

    def workers_history_view(self, request):
        selected_worker_id = request.GET.get("worker")
        try:
            selected_worker_id = int(selected_worker_id) if selected_worker_id else None
        except (TypeError, ValueError):
            selected_worker_id = None

        sanitation_profiles = list(
            WorkerProfile.objects.filter(role=WorkerProfile.ROLE_SANITATION)
            .select_related("user")
            .order_by("user__username")
        )
        payment_profiles = list(
            WorkerProfile.objects.filter(role=WorkerProfile.ROLE_ENTRY)
            .select_related("user")
            .order_by("user__username")
        )

        all_worker_ids = [profile.user_id for profile in sanitation_profiles + payment_profiles]
        summary_map = {}
        if all_worker_ids:
            summary_rows = (
                Complaint.objects.filter(assigned_to_id__in=all_worker_ids)
                .values("assigned_to_id")
                .annotate(
                    total=Count("id"),
                    pending=Count("id", filter=Q(status="Pending")),
                    in_progress=Count("id", filter=Q(status="In Progress")),
                    resolved=Count("id", filter=Q(status="Resolved")),
                )
            )
            summary_map = {
                row["assigned_to_id"]: {
                    "total": row["total"],
                    "pending": row["pending"],
                    "in_progress": row["in_progress"],
                    "resolved": row["resolved"],
                }
                for row in summary_rows
            }

        selected_profile = None
        selected_complaints = []
        selected_worker_counts = {"total": 0, "pending": 0, "in_progress": 0, "resolved": 0}
        if selected_worker_id:
            selected_profile = (
                WorkerProfile.objects.select_related("user")
                .filter(user_id=selected_worker_id)
                .first()
            )
            if selected_profile:
                selected_complaints = list(
                    Complaint.objects.filter(assigned_to_id=selected_worker_id)
                    .select_related("toilet", "assigned_to", "submitted_by")
                    .order_by("-created_at")
                )
                selected_worker_counts = summary_map.get(
                    selected_worker_id,
                    {"total": 0, "pending": 0, "in_progress": 0, "resolved": 0},
                )

        unsolved_complaints = [item for item in selected_complaints if item.status == "Pending"]
        ongoing_complaints = [item for item in selected_complaints if item.status == "In Progress"]
        solved_complaints = [item for item in selected_complaints if item.status == "Resolved"]

        worker_sections = [
            self._build_worker_section(
                "Sanitary Workers",
                sanitation_profiles,
                summary_map,
                selected_worker_id,
            ),
            self._build_worker_section(
                "Payment Workers",
                payment_profiles,
                summary_map,
                selected_worker_id,
            ),
        ]

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": "Workers History",
            "worker_sections": worker_sections,
            "selected_profile": selected_profile,
            "selected_worker_counts": selected_worker_counts,
            "unsolved_complaints": unsolved_complaints,
            "ongoing_complaints": ongoing_complaints,
            "solved_complaints": solved_complaints,
        }
        return TemplateResponse(request, "admin/complaints/workers_history.html", context)
