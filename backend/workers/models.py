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
    employee_id = models.CharField(max_length=50, blank=True, default="")
    phone_number = models.CharField(max_length=20, blank=True, default="")
    assigned_area = models.CharField(max_length=150, blank=True, default="General Area")
    fcm_token = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.user:
            from django.contrib.auth.models import Group
            group, _ = Group.objects.get_or_create(name="Worker")
            if not self.user.groups.filter(name="Worker").exists():
                self.user.groups.add(group)

    def __str__(self):
        return f"{self.user.username} - {self.role}"

