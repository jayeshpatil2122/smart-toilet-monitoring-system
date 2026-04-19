from django.contrib import admin
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils.html import format_html
import time

from complaints.models import Complaint
from .models import SensorStatus, ToiletAlert, Toilets


class ComplaintInline(admin.TabularInline):
    model = Complaint
    extra = 0
    can_delete = False
    show_change_link = True
    fields = (
        "issue_type",
        "status",
        "priority",
        "assigned_to",
        "created_at",
        "before_image_preview",
    )
    readonly_fields = fields
    ordering = ("-created_at",)

    def before_image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="120" style="border-radius:6px;" />', obj.image.url)
        return "No Image"

    before_image_preview.short_description = "Before Image"


@admin.register(Toilets)
class ToiletsAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'name',
        'location',
        'toilet_type',
        'is_disabled_friendly',
        'latitude',
        'longitude',
        'usage_count',
        'cleanliness',
        'water_level',
        'gas_level',
        'dustbin_level',
        'motion_detected',
        'health_score',
        'alert_level',
        'status',
        'created_at',
        'updated_at',
    )

    readonly_fields = (
        'cleanliness',
        'water_level',
        'gas_level',
        'dustbin_level',
        'motion_detected',
        'health_score',
        'alert_level',
        'status',
        'updated_at',
    )

    # Make created_at editable in the form
    fields = (
        'name',
        'location',
        'toilet_type',
        'is_disabled_friendly',
        'latitude',
        'longitude',
        'usage_count',
        'cleanliness',
        'water_level',
        'gas_level',
        'dustbin_level',
        'motion_detected',
        'health_score',
        'alert_level',
        'status',
        'created_at',
        'updated_at',
    )

    search_fields = ('name', 'location', 'status', 'toilet_type')
    list_filter = ('status', 'toilet_type', 'alert_level', 'is_disabled_friendly', 'motion_detected')
    ordering = ('-alert_level',)
    inlines = (ComplaintInline,)

    # Custom actions for resetting toilet data
    actions = ['reset_toilet_data']

    def get_queryset(self, request):
        try:
            from .views import _sync_all_toilets_from_blynk

            _sync_all_toilets_from_blynk()
        except Exception:
            pass
        return super().get_queryset(request)

    def reset_toilet_data(self, request, queryset):
        for toilet in queryset:
            toilet.usage_count = 0
            toilet.cleanliness = 100
            toilet.water_level = 100
            toilet.status = "Good"
            toilet.health_score = 100
            toilet.alert_level = 1
            toilet.save()
        self.message_user(request, f"Successfully reset {queryset.count()} toilet(s)")
    
    reset_toilet_data.short_description = "Reset selected toilets data"


