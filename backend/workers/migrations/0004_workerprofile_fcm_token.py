from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workers', '0003_workerprofile_assigned_area_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='workerprofile',
            name='fcm_token',
            field=models.TextField(blank=True, null=True),
        ),
    ]
