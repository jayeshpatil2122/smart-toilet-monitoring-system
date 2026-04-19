import hashlib
import hmac
import random
import string
import uuid
from decimal import Decimal

import razorpay
from django.conf import settings
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from toilets.models import Toilets
from workers.models import WorkerProfile

from .models import PaymentTransaction

WORKER_GROUP_NAME = "Worker"
PAYMENT_SERVICE_AMOUNTS = {
    "toilet": Decimal("10.00"),
    "washroom": Decimal("5.00"),
}
DEFAULT_PAYMENT_SERVICE = "washroom"


def generate_code(length=6):
    characters = string.ascii_uppercase + string.digits
    return "".join(random.choices(characters, k=length))


def _to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value or 0)


def _is_entry_worker(user):
    if not user or not user.is_authenticated:
        return False
    if not user.groups.filter(name=WORKER_GROUP_NAME).exists():
        return False
    profile, _ = WorkerProfile.objects.get_or_create(
        user=user,
        defaults={"role": WorkerProfile.ROLE_SANITATION},
    )
    return profile.role == WorkerProfile.ROLE_ENTRY


class CreateOrderView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        toilet_id = request.data.get("toilet_id")
        if not toilet_id:
            return Response({"detail": "toilet_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        service_type = str(request.data.get("service_type") or DEFAULT_PAYMENT_SERVICE).strip().lower()
        if service_type not in PAYMENT_SERVICE_AMOUNTS:
            return Response(
                {"detail": "service_type must be either 'toilet' or 'washroom'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        toilet = get_object_or_404(Toilets, pk=toilet_id)
        amount_rupees = PAYMENT_SERVICE_AMOUNTS[service_type]
        amount = int(amount_rupees * 100)

        if (
            not settings.RAZORPAY_KEY_ID
            or not settings.RAZORPAY_KEY_SECRET
            or settings.RAZORPAY_KEY_ID == "your_key_id"
            or settings.RAZORPAY_KEY_SECRET == "your_secret"
        ):
            return Response(
                {"detail": "Razorpay keys are not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        try:
            order = client.order.create(
                {
                    "amount": amount,
                    "currency": "INR",
                    "payment_capture": 1,
                }
            )
        except Exception:
            return Response(
                {"detail": "Unable to create Razorpay order right now."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment = PaymentTransaction.objects.create(
            toilet=toilet,
            user=request.user,
            amount=amount_rupees,
            razorpay_order_id=order["id"],
            transaction_id=str(uuid.uuid4()),
            status=PaymentTransaction.STATUS_PENDING,
        )

        return Response(
            {
                "order_id": order["id"],
                "amount": amount,
                "amount_rupees": _to_float(amount_rupees),
                "service_type": service_type,
                "payment_id": payment.id,
                "key_id": settings.RAZORPAY_KEY_ID,
            }
        )


class VerifyPaymentView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("razorpay_order_id")
        payment_id = request.data.get("razorpay_payment_id")
        signature = request.data.get("razorpay_signature")

        if not order_id or not payment_id or not signature:
            return Response(
                {"detail": "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        generated_signature = hmac.new(
            bytes(settings.RAZORPAY_KEY_SECRET, "utf-8"),
            bytes(f"{order_id}|{payment_id}", "utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(generated_signature, signature):
            return Response({"error": "Invalid payment signature."}, status=status.HTTP_400_BAD_REQUEST)

        payment = PaymentTransaction.objects.filter(razorpay_order_id=order_id).first()
        if not payment:
            return Response({"detail": "Payment transaction not found."}, status=status.HTTP_404_NOT_FOUND)
        if payment.user_id and payment.user_id != request.user.id:
            return Response(
                {"detail": "This payment does not belong to the current user."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payment.status = PaymentTransaction.STATUS_SUCCESS
        payment.razorpay_payment_id = payment_id
        payment.razorpay_signature = signature
        if not payment.access_code:
            payment.access_code = generate_code()
        if not payment.qr_token:
            payment.qr_token = str(uuid.uuid4())
        payment.save()

        return Response(
            {
                "message": "Payment Success",
                "code": payment.access_code,
                "qr_token": payment.qr_token,
                "payment_id": payment.id,
            }
        )


class VerifyEntryView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_entry_worker(request.user):
            return Response({"detail": "Entry worker access required."}, status=status.HTTP_403_FORBIDDEN)

        code = str(request.data.get("code") or "").strip().upper()
        qr_token = str(request.data.get("qr_token") or "").strip()

        if not code and not qr_token:
            return Response(
                {"detail": "Provide either code or qr_token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = None
        if code:
            payment = PaymentTransaction.objects.filter(
                access_code=code,
                status=PaymentTransaction.STATUS_SUCCESS,
                is_verified=False,
            ).first()
        elif qr_token:
            payment = PaymentTransaction.objects.filter(
                qr_token=qr_token,
                status=PaymentTransaction.STATUS_SUCCESS,
                is_verified=False,
            ).first()

        if not payment:
            return Response(
                {"detail": "Invalid or already-used payment code/QR token.", "verified": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        payment.is_verified = True
        payment.verified_by = request.user
        payment.verified_at = timezone.now()
        payment.save(update_fields=["is_verified", "verified_by", "verified_at", "updated_at"])

        return Response(
            {
                "detail": "Entry verified successfully.",
                "verified": True,
                "transaction": {
                    "id": payment.id,
                    "transaction_id": payment.transaction_id,
                    "amount": _to_float(payment.amount),
                    "toilet_id": payment.toilet_id,
                    "toilet_name": payment.toilet.name if payment.toilet_id else "",
                    "access_code": payment.access_code,
                    "qr_token": payment.qr_token,
                    "verified_at": payment.verified_at,
                },
            }
        )


class WorkerRevenueView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_entry_worker(request.user):
            return Response({"detail": "Entry worker access required."}, status=status.HTTP_403_FORBIDDEN)

        successful_payments = PaymentTransaction.objects.filter(status=PaymentTransaction.STATUS_SUCCESS)
        today = timezone.localdate()

        total_amount = successful_payments.aggregate(total=Sum("amount")).get("total")
        today_amount = successful_payments.filter(created_at__date=today).aggregate(total=Sum("amount")).get("total")

        per_toilet = (
            successful_payments.values("toilet_id", "toilet__name")
            .annotate(total=Sum("amount"), transactions=Count("id"))
            .order_by("-total")
        )

        recent_transactions = (
            successful_payments.select_related("toilet", "user", "verified_by")
            .order_by("-created_at")[:25]
        )

        return Response(
            {
                "total": _to_float(total_amount),
                "today_total": _to_float(today_amount),
                "verified_entries": successful_payments.filter(is_verified=True).count(),
                "pending_entries": successful_payments.filter(is_verified=False).count(),
                "per_toilet": [
                    {
                        "toilet_id": row["toilet_id"],
                        "toilet_name": row["toilet__name"],
                        "total": _to_float(row["total"]),
                        "transactions": row["transactions"],
                    }
                    for row in per_toilet
                ],
                "transactions": [
                    {
                        "id": item.id,
                        "transaction_id": item.transaction_id,
                        "amount": _to_float(item.amount),
                        "toilet_id": item.toilet_id,
                        "toilet_name": item.toilet.name if item.toilet_id else "",
                        "user": item.user.username if item.user_id else "",
                        "created_at": item.created_at,
                        "is_verified": item.is_verified,
                        "verified_by": item.verified_by.username if item.verified_by_id else "",
                        "verified_at": item.verified_at,
                        "access_code": item.access_code,
                    }
                    for item in recent_transactions
                ],
            }
        )
