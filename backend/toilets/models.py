from django.db import models
import random
from django.utils import timezone


class Toilets(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    usage_count = models.IntegerField(default=0)
    cleanliness = models.FloatField(default=100.0)
    water_level = models.FloatField(default=100.0)
    health_score = models.FloatField(default=100.0)
    alert_level = models.IntegerField(default=1)
    status = models.CharField(max_length=50, default='Good')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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

    def update_status(self):
        self.calculate_values()
        self.save()
