from django.contrib.auth.models import User
from django.db import models


class WorkerPasswordReset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="worker_reset_codes")
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.code}"


class WorkerProfile(models.Model):
    ROLE_SANITATION = "Sanitation"
    ROLE_ENTRY = "Entry"
    ROLE_CHOICES = [
        (ROLE_SANITATION, ROLE_SANITATION),
        (ROLE_ENTRY, ROLE_ENTRY),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="worker_profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_SANITATION)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return f"{self.user.username} - {self.role}"
