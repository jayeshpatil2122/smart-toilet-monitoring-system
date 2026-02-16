from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Toilets
from .serializers import ToiletSerializer
from django.shortcuts import get_object_or_404


@api_view(['GET'])
def get_toilets(request):
    toilets = Toilets.objects.all()
    serializer = ToiletSerializer(toilets, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def enter_toilet(request, pk):
    toilet = get_object_or_404(Toilets, id=pk)
    toilet.usage_count += 1
    toilet.save()   # 🔥 THIS IS IMPORTANT
    serializer = ToiletSerializer(toilet)
    return Response(serializer.data)


@api_view(['PUT'])
def clean_toilet(request, pk):
    toilet = get_object_or_404(Toilets, id=pk)
    toilet.usage_count = 0
    toilet.cleanliness = 100
    toilet.water_level = 100
    toilet.status = "Good"
    toilet.health_score = 100
    toilet.alert_level = 1
    toilet.save()
    serializer = ToiletSerializer(toilet)
    return Response(serializer.data)
