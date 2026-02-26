from django.contrib import admin
from django.contrib.auth.models import User
from django.utils.html import format_html

from .models import Complaint


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "toilet",
        "issue_type",
        "priority",
        "status",
        "escalation_state",
        "assigned_to",
        "created_at",
    )
    list_filter = ("priority", "status", "is_escalated")
    search_fields = (
        "toilet__name",
        "issue_type",
        "description",
        "assigned_to__username",
    )
    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="200" style="border-radius:8px;" />',
                obj.image.url,
            )
        return "No Image"

    image_preview.short_description = "Image Preview"

    def escalation_state(self, obj):
        if obj.is_escalated:
            return format_html(
                '<span style="padding:4px 10px;border-radius:999px;background:#ffedd5;color:#9a3412;font-weight:700;">Escalated</span>'
            )
        return format_html(
            '<span style="padding:4px 10px;border-radius:999px;background:#ecfdf3;color:#166534;font-weight:700;">On Track</span>'
        )

    escalation_state.short_description = "Escalation"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "assigned_to":
            kwargs["queryset"] = (
                User.objects.filter(groups__name="Worker").order_by("username").distinct()
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
