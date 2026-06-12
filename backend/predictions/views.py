from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from groups.models import Group, GroupMember
from tournaments.models import Match

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

        from predictions.services.leaderboard import build_group_leaderboard

        tournament_id = request.query_params.get("tournament")
        return Response(build_group_leaderboard(group, tournament_id))


class GlobalLeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from predictions.services.leaderboard import build_global_leaderboard

        tournament_id = request.query_params.get("tournament")
        return Response(build_global_leaderboard(tournament_id))


class DashboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        tournament_id = request.query_params.get("tournament")

        groups = Group.objects.filter(memberships__user=user).distinct()
        groups_data = self._get_group_summaries(user, tournament_id, groups)

        base_matches_qs = Match.objects.select_related(
            "home_team", "away_team", "stage", "cup_group"
        )
        if tournament_id:
            base_matches_qs = base_matches_qs.filter(tournament_id=tournament_id)

        now = timezone.now()
        upcoming = (
            base_matches_qs.exclude(status=Match.Status.FINISHED)
            .filter(kickoff_time__gt=now)
            .order_by("kickoff_time")[:10]
        )
        live_matches = (
            base_matches_qs.exclude(status=Match.Status.FINISHED)
            .filter(Q(status=Match.Status.LIVE) | Q(kickoff_time__lte=now))
            .order_by("-kickoff_time")[:10]
        )
        next_match = (
            base_matches_qs.exclude(status=Match.Status.FINISHED)
            .filter(kickoff_time__gt=now)
            .order_by("kickoff_time")
            .first()
        )

        predictions_qs = Prediction.objects.filter(user=user)
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

        pending_slice = pending[:10]
        serializer_context = {"request": request}

        from predictions.services.leaderboard import (
            build_global_leaderboard,
            global_podium_for_user,
            global_rank_map,
        )

        global_leaderboard = build_global_leaderboard(tournament_id)
        global_leader_points = (
            global_leaderboard[0]["total_points"] if global_leaderboard else 0
        )

        return Response(
            {
                "groups": groups_data,
                "global_podium": global_podium_for_user(tournament_id, user.id),
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
                    pending_slice, many=True, context=serializer_context
                ).data,
                "pending_count": len(pending),
                "recent_results": MatchSerializer(
                    recent_results, many=True, context=serializer_context
                ).data,
                "total_points": total_points,
                "current_rank": global_rank_map(tournament_id).get(user.id),
            }
        )

    def _get_group_summaries(self, user, tournament_id, groups):
        from predictions.services.leaderboard import (
            build_group_leaderboard,
            build_podium_from_leaderboard,
        )

        summaries = []
        for group in groups:
            leaderboard = build_group_leaderboard(group, tournament_id)
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
                    "invite_code": group.invite_code,
                    "member_count": len(member_ids),
                    "rank": rank,
                    "total_points": points,
                    "leader_points": leader_points,
                    "podium": build_podium_from_leaderboard(leaderboard, user.id),
                }
            )
        return summaries
