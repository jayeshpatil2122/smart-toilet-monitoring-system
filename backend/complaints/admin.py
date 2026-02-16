from django.contrib import admin
from django.utils.html import format_html
from .models import Complaint


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'toilet',
        'issue_type',
        'priority',
        'status',
        'is_escalated',
        'assigned_to',
        'created_at',
    )

    list_filter = ('priority', 'status', 'is_escalated')

    # ✅ FIXED SEARCH
    search_fields = (
        'toilet__name',          # correct way to search related model
        'issue_type',
        'description',
        'assigned_to__username'  # since assigned_to is ForeignKey(User)
    )

    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="200" style="border-radius:8px;" />',
                obj.image.url
            )
        return "No Image"

    image_preview.short_description = "Image Preview"
