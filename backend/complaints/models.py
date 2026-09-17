from django.db import models
from toilets.models import Toilets, CleaningHistory
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User



class Complaint(models.Model):

    # Different types of issues that user can select
    ISSUE_CHOICES = [
        ('Dirty', 'Dirty'),
        ('No Water', 'No Water'),
        ('Broken', 'Broken'),
        ('No Handwash/Soap', 'No Handwash / Soap'),
        ('No Ramp/Accessibility', 'No Ramp / Wheelchair Access'),
        ('Bad Odor', 'Bad Odor / Foul Smell'),
        ('No Electricity/Light', 'No Electricity / Lighting'),
        ('Other', 'Other'),
    ]

    # Priority levels (system will auto assign)
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]

    # Complaint status
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
    ]

    # Each complaint is linked to one toilet
    toilet = models.ForeignKey(Toilets, on_delete=models.CASCADE)

    # Type of issue selected by user
    issue_type = models.CharField(max_length=50, choices=ISSUE_CHOICES)

    # Detailed description of complaint
    description = models.TextField()
    image = models.ImageField(upload_to='complaint_images/', null=True, blank=True)
    after_image = models.ImageField(upload_to='complaint_after_images/', null=True, blank=True)
    after_video = models.FileField(upload_to='complaint_after_videos/', null=True, blank=True)
    video_verification_status = models.CharField(max_length=20, default="Not Checked")
    video_verification_reason = models.CharField(max_length=255, blank=True, default="")
    video_verified_at = models.DateTimeField(null=True, blank=True)
    video_verification_meta = models.JSONField(default=dict, blank=True)

    # Geo-location coordinates captured upon submission (if image attached & location permitted)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # Worker solving/cleaning location coordinates captured upon resolution
    solving_latitude = models.FloatField(null=True, blank=True)
    solving_longitude = models.FloatField(null=True, blank=True)
    location_verified = models.BooleanField(default=False)
    location_distance_meters = models.FloatField(null=True, blank=True)


    # Current status of complaint
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="Pending"
    )

    # Priority will be automatically set
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="Low"
    )

    # If complaint is not solved in time, it becomes escalated
    is_escalated = models.BooleanField(default=False)

    # Portal user who submitted this complaint
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_complaints",
    )

    # Staff member assigned to solve complaint
    assigned_to = models.ForeignKey (
        User,
        on_delete=models.SET_NULL,
        null =True,
        blank=True
    )

    # When complaint was resolved
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Total time taken to resolve complaint
    resolution_time = models.DurationField(null=True, blank=True)

    # When complaint was created
    created_at = models.DateTimeField(auto_now_add=True)

    # This function sets priority automatically based on issue type
    def set_priority(self):
        if self.issue_type in ['No Water', 'Broken', 'No Electricity/Light']:
            self.priority = 'High'
        elif self.issue_type in ['Dirty', 'No Handwash/Soap', 'Bad Odor', 'No Ramp/Accessibility']:
            self.priority = 'Medium'
        else:
            self.priority = 'Low'

    # This function runs every time complaint is saved
    def save(self, *args, **kwargs):
        previous_status = None
        previous_assigned_to_id = None
        if self.pk:
            old_vals = Complaint.objects.filter(pk=self.pk).values("status", "assigned_to_id").first()
            if old_vals:
                previous_status = old_vals.get("status")
                previous_assigned_to_id = old_vals.get("assigned_to_id")

        # Automatically set priority before saving
        self.set_priority()

        # If complaint is pending for more than 6 hours, escalate it
        if self.status == "Pending" and self.created_at:
            if timezone.now() - self.created_at > timedelta(hours=6):

                self.is_escalated = True

        # When complaint is marked as resolved
        # Store resolution time automatically
        if self.status == "Resolved":
            if not self.resolved_at:
                self.resolved_at = timezone.now()
                self.resolution_time = self.resolved_at - self.created_at
        else:
            self.resolved_at = None
            self.resolution_time = None

        super().save(*args, **kwargs)

        # Trigger FCM push notification on NEW assignment or RE-ASSIGNMENT
        if self.assigned_to_id and self.assigned_to_id != previous_assigned_to_id:
            try:
                from workers.models import WorkerProfile
                from workers.fcm_service import send_fcm_push_notification
                profile = WorkerProfile.objects.filter(user_id=self.assigned_to_id).first()
                if profile and profile.fcm_token:
                    toilet_name = self.toilet.name if self.toilet_id else "Public Toilet"
                    title = "New Sanitrax Complaint Assigned"
                    body = f"Complaint #{self.id} • {self.priority} Priority • {self.issue_type} • {toilet_name}"
                    data_payload = {
                        "type": "complaint_assignment",
                        "complaint_id": str(self.id)
                    }
                    send_fcm_push_notification(profile.fcm_token, title, body, data_payload)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"FCM assignment push notice: {e}")

        # Reset toilet health metrics when complaint is resolved.
        if (
            self.status == "Resolved"
            and previous_status != "Resolved"
            and self.toilet_id
        ):
            resolved_by = self.assigned_to if self.assigned_to_id else None
            self.toilet.reset_to_optimal_state(resolved_by=resolved_by)
            CleaningHistory.objects.create(
                toilet=self.toilet,
                cleaned_at=timezone.now(),
                cleaned_by=resolved_by,
                status="Cleaned",
                notes=f"Cleaned and resolved via Complaint #{self.id} ({self.issue_type})"
            )

    def __str__(self):
        return f"{self.toilet.name} - {self.issue_type}"
