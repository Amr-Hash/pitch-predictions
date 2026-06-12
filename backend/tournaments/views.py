import logging
import os

from django.db import models
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .models import (
    CupGroup,
    Match,
    Stage,
    StandingRuleSet,
    Team,
    Tournament,
    TournamentSubscription,
)
from .serializers import (
    CupGroupCreateSerializer,
    CupGroupSerializer,
    MatchAdminUpdateSerializer,
    MatchCreateSerializer,
    MatchSerializer,
    StageCreateSerializer,
    StageSerializer,
    StandingRuleSetSerializer,
    TeamCreateSerializer,
    TeamSerializer,
    TournamentCreateSerializer,
    TournamentDetailSerializer,
    TournamentListSerializer,
)


from worldcup.permissions import IsAdminUser

logger = logging.getLogger(__name__)


def _live_score_error_response(exc: Exception, *, code: str) -> Response:
    logger.exception("Live score admin action failed: %s", exc)
    return Response(
        {
            "detail": "Live score operation failed. Check server logs for details.",
            "code": code,
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class TournamentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tournament.objects.filter(is_archived=False, is_active=True)
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentListSerializer

    def _active_tournaments(self):
        return Tournament.objects.filter(is_archived=False, is_active=True)

    def _subscribed_tournaments(self, user):
        return (
            self._active_tournaments()
            .filter(tournament_subscriptions__user=user)
            .distinct()
            .prefetch_related("stages", "cup_groups__group_teams__team", "standing_rule_set")
        )

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Tournament.objects.all().prefetch_related(
                "stages", "cup_groups__group_teams__team", "standing_rule_set"
            )
        return self._subscribed_tournaments(user)

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        """Active tournaments the user can subscribe to."""
        qs = (
            self._active_tournaments()
            .prefetch_related("standing_rule_set")
            .order_by("-year", "name")
        )
        subscribed_ids = set(
            TournamentSubscription.objects.filter(user=request.user).values_list(
                "tournament_id", flat=True
            )
        )
        data = TournamentListSerializer(qs, many=True).data
        for row in data:
            row["is_subscribed"] = row["id"] in subscribed_ids
        return Response(data)

    @action(detail=True, methods=["post"], url_path="subscribe")
    def subscribe(self, request, pk=None):
        from tournaments.services.subscriptions import subscribe_user_to_tournament

        try:
            tournament = self._active_tournaments().get(pk=pk)
        except Tournament.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        subscribe_user_to_tournament(request.user, tournament)
        return Response(
            TournamentListSerializer(
                tournament, context=self.get_serializer_context()
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="unsubscribe")
    def unsubscribe(self, request, pk=None):
        deleted, _ = TournamentSubscription.objects.filter(
            user=request.user, tournament_id=pk
        ).delete()
        if not deleted:
            return Response({"detail": "Not subscribed."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="cup-groups")
    def cup_groups(self, request, pk=None):
        tournament = self.get_object()
        groups = (
            CupGroup.objects.filter(tournament=tournament)
            .prefetch_related("group_teams__team")
            .order_by("name")
        )
        serializer = CupGroupSerializer(groups, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="standings")
    def standings(self, request, pk=None):
        from tournaments.services.standings import build_tournament_standings

        tournament = self.get_object()
        return Response(build_tournament_standings(tournament))


class AdminTournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.select_related("standing_rule_set").all()
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TournamentDetailSerializer
        if self.action == "list":
            return TournamentListSerializer
        return TournamentCreateSerializer

    @action(detail=False, methods=["get"], url_path="live-score-overview")
    def live_score_overview(self, request):
        from tournaments.services.live_score_status import get_live_score_overview

        try:
            return Response(get_live_score_overview())
        except Exception as exc:
            return _live_score_error_response(exc, code="live_score_overview_failed")

    @action(detail=True, methods=["get"], url_path="live-score-status")
    def live_score_status(self, request, pk=None):
        from tournaments.services.live_score_status import (
            get_global_live_score_environment,
            get_tournament_live_score_status,
        )

        tournament = self.get_object()
        try:
            return Response(
                {
                    "environment": get_global_live_score_environment(),
                    "tournament": get_tournament_live_score_status(
                        tournament, detailed=True
                    ),
                }
            )
        except Exception as exc:
            return _live_score_error_response(exc, code="live_score_status_failed")

    @action(detail=True, methods=["post"], url_path="sync-live-scores")
    def sync_live_scores(self, request, pk=None):
        from tournaments.services.live_scores import sync_tournament_live_scores

        tournament = self.get_object()
        try:
            result = sync_tournament_live_scores(tournament)
            return Response({"tournament_id": tournament.id, **result})
        except Exception as exc:
            return _live_score_error_response(exc, code="live_score_sync_failed")


class StageViewSet(viewsets.ModelViewSet):
    queryset = Stage.objects.select_related("tournament")
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StageCreateSerializer
        return StageSerializer


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all()
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        tournament_id = self.request.query_params.get("tournament")
        if tournament_id:
            from tournaments.models import Tournament
            from tournaments.services.team_eligibility import eligible_teams_for_tournament

            tournament = Tournament.objects.filter(pk=tournament_id).first()
            if tournament:
                return eligible_teams_for_tournament(tournament)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TeamCreateSerializer
        return TeamSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return super().get_permissions()


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MatchSerializer
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        qs = Match.objects.select_related(
            "home_team", "away_team", "winner_team", "stage", "tournament", "cup_group"
        )
        tournament_id = self.request.query_params.get("tournament")
        stage_id = self.request.query_params.get("stage")
        matchday = self.request.query_params.get("matchday")
        cup_group = self.request.query_params.get("cup_group")
        status_filter = self.request.query_params.get("status")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        if stage_id:
            qs = qs.filter(stage_id=stage_id)
        if matchday:
            qs = qs.filter(matchday=matchday)
        if cup_group:
            qs = qs.filter(cup_group__name=cup_group.upper())
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminStandingRuleSetViewSet(viewsets.ModelViewSet):
    queryset = StandingRuleSet.objects.annotate(
        tournament_count=models.Count("tournaments", distinct=True)
    )
    serializer_class = StandingRuleSetSerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get("active") == "1"
        competition_type = self.request.query_params.get("competition_type")
        if active_only:
            qs = qs.filter(is_active=True)
        if competition_type:
            qs = qs.filter(competition_type=competition_type)
        return qs


class AdminCupGroupViewSet(viewsets.ModelViewSet):
    queryset = CupGroup.objects.select_related("tournament").prefetch_related(
        "group_teams__team"
    )
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CupGroupCreateSerializer
        return CupGroupSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tournament_id = self.request.query_params.get("tournament")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        return qs


class AdminMatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related(
        "home_team", "away_team", "winner_team", "stage", "tournament", "cup_group"
    )
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "create":
            return MatchCreateSerializer
        if self.action in ("update", "partial_update"):
            return MatchAdminUpdateSerializer
        return MatchSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tournament_id = self.request.query_params.get("tournament")
        stage_id = self.request.query_params.get("stage")
        matchday = self.request.query_params.get("matchday")
        cup_group = self.request.query_params.get("cup_group")
        status_filter = self.request.query_params.get("status")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        if stage_id:
            qs = qs.filter(stage_id=stage_id)
        if matchday:
            qs = qs.filter(matchday=matchday)
        if cup_group:
            qs = qs.filter(cup_group__name=cup_group.upper())
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_update(self, serializer):
        match = serializer.save()
        if match.status == Match.Status.FINISHED:
            from predictions.services.scoring import recalculate_match_scores

            recalculate_match_scores(match)

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        from predictions.services.scoring import recalculate_match_scores

        match = self.get_object()
        if match.status != Match.Status.FINISHED:
            return Response(
                {"detail": "Match must be finished to recalculate scores."},
                status=400,
            )
        results = recalculate_match_scores(match)
        return Response(
            {
                "detail": f"Recalculated {len(results)} prediction(s).",
                "predictions": results,
            }
        )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def api_football_webhook(request):
    """
    Optional push endpoint for API-Football (or a proxy cron).
    Set API_FOOTBALL_WEBHOOK_SECRET and send it as X-Webhook-Secret.
    """
    secret = os.environ.get("API_FOOTBALL_WEBHOOK_SECRET", "").strip()
    if not secret or request.headers.get("X-Webhook-Secret") != secret:
        return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    from tournaments.services.live_scores import sync_tournament_live_scores

    tournament_id = request.data.get("tournament_id")
    if not tournament_id:
        return Response(
            {"detail": "tournament_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        tournament = Tournament.objects.get(pk=tournament_id)
    except Tournament.DoesNotExist:
        return Response({"detail": "Tournament not found."}, status=status.HTTP_404_NOT_FOUND)

    result = sync_tournament_live_scores(tournament)
    return Response({"tournament_id": tournament.id, **result})


def _authorize_cron_request(request) -> bool:
    secret = os.environ.get("CRON_SECRET", "").strip()
    if not secret:
        return False
    auth = request.META.get("HTTP_AUTHORIZATION", "") or request.headers.get(
        "Authorization", ""
    )
    if auth == f"Bearer {secret}":
        return True
    cron_header = request.META.get("HTTP_X_CRON_SECRET", "") or request.headers.get(
        "X-Cron-Secret", ""
    )
    return cron_header == secret


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def cron_sync_live_scores(request):
    """
    Vercel Cron entrypoint. Set CRON_SECRET in project env.
  Authorization: Bearer <CRON_SECRET>
    """
    if not _authorize_cron_request(request):
        return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    from tournaments.services.live_scores import sync_all_configured_tournaments

    tournaments = sync_all_configured_tournaments()
    return Response({"tournaments": tournaments})


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def cron_map_wc2026_fixtures(request):
    """
    Map WC 2026 group fixtures to API-Football IDs on production.
    Authorization: Bearer <CRON_SECRET>
    """
    if not _authorize_cron_request(request):
        return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    from tournaments.services.wc2026_fixture_mapping import map_wc2026_group_fixtures

    dry_run = request.query_params.get("dry_run", "").lower() in {"1", "true", "yes"}
    result = map_wc2026_group_fixtures(dry_run=dry_run)
    status_code = status.HTTP_200_OK if result.get("ok") else status.HTTP_400_BAD_REQUEST
    return Response(result, status=status_code)
