from django.contrib.auth.models import User
from django.db import models

from toilets.models import Toilets


class PaymentTransaction(models.Model):
    STATUS_PENDING = "Pending"
    STATUS_SUCCESS = "Success"
    STATUS_FAILED = "Failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, STATUS_PENDING),
        (STATUS_SUCCESS, STATUS_SUCCESS),
        (STATUS_FAILED, STATUS_FAILED),
    ]

    toilet = models.ForeignKey(
        Toilets,
        on_delete=models.CASCADE,
        related_name="payment_transactions",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_transactions",
    )
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    transaction_id = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    razorpay_order_id = models.CharField(max_length=100, null=True, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=255, null=True, blank=True)

    access_code = models.CharField(max_length=10, null=True, blank=True)
    qr_token = models.CharField(max_length=100, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_payment_transactions",
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        user_label = self.user.username if self.user_id else "Anonymous"
        return f"{self.transaction_id} - {self.status} - {user_label}"
