from rest_framework import serializers
from .models import Complaint


class ComplaintSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(use_url=True, required=False, allow_null=True)
    after_image = serializers.ImageField(use_url=True, required=False, allow_null=True)
    after_video = serializers.FileField(use_url=True, required=False, allow_null=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
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
            'after_image',
            'after_video',
            'video_verification_status',
            'video_verification_reason',
            'video_verified_at',
            'video_verification_meta',
            'status',
            'priority',
            'submitted_by',
            'submitted_by_username',
            'assigned_to',
            'assigned_to_username',
            'created_at',
            'resolved_at',
            'resolution_time',
        ]
        read_only_fields = (
            'priority',
            'submitted_by',
            'submitted_by_username',
            'assigned_to',
            'assigned_to_username',
            'created_at',
            'resolved_at',
            'resolution_time',
            'video_verification_status',
            'video_verification_reason',
            'video_verified_at',
            'video_verification_meta',
        )
