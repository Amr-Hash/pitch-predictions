from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminCupGroupViewSet,
    AdminMatchViewSet,
    AdminStandingRuleSetViewSet,
    AdminTournamentViewSet,
    MatchViewSet,
    StageViewSet,
    TeamViewSet,
    TournamentViewSet,
)

router = DefaultRouter(trailing_slash=False)
router.register("teams", TeamViewSet, basename="team")
router.register("matches", MatchViewSet, basename="match")
router.register("", TournamentViewSet, basename="tournament")

admin_router = DefaultRouter(trailing_slash=False)
admin_router.register(
    "standing-rule-sets", AdminStandingRuleSetViewSet, basename="admin-standing-rule-set"
)
admin_router.register("cup-groups", AdminCupGroupViewSet, basename="admin-cup-group")
admin_router.register("tournaments", AdminTournamentViewSet, basename="admin-tournament")
admin_router.register("stages", StageViewSet, basename="admin-stage")
admin_router.register("matches", AdminMatchViewSet, basename="admin-match")

urlpatterns = [
    path("admin/", include(admin_router.urls)),
    path("", include(router.urls)),
]
