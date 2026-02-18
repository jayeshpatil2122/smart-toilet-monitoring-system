from django.contrib import admin

from .models import WorkerPasswordReset


@admin.register(WorkerPasswordReset)
class WorkerPasswordResetAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "code", "expires_at", "is_used", "created_at")
    list_filter = ("is_used", "expires_at")
    search_fields = ("user__username", "user__email", "code")
