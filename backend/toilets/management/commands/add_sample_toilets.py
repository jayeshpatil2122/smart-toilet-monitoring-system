from django.core.management.base import BaseCommand
from toilets.models import Toilets


class Command(BaseCommand):
    help = 'Adds sample toilet data with Amaravati coordinates'

    def handle(self, *args, **kwargs):
        # Sample toilets with Amaravati coordinates
        # Amaravati center is approximately at 20.9333, 77.7513
        sample_toilets = [
            {
                'name': 'Amaravati Central Public Toilet',
                'location': 'Near Amaravati Bus Stand, Main Road',
                'latitude': 20.9350,
                'longitude': 77.7520,
                'status': 'Good',
                'cleanliness': 85.0,
                'water_level': 90.0,
                'health_score': 87.5,
                'usage_count': 150,
            },
            {
                'name': 'Amaravati Railway Station Toilet',
                'location': 'Amaravati Railway Station, Platform 1',
                'latitude': 20.9280,
                'longitude': 77.7480,
                'status': 'Good',
                'cleanliness': 90.0,
                'water_level': 95.0,
                'health_score': 92.5,
                'usage_count': 280,
            },
            {
                'name': 'Amaravati Market Complex Toilet',
                'location': 'Near Vegetable Market, MG Road',
                'latitude': 20.9380,
                'longitude': 77.7550,
                'status': 'Moderate',
                'cleanliness': 65.0,
                'water_level': 70.0,
                'health_score': 67.5,
                'usage_count': 420,
            },
            {
                'name': 'Amaravati Temple Toilet',
                'location': 'Near Mahadev Temple, Temple Road',
                'latitude': 20.9400,
                'longitude': 77.7490,
                'status': 'Good',
                'cleanliness': 88.0,
                'water_level': 92.0,
                'health_score': 90.0,
                'usage_count': 350,
            },
            {
                'name': 'Amaravati Park Toilet',
                'location': 'Near Central Park, Garden Area',
                'latitude': 20.9320,
                'longitude': 77.7600,
                'status': 'Moderate',
                'cleanliness': 60.0,
                'water_level': 75.0,
                'health_score': 67.5,
                'usage_count': 180,
            },
            {
                'name': 'Amaravati Hospital Toilet',
                'location': 'Government Hospital Campus',
                'latitude': 20.9250,
                'longitude': 77.7450,
                'status': 'Good',
                'cleanliness': 95.0,
                'water_level': 98.0,
                'health_score': 96.5,
                'usage_count': 520,
            },
            {
                'name': 'Amaravati College Toilet',
                'location': 'Amaravati Degree College Campus',
                'latitude': 20.9420,
                'longitude': 77.7380,
                'status': 'Good',
                'cleanliness': 82.0,
                'water_level': 88.0,
                'health_score': 85.0,
                'usage_count': 290,
            },
            {
                'name': 'Amaravati Mall Toilet',
                'location': 'City Shopping Mall, Ring Road',
                'latitude': 20.9450,
                'longitude': 77.7650,
                'status': 'Good',
                'cleanliness': 92.0,
                'water_level': 94.0,
                'health_score': 93.0,
                'usage_count': 650,
            },
            {
                'name': 'Amaravati Stadium Toilet',
                'location': 'Sports Stadium Complex',
                'latitude': 20.9200,
                'longitude': 77.7350,
                'status': 'Moderate',
                'cleanliness': 70.0,
                'water_level': 65.0,
                'health_score': 67.5,
                'usage_count': 210,
            },
            {
                'name': 'Amaravati Bus Depot Toilet',
                'location': 'New Bus Depot, Highway Road',
                'latitude': 20.9180,
                'longitude': 77.7700,
                'status': 'Critical',
                'cleanliness': 35.0,
                'water_level': 15.0,
                'health_score': 25.0,
                'usage_count': 480,
            },
        ]

        for toilet_data in sample_toilets:
            toilet, created = Toilets.objects.update_or_create(
                name=toilet_data['name'],
                defaults=toilet_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created: {toilet.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Updated: {toilet.name}'))

        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully added {len(sample_toilets)} toilets with Amaravati coordinates!'))
