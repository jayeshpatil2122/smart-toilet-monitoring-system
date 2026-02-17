from rest_framework import serializers
from .models import Toilets


class ToiletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Toilets
        fields = [
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
        ]
