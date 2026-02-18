from rest_framework import serializers

from complaints.models import Complaint


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
    assigned_to_username = serializers.CharField(source="assigned_to.username", read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "id",
            "toilet",
            "toilet_name",
            "toilet_location",
            "issue_type",
            "description",
            "image",
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


class PortalSignupSerializer(WorkerSignupSerializer):
    pass


class PortalLoginSerializer(WorkerLoginSerializer):
    pass


class PortalForgotPasswordSerializer(WorkerForgotPasswordSerializer):
    pass


class PortalResetPasswordSerializer(WorkerResetPasswordSerializer):
    pass
