from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CupGroup, Match, Stage, Team, Tournament
from .serializers import (
    CupGroupSerializer,
    MatchCreateSerializer,
    MatchResultSerializer,
    MatchSerializer,
    StageCreateSerializer,
    StageSerializer,
    TeamCreateSerializer,
    TeamSerializer,
    TournamentCreateSerializer,
    TournamentDetailSerializer,
    TournamentListSerializer,
)


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_staff


class TournamentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tournament.objects.filter(is_archived=False)
    permission_classes = (permissions.IsAuthenticated,)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentListSerializer

    def get_queryset(self):
        qs = Tournament.objects.all()
        if not self.request.user.is_staff:
            qs = qs.filter(is_archived=False)
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


class AdminTournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.all()
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TournamentDetailSerializer
        return TournamentCreateSerializer


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


class AdminMatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related(
        "home_team", "away_team", "winner_team", "stage", "tournament"
    )
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        if self.action in ("create",):
            return MatchCreateSerializer
        if self.action in ("update", "partial_update"):
            return MatchResultSerializer
        return MatchSerializer

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
        count = recalculate_match_scores(match)
        return Response({"detail": f"Recalculated {count} prediction(s)."})
