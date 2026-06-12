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


def assign_competition_ranks(rows, points_key="total_points"):
    """
    Users with the same points share a rank (1, 1, 3 …).
    Display order within a tie is alphabetical by username only — not a separate rank.
    """
    rows.sort(key=lambda row: (-row[points_key], row.get("username", "").lower()))
    rank = 0
    position = 0
    prev_points = object()
    for row in rows:
        position += 1
        points = row[points_key]
        if points != prev_points:
            rank = position
            prev_points = points
        row["rank"] = rank
    return rows


def build_podium_from_leaderboard(leaderboard, user_id=None):
    """All players at ranks 1, 2, and 3 (supports multiple users per rank)."""
    entries = []
    for podium_rank in (1, 2, 3):
        for row in leaderboard:
            if row["rank"] != podium_rank:
                continue
            entry = {
                "rank": podium_rank,
                "user_id": row["user_id"],
                "username": row["username"],
                "total_points": row["total_points"],
            }
            if user_id is not None:
                entry["is_you"] = row["user_id"] == user_id
            entries.append(entry)
    return entries


def build_global_leaderboard(tournament_id):
    stats = list(
        _predictions_for_tournament(tournament_id)
        .values("user_id", "user__username")
        .annotate(
            total_points=Sum("points_awarded"),
            exact_predictions=Count("id", filter=Q(points_awarded__gte=5)),
            correct_outcomes=Count("id", filter=Q(points_awarded__gte=1)),
        )
    )
    rows = []
    for entry in stats:
        rows.append(
            {
                "user_id": entry["user_id"],
                "username": entry["user__username"],
                "total_points": entry["total_points"] or 0,
                "exact_predictions": entry["exact_predictions"],
                "correct_outcomes": entry["correct_outcomes"],
            }
        )
    assign_competition_ranks(rows)
    return rows


def global_rank_map(tournament_id):
    return {
        entry["user_id"]: entry["rank"]
        for entry in build_global_leaderboard(tournament_id)
    }


def global_podium_for_user(tournament_id, user_id):
    return build_podium_from_leaderboard(
        build_global_leaderboard(tournament_id), user_id=user_id
    )


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
    assign_competition_ranks(rows)
    return rows


def group_podium_signature(leaderboard):
    """Podium slots 1–3: who holds each rank (supports ties)."""
    slots = []
    for podium_rank in (1, 2, 3):
        members = tuple(
            sorted(
                (row["user_id"], row["total_points"])
                for row in leaderboard
                if row["rank"] == podium_rank
            )
        )
        slots.append((podium_rank, members))
    return tuple(slots)


def tournament_groups_with_members(tournament_id):
    return (
        Group.objects.filter(memberships__isnull=False)
        .distinct()
        .prefetch_related("memberships")
    )


def group_rank_map(group, tournament_id):
    return {
        row["user_id"]: row["rank"]
        for row in build_group_leaderboard(group, tournament_id)
    }


def capture_tournament_podiums(tournament_id):
    podiums = {}
    for group in tournament_groups_with_members(tournament_id):
        leaderboard = build_group_leaderboard(group, tournament_id)
        podiums[group.id] = {
            "group_id": group.id,
            "group_name": group.name,
            "signature": group_podium_signature(leaderboard),
            "podium": build_podium_from_leaderboard(leaderboard),
        }
    return podiums
