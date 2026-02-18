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
        'created_at',
        'updated_at',
    )

    readonly_fields = (
        'cleanliness',
        'water_level',
        'health_score',
        'alert_level',
        'status',
        'updated_at',
    )

    # Make created_at editable in the form
    fields = (
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
        'created_at',
        'updated_at',
    )

    search_fields = ('name', 'location', 'status')
    list_filter = ('status', 'alert_level')
    ordering = ('-alert_level',)

    # Custom actions for resetting toilet data
    actions = ['reset_toilet_data']

    def reset_toilet_data(self, request, queryset):
        for toilet in queryset:
            toilet.usage_count = 0
            toilet.cleanliness = 100
            toilet.water_level = 100
            toilet.status = "Good"
            toilet.health_score = 100
            toilet.alert_level = 1
            toilet.save()
        self.message_user(request, f"Successfully reset {queryset.count()} toilet(s)")
    
    reset_toilet_data.short_description = "Reset selected toilets data"
