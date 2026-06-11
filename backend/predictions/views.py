from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from groups.models import Group, GroupMember
from tournaments.models import Match, Tournament

from .models import Prediction
from .serializers import PredictionCreateUpdateSerializer, PredictionSerializer
from .services.scoring import calculate_prediction_points


class PredictionViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = Prediction.objects.filter(user=self.request.user).select_related(
            "match",
            "match__home_team",
            "match__away_team",
            "match__stage",
            "group",
            "predicted_winner_team",
        )
        group_id = self.request.query_params.get("group")
        match_id = self.request.query_params.get("match")
        tournament_id = self.request.query_params.get("tournament")
        if group_id:
            qs = qs.filter(group_id=group_id)
        if match_id:
            qs = qs.filter(match_id=match_id)
        if tournament_id:
            qs = qs.filter(match__tournament_id=tournament_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PredictionCreateUpdateSerializer
        return PredictionSerializer

    def perform_update(self, serializer):
        prediction = serializer.save()
        if prediction.match.status == Match.Status.FINISHED:
            breakdown = calculate_prediction_points(prediction, prediction.match)
            prediction.points_awarded = breakdown.total_points
            prediction.save(update_fields=["points_awarded"])


class GroupLeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_id):
        try:
            group = Group.objects.get(pk=group_id)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=404)

        if not GroupMember.objects.filter(user=request.user, group=group).exists():
            return Response({"detail": "Not a group member."}, status=403)

        tournament_id = request.query_params.get("tournament")
        predictions_qs = Prediction.objects.filter(group=group)
        if tournament_id:
            predictions_qs = predictions_qs.filter(match__tournament_id=tournament_id)

        members = GroupMember.objects.filter(group=group).select_related("user")
        leaderboard = []
        for membership in members:
            user_preds = predictions_qs.filter(user=membership.user)
            total_points = user_preds.aggregate(total=Sum("points_awarded"))["total"] or 0
            exact_count = user_preds.filter(points_awarded__gte=5).count()
            outcome_count = user_preds.filter(points_awarded__gte=1).count()
            leaderboard.append(
                {
                    "user_id": membership.user.id,
                    "username": membership.user.username,
                    "total_points": total_points,
                    "exact_predictions": exact_count,
                    "correct_outcomes": outcome_count,
                }
            )

        leaderboard.sort(
            key=lambda x: (
                -x["total_points"],
                -x["exact_predictions"],
                -x["correct_outcomes"],
            )
        )
        for rank, entry in enumerate(leaderboard, start=1):
            entry["rank"] = rank

        return Response(leaderboard)


class GlobalLeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        tournament_id = request.query_params.get("tournament")
        predictions_qs = Prediction.objects.all()
        if tournament_id:
            predictions_qs = predictions_qs.filter(match__tournament_id=tournament_id)

        stats = (
            predictions_qs.values("user_id", "user__username")
            .annotate(
                total_points=Sum("points_awarded"),
                exact_predictions=Count("id", filter=Q(points_awarded__gte=5)),
                correct_outcomes=Count("id", filter=Q(points_awarded__gte=1)),
            )
            .order_by("-total_points", "-exact_predictions", "-correct_outcomes")
        )

        leaderboard = []
        for rank, entry in enumerate(stats, start=1):
            leaderboard.append(
                {
                    "rank": rank,
                    "user_id": entry["user_id"],
                    "username": entry["user__username"],
                    "total_points": entry["total_points"] or 0,
                    "exact_predictions": entry["exact_predictions"],
                    "correct_outcomes": entry["correct_outcomes"],
                }
            )
        return Response(leaderboard)


class DashboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        tournament_id = request.query_params.get("tournament")
        group_id = request.query_params.get("group")

        groups = Group.objects.filter(memberships__user=user).distinct()
        groups_data = [
            {"id": g.id, "name": g.name, "invite_code": g.invite_code} for g in groups
        ]

        matches_qs = Match.objects.filter(status=Match.Status.SCHEDULED).select_related(
            "home_team", "away_team", "stage"
        )
        if tournament_id:
            matches_qs = matches_qs.filter(tournament_id=tournament_id)
        upcoming = matches_qs.filter(
            kickoff_time__gte=timezone.now()
        ).order_by("kickoff_time")[:10]

        predictions_qs = Prediction.objects.filter(user=user)
        if group_id:
            predictions_qs = predictions_qs.filter(group_id=group_id)
        if tournament_id:
            predictions_qs = predictions_qs.filter(match__tournament_id=tournament_id)

        predicted_match_ids = set(predictions_qs.values_list("match_id", flat=True))
        pending = []
        for match in upcoming:
            if match.id not in predicted_match_ids and not match.is_locked:
                pending.append(match)

        recent_results_qs = Match.objects.filter(
            status=Match.Status.FINISHED
        ).select_related("home_team", "away_team", "stage")
        if tournament_id:
            recent_results_qs = recent_results_qs.filter(tournament_id=tournament_id)
        recent_results = recent_results_qs.order_by("-kickoff_time")[:10]

        total_points = predictions_qs.aggregate(total=Sum("points_awarded"))["total"] or 0

        from tournaments.serializers import MatchSerializer

        return Response(
            {
                "groups": groups_data,
                "upcoming_matches": MatchSerializer(upcoming, many=True).data,
                "pending_predictions": MatchSerializer(pending[:10], many=True).data,
                "recent_results": MatchSerializer(recent_results, many=True).data,
                "total_points": total_points,
                "current_rank": self._get_user_rank(user, tournament_id),
            }
        )

    def _get_user_rank(self, user, tournament_id):
        predictions_qs = Prediction.objects.all()
        if tournament_id:
            predictions_qs = predictions_qs.filter(match__tournament_id=tournament_id)
        stats = list(
            predictions_qs.values("user_id")
            .annotate(total=Sum("points_awarded"))
            .order_by("-total")
        )
        for rank, entry in enumerate(stats, start=1):
            if entry["user_id"] == user.id:
                return rank
        return None
