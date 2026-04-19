from django.contrib import admin

from .models import WorkerPasswordReset, WorkerProfile


@admin.register(WorkerPasswordReset)
class WorkerPasswordResetAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "code", "expires_at", "is_used", "created_at")
    list_filter = ("is_used", "expires_at")
    search_fields = ("user__username", "user__email", "code")


@admin.register(WorkerProfile)
class WorkerProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role", "created_at", "updated_at")
    list_filter = ("role", "created_at")
    search_fields = ("user__username", "user__email")
