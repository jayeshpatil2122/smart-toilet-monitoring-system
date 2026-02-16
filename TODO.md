# TODO List for Fixing Django Project Errors

## Priority 1: Fix Syntax Errors in toilets/views.py
- [x] Fix Toilets.object.all() -> Toilets.objects.all()
- [x] Fix many=true -> many=True
- [x] Fix Toilet.objects.get() -> Toilets.objects.get()
- [x] Fix spacing in serializer assignments

## Priority 2: Create Toilets App Models and Serializers
- [x] Create Toilets model in backend/toilets/models.py
- [x] Create ToiletSerializer in backend/toilets/serializers.py
- [x] Create URL patterns in backend/toilets/urls.py

## Priority 3: Create Complaints App Components
- [x] Create Complaint model in backend/complaints/models.py
- [x] Create ComplaintSerializer in backend/complaints/serializers.py
- [x] Create view functions in backend/complaints/views.py

## Priority 4: Run Migrations
- [x] Run Django migrations
- [x] Verify Django check passes
