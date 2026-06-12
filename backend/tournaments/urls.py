from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminCupGroupViewSet,
    AdminMatchViewSet,
    AdminTournamentViewSet,
    MatchViewSet,
    StageViewSet,
    TeamViewSet,
    TournamentViewSet,
    api_football_webhook,
)

router = DefaultRouter(trailing_slash=False)
router.register("teams", TeamViewSet, basename="team")
router.register("matches", MatchViewSet, basename="match")
router.register("", TournamentViewSet, basename="tournament")

admin_router = DefaultRouter(trailing_slash=False)
admin_router.register("cup-groups", AdminCupGroupViewSet, basename="admin-cup-group")
admin_router.register("tournaments", AdminTournamentViewSet, basename="admin-tournament")
admin_router.register("stages", StageViewSet, basename="admin-stage")
admin_router.register("matches", AdminMatchViewSet, basename="admin-match")

urlpatterns = [
    path("webhooks/live-scores/api-football", api_football_webhook),
    path("admin/", include(admin_router.urls)),
    path("", include(router.urls)),
]
