from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve as static_serve

admin.site.site_header = "SANITRAX Admin Panel"
admin.site.site_title = "SANITRAX Admin"
admin.site.index_title = "SANITRAX Administration Console"

urlpatterns = [
    path("", lambda request: HttpResponse("Smart Toilet API Running")),
    path("admin/", admin.site.urls),
    path("api/toilets/", include("toilets.urls")),
    path("api/complaints/", include("complaints.urls")),
    path("api/workers/", include("workers.urls")),
    path("api/payments/", include("payments.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Keep uploaded complaint images accessible even when DEBUG=False.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            static_serve,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
