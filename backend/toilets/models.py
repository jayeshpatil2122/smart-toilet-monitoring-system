from django.db import models
from django.contrib.auth.models import User
import random
from django.utils import timezone


class Toilets(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    is_disabled_friendly = models.BooleanField(
        default=False,
        help_text="Enable if this toilet can be used by disabled persons.",
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    usage_count = models.IntegerField(default=0)
    cleanliness = models.FloatField(default=100.0)
    water_level = models.FloatField(default=100.0)
    health_score = models.FloatField(default=100.0)
    alert_level = models.IntegerField(default=1)
    status = models.CharField(max_length=50, default='Good')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    ALERT_THRESHOLD = 40

    def __str__(self):
        return self.name

    def _update_health_and_status(self):
        self.cleanliness = round(max(self.cleanliness, 0), 2)
        self.water_level = round(max(self.water_level, 0), 2)
        self.health_score = round((self.cleanliness + self.water_level) / 2, 2)

        if self.cleanliness < 40 or self.water_level < 20:
            self.status = 'Critical'
            self.alert_level = 3
        elif self.cleanliness < 70:
            self.status = 'Moderate'
            self.alert_level = 2
        else:
            self.status = 'Good'
            self.alert_level = 1

    def _alert_priority_for_metric(self, metric_value):
        if metric_value < 20:
            return ToiletAlert.PRIORITY_HIGH
        if metric_value < 30:
            return ToiletAlert.PRIORITY_MEDIUM
        return ToiletAlert.PRIORITY_LOW

    def _upsert_metric_alert(self, alert_type, message, metric_value):
        priority = self._alert_priority_for_metric(metric_value)
        existing = (
            self.alerts.filter(alert_type=alert_type, status=ToiletAlert.STATUS_PENDING)
            .order_by("-created_at")
            .first()
        )
        if existing:
            changed = False
            if existing.message != message:
                existing.message = message
                changed = True
            if existing.priority != priority:
                existing.priority = priority
                changed = True
            if changed:
                existing.save()
            return existing

        return ToiletAlert.objects.create(
            toilet=self,
            alert_type=alert_type,
            message=message,
            priority=priority,
            status=ToiletAlert.STATUS_PENDING,
        )

    def _resolve_metric_alert(self, alert_type, resolved_by=None):
        pending_alerts = self.alerts.filter(
            alert_type=alert_type,
            status=ToiletAlert.STATUS_PENDING,
        )
        for alert in pending_alerts:
            alert.mark_resolved(resolved_by=resolved_by)

    def _sync_metric_alerts(self):
        cleanliness_value = float(self.cleanliness or 0)
        water_value = float(self.water_level or 0)

        if cleanliness_value < self.ALERT_THRESHOLD:
            self._upsert_metric_alert(
                ToiletAlert.TYPE_LOW_CLEANLINESS,
                f"Cleanliness dropped below {self.ALERT_THRESHOLD}% (currently {cleanliness_value:.1f}%).",
                cleanliness_value,
            )
        else:
            self._resolve_metric_alert(ToiletAlert.TYPE_LOW_CLEANLINESS)

        if water_value < self.ALERT_THRESHOLD:
            self._upsert_metric_alert(
                ToiletAlert.TYPE_LOW_WATER,
                f"Water level dropped below {self.ALERT_THRESHOLD}% (currently {water_value:.1f}%).",
                water_value,
            )
        else:
            self._resolve_metric_alert(ToiletAlert.TYPE_LOW_WATER)

    def resolve_open_alerts(self, resolved_by=None):
        pending_alerts = self.alerts.filter(status=ToiletAlert.STATUS_PENDING)
        for alert in pending_alerts:
            alert.mark_resolved(resolved_by=resolved_by)

    def reset_to_optimal_state(self, resolved_by=None):
        self.cleanliness = 100.0
        self.water_level = 100.0
        self.health_score = 100.0
        self.status = "Good"
        self.alert_level = 1
        self.resolve_open_alerts(resolved_by=resolved_by)
        self.save()

    def calculate_values(self, users=1):
        for _ in range(max(users, 0)):
            water_used = random.uniform(3, 8)
            cleanliness_drop = random.uniform(0.3, 1.0)

            current_hour = timezone.localtime().hour
            if 8 <= current_hour <= 11 or 17 <= current_hour <= 21:
                cleanliness_drop *= 1.3

            self.cleanliness -= cleanliness_drop
            water_percentage_drop = (water_used / 1000) * 100
            self.water_level -= water_percentage_drop

        self._update_health_and_status()

    def save(self, *args, **kwargs):
        if self.pk:
            old = Toilets.objects.get(pk=self.pk)
            usage_delta = self.usage_count - old.usage_count
            if usage_delta > 0:
                self.calculate_values(users=usage_delta)
            else:
                self._update_health_and_status()
        else:
            if self.usage_count > 0:
                self.calculate_values(users=self.usage_count)
            else:
                self._update_health_and_status()

        super().save(*args, **kwargs)
        self._sync_metric_alerts()

    def update_status(self):
        self.calculate_values()
        self.save()


class ToiletAlert(models.Model):
    TYPE_LOW_WATER = "Low Water"
    TYPE_LOW_CLEANLINESS = "Low Cleanliness"
    ALERT_TYPE_CHOICES = [
        (TYPE_LOW_WATER, TYPE_LOW_WATER),
        (TYPE_LOW_CLEANLINESS, TYPE_LOW_CLEANLINESS),
    ]

    PRIORITY_LOW = "Low"
    PRIORITY_MEDIUM = "Medium"
    PRIORITY_HIGH = "High"
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, PRIORITY_LOW),
        (PRIORITY_MEDIUM, PRIORITY_MEDIUM),
        (PRIORITY_HIGH, PRIORITY_HIGH),
    ]

    STATUS_PENDING = "Pending"
    STATUS_RESOLVED = "Resolved"
    STATUS_CHOICES = [
        (STATUS_PENDING, STATUS_PENDING),
        (STATUS_RESOLVED, STATUS_RESOLVED),
    ]

    toilet = models.ForeignKey(Toilets, on_delete=models.CASCADE, related_name="alerts")
    alert_type = models.CharField(max_length=40, choices=ALERT_TYPE_CHOICES)
    message = models.CharField(max_length=255)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_toilet_alerts",
    )
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_toilet_alerts",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.toilet.name} - {self.alert_type}"

    def mark_resolved(self, resolved_by=None):
        changed = False
        if self.status != self.STATUS_RESOLVED:
            self.status = self.STATUS_RESOLVED
            changed = True
        if not self.resolved_at:
            self.resolved_at = timezone.now()
            changed = True
        if resolved_by and self.resolved_by_id != resolved_by.id:
            self.resolved_by = resolved_by
            changed = True
        if changed:
            self.save()

    def mark_pending(self):
        changed = False
        if self.status != self.STATUS_PENDING:
            self.status = self.STATUS_PENDING
            changed = True
        if self.resolved_at is not None:
            self.resolved_at = None
            changed = True
        if self.resolved_by_id is not None:
            self.resolved_by = None
            changed = True
        if changed:
            self.save()
