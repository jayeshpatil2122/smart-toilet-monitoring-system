from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
import random
import json
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.utils import timezone


class Toilets(models.Model):
    TYPE_MALE = "Male"
    TYPE_FEMALE = "Female"
    TYPE_BOTH = "Both"
    TOILET_TYPE_CHOICES = [
        (TYPE_MALE, TYPE_MALE),
        (TYPE_FEMALE, TYPE_FEMALE),
        (TYPE_BOTH, TYPE_BOTH),
    ]

    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    toilet_type = models.CharField(max_length=10, choices=TOILET_TYPE_CHOICES, default=TYPE_BOTH)
    is_disabled_friendly = models.BooleanField(
        default=False,
        help_text="Enable if this toilet can be used by disabled persons.",
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    usage_count = models.IntegerField(default=0)
    cleanliness = models.FloatField(default=100.0)
    water_level = models.FloatField(default=100.0)
    gas_level = models.FloatField(default=0.0)
    dustbin_level = models.FloatField(default=0.0)
    motion_detected = models.BooleanField(default=False)
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


class ToiletRating(models.Model):
    toilet = models.ForeignKey(Toilets, on_delete=models.CASCADE, related_name="ratings")
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="toilet_ratings",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, max_length=500, help_text="User review comment")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("toilet", "submitted_by")
        ordering = ["-updated_at"]

    def __str__(self):
        user_label = self.submitted_by.username if self.submitted_by_id else "Anonymous"
        return f"{self.toilet.name} - {self.rating} by {user_label}"


class ToiletAlert(models.Model):
    TYPE_LOW_WATER = "Low Water"
    TYPE_LOW_CLEANLINESS = "Low Cleanliness"
    TYPE_HIGH_GAS = "High Gas"
    TYPE_DUSTBIN_FULL = "Dustbin Full"
    ALERT_TYPE_CHOICES = [
        (TYPE_LOW_WATER, TYPE_LOW_WATER),
        (TYPE_LOW_CLEANLINESS, TYPE_LOW_CLEANLINESS),
        (TYPE_HIGH_GAS, TYPE_HIGH_GAS),
        (TYPE_DUSTBIN_FULL, TYPE_DUSTBIN_FULL),
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


class SensorStatus(models.Model):
    SENSOR_GAS = "gas"
    SENSOR_WATER = "water"
    SENSOR_DUSTBIN = "dustbin"
    SENSOR_PEOPLE = "people"
    SENSOR_MOTION = "motion"
    SENSOR_CHOICES = [
        (SENSOR_GAS, "Gas Sensor"),
        (SENSOR_WATER, "Water Sensor"),
        (SENSOR_DUSTBIN, "Dustbin Sensor"),
        (SENSOR_PEOPLE, "People Counter Sensor"),
        (SENSOR_MOTION, "Motion Sensor"),
    ]

    sensor_key = models.CharField(max_length=20, unique=True, choices=SENSOR_CHOICES)
    sensor_name = models.CharField(max_length=80)
    blynk_pin = models.CharField(max_length=10)
    is_working = models.BooleanField(default=False)
    last_value = models.CharField(max_length=255, blank=True, default="")
    error_message = models.CharField(max_length=255, blank=True, default="")
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_working_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Sensor"
        verbose_name_plural = "Sensors"
        ordering = ["sensor_name"]

    def __str__(self):
        return self.sensor_name

    @classmethod
    def _sensor_definitions(cls):
        return [
            (cls.SENSOR_GAS, "Gas Sensor", getattr(settings, "BLYNK_GAS_PIN", "V0")),
            (cls.SENSOR_WATER, "Water Sensor", getattr(settings, "BLYNK_WATER_PIN", "V1")),
            (cls.SENSOR_DUSTBIN, "Dustbin Sensor", getattr(settings, "BLYNK_DUSTBIN_PIN", "V2")),
            (cls.SENSOR_PEOPLE, "People Counter Sensor", getattr(settings, "BLYNK_PEOPLE_PIN", "V3")),
            (cls.SENSOR_MOTION, "Motion Sensor", getattr(settings, "BLYNK_MOTION_PIN", "V4")),
        ]

    @classmethod
    def ensure_default_records(cls):
        for sensor_key, sensor_name, blynk_pin in cls._sensor_definitions():
            cls.objects.update_or_create(
                sensor_key=sensor_key,
                defaults={
                    "sensor_name": sensor_name,
                    "blynk_pin": str(blynk_pin).strip(),
                },
            )

    @classmethod
    def _build_blynk_url(cls, token, pin):
        query = urlencode({"token": token})
        return f"https://blynk.cloud/external/api/get?{query}&{pin}"

    @classmethod
    def _stringify_value(cls, value):
        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)

    @classmethod
    def _fetch_pin_value(cls, token, pin):
        if not token:
            return None, "Missing Blynk token."

        timeout_seconds = 2.0
        try:
            timeout_seconds = float(getattr(settings, "BLYNK_REQUEST_TIMEOUT_SECONDS", 2.0))
        except (TypeError, ValueError):
            timeout_seconds = 2.0

        url = cls._build_blynk_url(token, pin)
        try:
            with urlopen(url, timeout=timeout_seconds) as response:
                raw_value = response.read().decode("utf-8").strip()
        except Exception as exc:
            return None, str(exc)[:255]

        if not raw_value:
            return None, "Empty response from Blynk."

        try:
            parsed = json.loads(raw_value)
        except ValueError:
            return raw_value, ""

        if isinstance(parsed, list):
            if not parsed:
                return None, "Empty list response from Blynk."
            return parsed[0], ""
        return parsed, ""

    @classmethod
    def refresh_all_from_blynk(cls):
        cls.ensure_default_records()
        sensors = list(cls.objects.all())
        if not sensors:
            return 0

        token = str(getattr(settings, "BLYNK_AUTH_TOKEN", "")).strip()
        now = timezone.now()

        if not token:
            for sensor in sensors:
                sensor.is_working = False
                sensor.last_checked_at = now
                sensor.error_message = "Missing Blynk auth token."
                sensor.save(
                    update_fields=[
                        "is_working",
                        "last_checked_at",
                        "error_message",
                        "updated_at",
                    ]
                )
            return 0

        with ThreadPoolExecutor(max_workers=len(sensors)) as executor:
            futures = {
                sensor.id: executor.submit(cls._fetch_pin_value, token, sensor.blynk_pin)
                for sensor in sensors
            }

            working_count = 0
            for sensor in sensors:
                value = None
                error_message = "No data received."
                future = futures.get(sensor.id)
                if future is not None:
                    try:
                        value, error_message = future.result()
                    except Exception as exc:
                        value = None
                        error_message = str(exc)[:255]

                value_as_text = cls._stringify_value(value).strip()
                is_working = bool(value_as_text)

                sensor.is_working = is_working
                sensor.last_value = value_as_text if is_working else ""
                sensor.last_checked_at = now
                sensor.error_message = "" if is_working else (error_message or "No data received.")[:255]
                if is_working:
                    sensor.last_working_at = now
                    working_count += 1

                sensor.save(
                    update_fields=[
                        "is_working",
                        "last_value",
                        "last_checked_at",
                        "last_working_at",
                        "error_message",
                        "updated_at",
                    ]
                )

        return working_count
