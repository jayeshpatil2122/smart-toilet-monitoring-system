from django.contrib import admin

from .models import WorkerPasswordReset, WorkerProfile


@admin.register(WorkerPasswordReset)
class WorkerPasswordResetAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "code", "expires_at", "is_used", "created_at")
    list_filter = ("is_used", "expires_at")
    search_fields = ("user__username", "user__email", "code")


@admin.register(WorkerProfile)
class WorkerProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "employee_id", "phone_number", "assigned_area", "role", "is_active", "created_at")
    list_filter = ("role", "user__is_active", "created_at")
    search_fields = ("user__username", "user__email", "user__first_name", "user__last_name", "employee_id", "phone_number", "assigned_area")

    def is_active(self, obj):
        return obj.user.is_active
    is_active.boolean = True
    is_active.short_description = "Active Status"
