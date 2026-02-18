from rest_framework import serializers
from .models import Complaint


class ComplaintSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(use_url=True, required=False, allow_null=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    toilet_name = serializers.CharField(source='toilet.name', read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id',
            'toilet',
            'toilet_name',
            'issue_type',
            'description',
            'image',
            'status',
            'priority',
            'assigned_to',
            'assigned_to_username',
            'created_at',
            'resolved_at',
            'resolution_time',
        ]
        read_only_fields = (
            'priority',
            'assigned_to',
            'assigned_to_username',
            'created_at',
            'resolved_at',
            'resolution_time',
        )
