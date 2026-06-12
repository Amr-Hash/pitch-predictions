import os

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import CupGroup, Match, Stage, Team, Tournament
from .serializers import (
    CupGroupCreateSerializer,
    CupGroupSerializer,
    MatchAdminUpdateSerializer,
    MatchCreateSerializer,
    MatchSerializer,
    StageCreateSerializer,
    StageSerializer,
    TeamCreateSerializer,
    TeamSerializer,
    TournamentCreateSerializer,
    TournamentDetailSerializer,
    TournamentListSerializer,
)


from worldcup.permissions import IsAdminUser


class TournamentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tournament.objects.filter(is_archived=False, is_active=True)
    permission_classes = (permissions.IsAuthenticated,)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentListSerializer

    def get_queryset(self):
        qs = Tournament.objects.all()
        if not self.request.user.is_staff:
            qs = qs.filter(is_archived=False, is_active=True)
        return qs.prefetch_related("stages", "cup_groups__group_teams__team")

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
    queryset = Tournament.objects.all()
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TournamentDetailSerializer
        if self.action == "list":
            return TournamentListSerializer
        return TournamentCreateSerializer

    @action(detail=True, methods=["post"], url_path="sync-live-scores")
    def sync_live_scores(self, request, pk=None):
        from tournaments.services.live_scores import sync_tournament_live_scores

        tournament = self.get_object()
        result = sync_tournament_live_scores(tournament)
        return Response({"tournament_id": tournament.id, **result})


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
