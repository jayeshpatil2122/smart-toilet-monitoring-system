from django.urls import path

from .views import CreateOrderView, VerifyEntryView, VerifyPaymentView, WorkerRevenueView

urlpatterns = [
    path("create-order/", CreateOrderView.as_view(), name="create_order"),
    path("verify/", VerifyPaymentView.as_view(), name="verify_payment"),
    path("verify-entry/", VerifyEntryView.as_view(), name="verify_entry"),
    path("worker-revenue/", WorkerRevenueView.as_view(), name="worker_revenue"),
]
