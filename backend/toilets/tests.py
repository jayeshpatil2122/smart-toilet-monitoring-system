from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from complaints.models import Complaint
from .models import CleaningHistory, SensorFailureLog, SensorStatus, Toilets


class ToiletSimulationTests(TestCase):
    def setUp(self):
        self.toilet = Toilets.objects.create(
            name="Demo Toilet",
            location="Ward 12",
            usage_count=0,
            cleanliness=100,
            water_level=100,
        )
        self.simulate_url = reverse("simulate_toilet", args=[self.toilet.id])

    def test_simulate_increase_usage(self):
        response = self.client.post(
            self.simulate_url,
            data={"action": "increase_usage", "value": 10},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.toilet.refresh_from_db()
        self.assertEqual(self.toilet.usage_count, 10)
        self.assertEqual(response.json()["toilet"]["usage_count"], 10)

    def test_simulate_force_critical(self):
        response = self.client.post(
            self.simulate_url,
            data={"action": "force_critical"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.toilet.refresh_from_db()
        self.assertEqual(self.toilet.status, "Critical")
        self.assertEqual(self.toilet.alert_level, 3)

    def test_simulate_reset(self):
        self.toilet.usage_count = 42
        self.toilet.cleanliness = 35
        self.toilet.water_level = 18
        self.toilet.save()

        response = self.client.post(
            self.simulate_url,
            data={"action": "reset"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.toilet.refresh_from_db()
        self.assertEqual(self.toilet.usage_count, 0)
        self.assertEqual(self.toilet.status, "Good")
        self.assertEqual(self.toilet.alert_level, 1)

    def test_qr_simulation_get_increases_usage(self):
        response = self.client.get(f"{self.simulate_url}?users=5")

        self.assertEqual(response.status_code, 200)
        self.toilet.refresh_from_db()
        self.assertEqual(self.toilet.usage_count, 5)
        self.assertEqual(response.json()["added_users"], 5)


class NewAddOnlyFeaturesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("adminuser", "admin@example.com", "password123")
        self.toilet = Toilets.objects.create(
            name="Test Washroom A",
            location="Terminal 1",
            cleanliness=90.0,
            water_level=90.0,
        )

    def test_feature1_sensor_failure_evaluation(self):
        sensor = SensorStatus.objects.create(
            sensor_key=SensorStatus.SENSOR_WATER,
            sensor_name="Water Level Sensor",
            blynk_pin="V1",
            is_working=False,
            error_message="No response received",
        )
        SensorStatus.evaluate_sensor_failures([sensor])

        failure_log = SensorFailureLog.objects.filter(sensor_type=SensorStatus.SENSOR_WATER, is_active=True).first()
        self.assertIsNotNone(failure_log)
        self.assertEqual(failure_log.status, SensorFailureLog.STATUS_NO_RESPONSE)
        self.assertEqual(failure_log.sensor_name, "Water Level Sensor")

        sensor.is_working = True
        sensor.last_value = "85"
        sensor.error_message = ""
        sensor.save()
        SensorStatus.evaluate_sensor_failures([sensor])

        failure_log.refresh_from_db()
        self.assertFalse(failure_log.is_active)
        self.assertIsNotNone(failure_log.recovered_at)

    def test_feature2_admin_analytics_view(self):
        self.client.login(username="adminuser", password="password123")
        response = self.client.get(reverse("admin_analytics"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("total_toilets", response.context)
        self.assertIn("total_complaints", response.context)
        self.assertIn("total_sensors", response.context)
        self.assertIn("total_cleanings", response.context)

    def test_feature3_cleaning_history_recording(self):
        clean_url = reverse("clean_toilet", args=[self.toilet.id])
        response = self.client.put(clean_url)
        self.assertEqual(response.status_code, 200)

        history = CleaningHistory.objects.filter(toilet=self.toilet).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.status, "Cleaned")

    def test_feature4_complaint_geotagging(self):
        complaint = Complaint.objects.create(
            toilet=self.toilet,
            issue_type="Dirty",
            description="Dirty floor near entrance",
            latitude=19.0760,
            longitude=72.8777,
        )
        self.assertEqual(complaint.latitude, 19.0760)
        self.assertEqual(complaint.longitude, 72.8777)

    def test_worker_location_resolution_verification(self):
        self.toilet.latitude = 19.0760
        self.toilet.longitude = 72.8777
        self.toilet.save()

        from workers.views import _haversine_distance_meters
        dist_close = _haversine_distance_meters(19.0760, 72.8777, 19.0760, 72.8777)
        self.assertLess(dist_close, 5.0)

        dist_far = _haversine_distance_meters(19.0760, 72.8777, 19.1760, 72.9777)
        self.assertGreater(dist_far, 1000.0)

    def test_detailed_sensor_status_endpoint(self):
        response = self.client.get(reverse("detailed_sensor_status"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("online_sensors", response.json())
        self.assertIn("active_alerts", response.json())


