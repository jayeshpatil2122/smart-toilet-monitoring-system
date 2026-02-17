from django.contrib import admin
from .models import Toilets


@admin.register(Toilets)
class ToiletsAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'name',
        'location',
        'latitude',
        'longitude',
        'usage_count',
        'cleanliness',
        'water_level',
        'health_score',
        'alert_level',
        'status',
        'updated_at',
    )

    readonly_fields = (
        'cleanliness',
        'water_level',
        'health_score',
        'alert_level',
        'status',
        'updated_at',
        'created_at',
    )

    search_fields = ('name', 'location', 'status')
    list_filter = ('status', 'alert_level')
    ordering = ('-alert_level',)
