from rest_framework import serializers
from django.db.models import Avg

from .models import Toilets, ToiletRating


class ToiletSerializer(serializers.ModelSerializer):
    average_rating = serializers.SerializerMethodField()
    ratings_count = serializers.SerializerMethodField()
    my_rating = serializers.SerializerMethodField()

    def get_average_rating(self, obj):
        value = getattr(obj, "average_rating", None)
        if value is None:
            value = obj.ratings.aggregate(avg=Avg("rating")).get("avg")
        if value is None:
            return 0.0
        return round(float(value), 1)

    def get_ratings_count(self, obj):
        value = getattr(obj, "ratings_count", None)
        if value is None:
            value = obj.ratings.count()
        return int(value or 0)

    def get_my_rating(self, obj):
        value = getattr(obj, "my_rating", None)
        if value is not None:
            return int(value)

        user_id = self.context.get("rating_user_id")
        if not user_id:
            return None

        rating_obj = obj.ratings.filter(submitted_by_id=user_id).values("rating").first()
        return int(rating_obj["rating"]) if rating_obj else None

    class Meta:
        model = Toilets
        fields = [
            'id',
            'name',
            'location',
            'toilet_type',
            'is_disabled_friendly',
            'latitude',
            'longitude',
            'usage_count',
            'cleanliness',
            'water_level',
            'gas_level',
            'dustbin_level',
            'motion_detected',
            'health_score',
            'alert_level',
            'status',
            'average_rating',
            'ratings_count',
            'my_rating',
            'created_at',
            'updated_at',
        ]


class ToiletRatingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="submitted_by.username", default="Anonymous")
    
    class Meta:
        model = ToiletRating
        fields = ['id', 'rating', 'comment', 'username', 'created_at']
        read_only_fields = ['id', 'username', 'created_at']
