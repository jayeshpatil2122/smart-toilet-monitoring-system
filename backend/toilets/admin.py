from django.contrib import admin
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils.html import format_html

from complaints.models import Complaint
from .models import ToiletAlert, Toilets


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
        'is_disabled_friendly',
        'latitude',
        'longitude',
        'usage_count',
        'cleanliness',
        'water_level',
        'health_score',
        'alert_level',
        'status',
        'created_at',
        'updated_at',
    )

    readonly_fields = (
        'cleanliness',
        'water_level',
        'health_score',
        'alert_level',
        'status',
        'updated_at',
    )

    # Make created_at editable in the form
    fields = (
        'name',
        'location',
        'is_disabled_friendly',
        'latitude',
        'longitude',
        'usage_count',
        'cleanliness',
        'water_level',
        'health_score',
        'alert_level',
        'status',
        'created_at',
        'updated_at',
    )

    search_fields = ('name', 'location', 'status')
    list_filter = ('status', 'alert_level', 'is_disabled_friendly')
    ordering = ('-alert_level',)
    inlines = (ComplaintInline,)

    # Custom actions for resetting toilet data
    actions = ['reset_toilet_data']

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
        css_class = "low-cleanliness" if obj.alert_type == ToiletAlert.TYPE_LOW_CLEANLINESS else "low-water"
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
