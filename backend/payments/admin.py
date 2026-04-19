from django.contrib import admin

from .models import PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "transaction_id",
        "toilet",
        "user",
        "amount",
        "status",
        "is_verified",
        "verified_by",
        "verified_at",
        "created_at",
    )
    list_filter = ("status", "is_verified", "verified_at", "created_at")
    search_fields = (
        "transaction_id",
        "razorpay_order_id",
        "razorpay_payment_id",
        "user__username",
        "verified_by__username",
        "toilet__name",
    )
