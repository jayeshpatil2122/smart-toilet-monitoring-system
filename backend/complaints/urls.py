from django.urls import path
from . import views

urlpatterns = [
    path('', views.get_complaints),
    path('create/', views.create_complaint),
    path('my/', views.my_complaints),
    path('dashboard/', views.complaint_dashboard),
    path('per-toilet/', views.complaints_per_toilet),
    path('staff-performance/', views.staff_performance),

]
