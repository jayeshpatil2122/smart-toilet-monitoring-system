from rest_framework import serializers
from .models import Complaint


class ComplaintSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(use_url=True, required=False, allow_null=True)

    class Meta:
        model = Complaint
        fields = [
            'id',
            'toilet',
            'issue_type',
            'description',
            'image',
            'status',
            'priority',
            'created_at'
        ]
