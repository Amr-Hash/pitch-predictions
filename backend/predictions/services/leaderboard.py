from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum

from groups.models import Group, GroupMember
from predictions.models import Prediction

User = get_user_model()


def _predictions_for_tournament(tournament_id):
    qs = Prediction.objects.all()
    if tournament_id:
        qs = qs.filter(match__tournament_id=tournament_id)
    return qs


def global_rank_map(tournament_id):
    stats = list(
        _predictions_for_tournament(tournament_id)
        .values("user_id")
        .annotate(
            total_points=Sum("points_awarded"),
            exact_predictions=Count("id", filter=Q(points_awarded__gte=5)),
            correct_outcomes=Count("id", filter=Q(points_awarded__gte=1)),
        )
        .order_by("-total_points", "-exact_predictions", "-correct_outcomes")
    )
    return {
        entry["user_id"]: index
        for index, entry in enumerate(stats, start=1)
    }


def build_group_leaderboard(group, tournament_id):
    member_ids = list(
        GroupMember.objects.filter(group=group).values_list("user_id", flat=True)
    )
    predictions_qs = _predictions_for_tournament(tournament_id).filter(
        user_id__in=member_ids
    )
    users = User.objects.in_bulk(member_ids)
    rows = []
    for member_id in member_ids:
        user_preds = predictions_qs.filter(user_id=member_id)
        total = user_preds.aggregate(total=Sum("points_awarded"))["total"] or 0
        exact = user_preds.filter(points_awarded__gte=5).count()
        outcomes = user_preds.filter(points_awarded__gte=1).count()
        member = users.get(member_id)
        rows.append(
            {
                "user_id": member_id,
                "username": member.username if member else "?",
                "total_points": total,
                "exact_predictions": exact,
                "correct_outcomes": outcomes,
            }
        )
    rows.sort(
        key=lambda row: (
            -row["total_points"],
            -row["exact_predictions"],
            -row["correct_outcomes"],
            row["username"].lower(),
        )
    )
    for index, row in enumerate(rows, start=1):
        row["rank"] = index
    return rows


def group_podium_signature(leaderboard):
    """Top-3 identity + points used to detect podium changes."""
    return tuple(
        (row["user_id"], row["total_points"], row["rank"])
        for row in leaderboard[:3]
    )


def tournament_groups_with_members(tournament_id):
    return (
        Group.objects.filter(memberships__isnull=False)
        .distinct()
        .prefetch_related("memberships")
    )


def group_rank_map(group, tournament_id):
    return {row["user_id"]: row["rank"] for row in build_group_leaderboard(group, tournament_id)}


def capture_tournament_podiums(tournament_id):
    podiums = {}
    for group in tournament_groups_with_members(tournament_id):
        leaderboard = build_group_leaderboard(group, tournament_id)
        podiums[group.id] = {
            "group_id": group.id,
            "group_name": group.name,
            "signature": group_podium_signature(leaderboard),
            "podium": leaderboard[:3],
        }
    return podiums
