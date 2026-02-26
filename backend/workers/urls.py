from django.urls import path

from . import views

urlpatterns = [
    path("portal/signup/", views.portal_signup),
    path("portal/login/", views.portal_login),
    path("portal/bypass/", views.portal_bypass_login),
    path("portal/google-login/", views.portal_google_login),
    path("portal/forgot-password/", views.portal_forgot_password),
    path("portal/reset-password/", views.portal_reset_password),
    path("signup/", views.worker_signup),
    path("login/", views.worker_login),
    path("bypass/", views.worker_bypass_login),
    path("forgot-password/", views.worker_forgot_password),
    path("reset-password/", views.worker_reset_password),
    path("my-complaints/", views.worker_my_complaints),
    path("my-complaints/<int:complaint_id>/status/", views.worker_update_complaint_status),
    path("my-alerts/", views.worker_my_alerts),
    path("my-alerts/<int:alert_id>/status/", views.worker_update_alert_status),
]
