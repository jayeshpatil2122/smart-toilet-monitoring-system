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
