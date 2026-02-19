from rest_framework import serializers

from complaints.models import Complaint
from toilets.models import ToiletAlert


class WorkerSignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, write_only=True)


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
    toilet_latitude = serializers.FloatField(source="toilet.latitude", read_only=True)
    toilet_longitude = serializers.FloatField(source="toilet.longitude", read_only=True)
    before_image = serializers.ImageField(source="image", read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username", read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "id",
            "toilet",
            "toilet_name",
            "toilet_location",
            "toilet_latitude",
            "toilet_longitude",
            "issue_type",
            "description",
            "before_image",
            "image",
            "after_image",
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
        )


class WorkerToiletAlertSerializer(serializers.ModelSerializer):
    toilet_name = serializers.CharField(source="toilet.name", read_only=True)
    toilet_location = serializers.CharField(source="toilet.location", read_only=True)
    toilet_latitude = serializers.FloatField(source="toilet.latitude", read_only=True)
    toilet_longitude = serializers.FloatField(source="toilet.longitude", read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username", read_only=True)
    resolved_by_username = serializers.CharField(source="resolved_by.username", read_only=True)

    class Meta:
        model = ToiletAlert
        fields = [
            "id",
            "toilet",
            "toilet_name",
            "toilet_location",
            "toilet_latitude",
            "toilet_longitude",
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


class PortalForgotPasswordSerializer(WorkerForgotPasswordSerializer):
    pass


class PortalResetPasswordSerializer(WorkerResetPasswordSerializer):
    pass