@admin.register(ToiletAlert)
class ToiletAlertAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "toilet_name",
        "toilet_location",
        "alert_type_badge",
        "message",
        "priority_badge",
        "status",
        "assigned_to",
        "created_at",
        "resolved_at",
        "assign_action",
    )
    list_display_links = ("id", "toilet_name")
    list_editable = ("status", "assigned_to")
    list_filter = ("alert_type", "priority", "status", "assigned_to")
    search_fields = (
        "toilet__name",
        "toilet__location",
        "message",
        "assigned_to__username",
    )
    readonly_fields = ("created_at", "updated_at", "resolved_at", "resolved_by")
    ordering = ("status", "-created_at")
    actions = ("mark_selected_resolved", "mark_selected_pending")

    def toilet_name(self, obj):
        return obj.toilet.name

    toilet_name.short_description = "Toilet Name"

    def toilet_location(self, obj):
        return obj.toilet.location

    toilet_location.short_description = "Location"

    def alert_type_badge(self, obj):
        css_class_by_alert = {
            ToiletAlert.TYPE_LOW_CLEANLINESS: "low-cleanliness",
            ToiletAlert.TYPE_DUSTBIN_FULL: "low-cleanliness",
            ToiletAlert.TYPE_LOW_WATER: "low-water",
            ToiletAlert.TYPE_HIGH_GAS: "low-water",
        }
        css_class = css_class_by_alert.get(obj.alert_type, "low-water")
        return format_html('<span class="alert-badge {}">{}</span>', css_class, obj.alert_type)

    alert_type_badge.short_description = "Issue Alert"

    def priority_badge(self, obj):
        return format_html(
            '<span class="alert-badge priority-{}">{}</span>',
            obj.priority.lower(),
            obj.priority,
        )

    priority_badge.short_description = "Priority"

    def assign_action(self, obj):
        change_url = reverse("admin:toilets_toiletalert_change", args=[obj.pk])
        return format_html(
            '<a href="{}" class="button alert-assign-btn">Assign / Update</a>',
            change_url,
        )

    assign_action.short_description = "Assign To Worker"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name in ("assigned_to", "resolved_by"):
            kwargs["queryset"] = (
                User.objects.filter(groups__name="Worker").order_by("username").distinct()
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    @admin.action(description="Mark selected alerts as Resolved")
    def mark_selected_resolved(self, request, queryset):
        count = 0
        for alert in queryset:
            if alert.status != ToiletAlert.STATUS_RESOLVED:
                alert.toilet.reset_to_optimal_state(resolved_by=request.user)
                count += 1
        self.message_user(request, f"Resolved and reset {count} alert-linked toilet(s).")

    @admin.action(description="Mark selected alerts as Pending")
    def mark_selected_pending(self, request, queryset):
        queryset.update(status=ToiletAlert.STATUS_PENDING, resolved_at=None, resolved_by=None)
        self.message_user(request, f"Set {queryset.count()} alert(s) to pending.")


@admin.register(SensorStatus)
class SensorStatusAdmin(admin.ModelAdmin):
    list_display = (
        "sensor_name",
        "sensor_key",
        "blynk_pin",
        "working_badge",
        "last_value",
        "last_checked_at",
        "last_working_at",
        "error_message",
    )
    list_filter = ("is_working", "sensor_key")
    search_fields = ("sensor_name", "sensor_key", "blynk_pin", "last_value", "error_message")
    ordering = ("sensor_name",)
    readonly_fields = (
        "sensor_key",
        "sensor_name",
        "blynk_pin",
        "is_working",
        "last_value",
        "error_message",
        "last_checked_at",
        "last_working_at",
        "created_at",
        "updated_at",
    )
    actions = ("refresh_sensor_statuses",)

    _last_refresh_mono = 0.0
    _refresh_interval_seconds = 5.0

    @admin.action(description="Refresh Sensor Statuses From Blynk")
    def refresh_sensor_statuses(self, request, queryset):
        try:
            working_count = SensorStatus.refresh_all_from_blynk()
            total_count = SensorStatus.objects.count()
            self.message_user(
                request,
                f"Sensor statuses refreshed. Working: {working_count}/{total_count}.",
            )
        except Exception as exc:
            self.message_user(request, f"Sensor refresh failed: {exc}", level="error")

    def working_badge(self, obj):
        color = "#16a34a" if obj.is_working else "#dc2626"
        text = "Working" if obj.is_working else "Not Working"
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:12px;color:white;background:{};">{}</span>',
            color,
            text,
        )

    working_badge.short_description = "Status"

    def _refresh_if_needed(self, force=False):
        now = time.monotonic()
        should_refresh = force or (now - self._last_refresh_mono >= self._refresh_interval_seconds)
        if not should_refresh:
            return
        SensorStatus.refresh_all_from_blynk()
        self._last_refresh_mono = now

    def changelist_view(self, request, extra_context=None):
        try:
            self._refresh_if_needed(force=True)
        except Exception:
            pass
        return super().changelist_view(request, extra_context=extra_context)

    def get_queryset(self, request):
        SensorStatus.ensure_default_records()
        return super().get_queryset(request)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
