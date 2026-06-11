from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminGroupViewSet, GroupViewSet

router = DefaultRouter(trailing_slash=False)
router.register("", GroupViewSet, basename="group")

admin_router = DefaultRouter(trailing_slash=False)
admin_router.register("", AdminGroupViewSet, basename="admin-group")

urlpatterns = [
    path("admin/", include(admin_router.urls)),
    path("", include(router.urls)),
]
