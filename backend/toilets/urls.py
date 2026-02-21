from django.urls import path
from . import views

urlpatterns = [
    path('', views.get_toilets, name='get_toilets'),
    path('<int:pk>/enter/', views.enter_toilet, name='enter_toilet'),
    path('<int:pk>/clean/', views.clean_toilet, name='clean_toilet'),
    path('enter/<int:pk>/', views.enter_toilet),
    path('clean/<int:pk>/', views.clean_toilet),
    path('simulate/<int:pk>/', views.simulate_usage, name='simulate_toilet'),
]
