from rest_framework import serializers
from django.conf import settings

from complaints.models import Complaint
from toilets.models import ToiletAlert
from .models import WorkerProfile


class WorkerSignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, write_only=True)
    role = serializers.ChoiceField(
        choices=WorkerProfile.ROLE_CHOICES,
        required=False,
        default=WorkerProfile.ROLE_SANITATION,
    )


class WorkerLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class WorkerForgotPasswordSerializer(serializers.Serializer):
    username_or_email = serializers.CharField()


class WorkerResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(min_length=6, write_only=True)


class WorkerComplaintSerializer(serializers.ModelSerializer):
    toilet_name = serializers.CharField(source="toilet.name", read_only=True)
    toilet_location = serializers.CharField(source="toilet.location", read_only=True)
    toilet_type = serializers.CharField(source="toilet.toilet_type", read_only=True)
    toilet_latitude = serializers.FloatField(source="toilet.latitude", read_only=True)
    toilet_longitude = serializers.FloatField(source="toilet.longitude", read_only=True)
    toilet_status = serializers.CharField(source="toilet.status", read_only=True)
    toilet_usage_count = serializers.IntegerField(source="toilet.usage_count", read_only=True)
    toilet_water_level = serializers.FloatField(source="toilet.water_level", read_only=True)
    toilet_gas_level = serializers.FloatField(source="toilet.gas_level", read_only=True)
    toilet_dustbin_level = serializers.FloatField(source="toilet.dustbin_level", read_only=True)
    toilet_motion_detected = serializers.BooleanField(source="toilet.motion_detected", read_only=True)
    fan_on_alert = serializers.SerializerMethodField()
    before_image = serializers.ImageField(source="image", read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username", read_only=True)

    def get_fan_on_alert(self, obj):
        gas_high_threshold = float(getattr(settings, "BLYNK_GAS_HIGH_THRESHOLD", 70))
        return float(obj.toilet.gas_level or 0) > gas_high_threshold

    class Meta:
        model = Complaint
        fields = [
            "id",
            "toilet",
            "toilet_name",
            "toilet_location",
            "toilet_type",
            "toilet_latitude",
            "toilet_longitude",
            "toilet_status",
            "toilet_usage_count",
            "toilet_water_level",
            "toilet_gas_level",
            "toilet_dustbin_level",
            "toilet_motion_detected",
            "fan_on_alert",
            "issue_type",
            "description",
            "before_image",
            "image",
            "after_image",
            "after_video",
            "video_verification_status",
            "video_verification_reason",
            "video_verified_at",
            "video_verification_meta",
            "status",
            "priority",
            "is_escalated",
            "assigned_to",
            "assigned_to_username",
            "created_at",
            "resolved_at",
            "resolution_time",
        ]
        read_only_fields = (
            "priority",
            "is_escalated",
            "assigned_to",
            "assigned_to_username",
            "created_at",
            "resolved_at",
            "resolution_time",
            "video_verification_status",
            "video_verification_reason",
            "video_verified_at",
            "video_verification_meta",
        )


class WorkerToiletAlertSerializer(serializers.ModelSerializer):
    toilet_name = serializers.CharField(source="toilet.name", read_only=True)
    toilet_location = serializers.CharField(source="toilet.location", read_only=True)
    toilet_type = serializers.CharField(source="toilet.toilet_type", read_only=True)
    toilet_latitude = serializers.FloatField(source="toilet.latitude", read_only=True)
    toilet_longitude = serializers.FloatField(source="toilet.longitude", read_only=True)
    toilet_status = serializers.CharField(source="toilet.status", read_only=True)
    toilet_usage_count = serializers.IntegerField(source="toilet.usage_count", read_only=True)
    toilet_water_level = serializers.FloatField(source="toilet.water_level", read_only=True)
    toilet_gas_level = serializers.FloatField(source="toilet.gas_level", read_only=True)
    toilet_dustbin_level = serializers.FloatField(source="toilet.dustbin_level", read_only=True)
    toilet_motion_detected = serializers.BooleanField(source="toilet.motion_detected", read_only=True)
    fan_on_alert = serializers.SerializerMethodField()
    assigned_to_username = serializers.CharField(source="assigned_to.username", read_only=True)
    resolved_by_username = serializers.CharField(source="resolved_by.username", read_only=True)

    def get_fan_on_alert(self, obj):
        gas_high_threshold = float(getattr(settings, "BLYNK_GAS_HIGH_THRESHOLD", 70))
        return float(obj.toilet.gas_level or 0) > gas_high_threshold

    class Meta:
        model = ToiletAlert
        fields = [
            "id",
            "toilet",
            "toilet_name",
            "toilet_location",
            "toilet_type",
            "toilet_latitude",
            "toilet_longitude",
            "toilet_status",
            "toilet_usage_count",
            "toilet_water_level",
            "toilet_gas_level",
            "toilet_dustbin_level",
            "toilet_motion_detected",
            "fan_on_alert",
            "alert_type",
            "message",
            "priority",
            "status",
            "assigned_to",
            "assigned_to_username",
            "resolved_by",
            "resolved_by_username",
            "created_at",
            "updated_at",
            "resolved_at",
        ]
        read_only_fields = (
            "toilet",
            "toilet_name",
            "toilet_location",
            "toilet_latitude",
            "toilet_longitude",
            "alert_type",
            "message",
            "priority",
            "assigned_to",
            "assigned_to_username",
            "resolved_by",
            "resolved_by_username",
            "created_at",
            "updated_at",
            "resolved_at",
        )


class PortalSignupSerializer(WorkerSignupSerializer):
    pass


class PortalLoginSerializer(WorkerLoginSerializer):
    pass


class PortalGoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()


class PortalForgotPasswordSerializer(WorkerForgotPasswordSerializer):
    pass


class PortalResetPasswordSerializer(WorkerResetPasswordSerializer):
    pass
