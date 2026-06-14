from django.db.models import Sum
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from groups.models import Group, GroupMember
from tournaments.models import Match

from .models import Prediction
from .serializers import PredictionCreateUpdateSerializer, PredictionSerializer
from .services.dashboard import (
    count_pending_predictions,
    get_live_matches,
    get_pending_matches,
    get_recent_results,
    get_upcoming_matches,
)
from .services.scoring import calculate_prediction_points


class PendingCountThrottle(UserRateThrottle):
    rate = "6000/hour"


from worldcup.pagination import OptionalPagination


class PredictionViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = OptionalPagination

    def get_queryset(self):
        qs = Prediction.objects.filter(user=self.request.user).select_related(
            "match",
            "match__home_team",
            "match__away_team",
            "match__stage",
            "predicted_winner_team",
        )
        match_id = self.request.query_params.get("match")
        tournament_id = self.request.query_params.get("tournament")
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

        from predictions.services.leaderboard import get_cached_group_leaderboard

        tournament_id = request.query_params.get("tournament")
        return Response(get_cached_group_leaderboard(group, tournament_id))


class GlobalLeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from predictions.services.leaderboard import get_cached_global_leaderboard

        tournament_id = request.query_params.get("tournament")
        return Response(get_cached_global_leaderboard(tournament_id))


class DashboardPendingCountView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    throttle_classes = (PendingCountThrottle,)

    def get(self, request):
        tournament_id = request.query_params.get("tournament")
        return Response(
            {
                "pending_count": count_pending_predictions(
                    request.user, tournament_id
                ),
            }
        )


class DashboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        tournament_id = request.query_params.get("tournament")

        groups = Group.objects.filter(memberships__user=user).distinct()
        groups_data = self._get_group_summaries(user, tournament_id, groups)

        upcoming = get_upcoming_matches(tournament_id)
        live_matches = get_live_matches(tournament_id)
        next_match = upcoming[0] if upcoming else None
        pending = get_pending_matches(user, tournament_id)
        recent_results = get_recent_results(tournament_id)

        predictions_qs = Prediction.objects.filter(user=user)
        if tournament_id:
            predictions_qs = predictions_qs.filter(match__tournament_id=tournament_id)

        total_points = predictions_qs.aggregate(total=Sum("points_awarded"))["total"] or 0

        from tournaments.serializers import MatchSerializer

        serializer_context = {"request": request}

        from predictions.services.leaderboard import (
            build_podium_from_leaderboard,
            get_cached_global_leaderboard,
        )

        global_leaderboard = get_cached_global_leaderboard(tournament_id)
        global_leader_points = (
            global_leaderboard[0]["total_points"] if global_leaderboard else 0
        )
        global_podium = build_podium_from_leaderboard(global_leaderboard, user.id)
        current_rank = next(
            (row["rank"] for row in global_leaderboard if row["user_id"] == user.id),
            None,
        )

        from predictions.serializers import PredictionSerializer

        predictions_data = PredictionSerializer(
            predictions_qs.select_related(
                "match__home_team",
                "match__away_team",
                "match__stage",
                "predicted_winner_team",
            ),
            many=True,
            context=serializer_context,
        ).data

        return Response(
            {
                "groups": groups_data,
                "global_podium": global_podium,
                "global_leader_points": global_leader_points,
                "upcoming_matches": MatchSerializer(
                    upcoming, many=True, context=serializer_context
                ).data,
                "live_matches": MatchSerializer(
                    live_matches, many=True, context=serializer_context
                ).data,
                "next_match": (
                    MatchSerializer(next_match, context=serializer_context).data
                    if next_match
                    else None
                ),
                "pending_predictions": MatchSerializer(
                    pending, many=True, context=serializer_context
                ).data,
                "pending_count": len(pending),
                "recent_results": MatchSerializer(
                    recent_results, many=True, context=serializer_context
                ).data,
                "predictions": predictions_data,
                "total_points": total_points,
                "current_rank": current_rank,
            }
        )

    def _get_group_summaries(self, user, tournament_id, groups):
        from predictions.services.leaderboard import (
            build_podium_from_leaderboard,
            get_cached_group_leaderboard,
        )

        summaries = []
        for group in groups:
            leaderboard = get_cached_group_leaderboard(group, tournament_id)
            member_ids = [row["user_id"] for row in leaderboard]

            user_row = next(
                (entry for entry in leaderboard if entry["user_id"] == user.id), None
            )
            rank = user_row["rank"] if user_row else None
            points = user_row["total_points"] if user_row else 0
            leader_points = leaderboard[0]["total_points"] if leaderboard else 0

            summaries.append(
                {
                    "id": group.id,
                    "name": group.name,
                    "icon": group.icon,
                    "invite_code": group.invite_code,
                    "member_count": len(member_ids),
                    "rank": rank,
                    "total_points": points,
                    "leader_points": leader_points,
                    "podium": build_podium_from_leaderboard(leaderboard, user.id),
                }
            )
        return summaries
