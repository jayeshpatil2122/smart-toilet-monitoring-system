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
        "is_escalated",
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

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "assigned_to":
            kwargs["queryset"] = (
                User.objects.filter(groups__name="Worker").order_by("username").distinct()
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
