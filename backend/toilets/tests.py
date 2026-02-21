from django.test import TestCase
from django.urls import reverse

from .models import Toilets


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
