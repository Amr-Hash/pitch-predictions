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
    Users with the same points share a rank; the next distinct score gets the next
    rank (1, 1, 2 …). Order within a tie is alphabetical by username only.
    """
    rows.sort(key=lambda row: (-row[points_key], row.get("username", "").lower()))
    rank = 0
    prev_points = object()
    for row in rows:
        points = row[points_key]
        if points != prev_points:
            rank += 1
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


def _compute_global_leaderboard_rows(tournament_id):
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


def build_global_leaderboard(tournament_id):
    from predictions.models import GlobalLeaderboardEntry

    tournament_filter = {"tournament_id": tournament_id} if tournament_id else {"tournament__isnull": True}
    stored = list(
        GlobalLeaderboardEntry.objects.filter(**tournament_filter)
        .select_related("user")
        .order_by("rank", "user__username")
    )
    if stored:
        return [
            {
                "user_id": entry.user_id,
                "username": entry.user.username,
                "total_points": entry.total_points,
                "exact_predictions": entry.exact_predictions,
                "correct_outcomes": entry.correct_outcomes,
                "rank": entry.rank,
            }
            for entry in stored
        ]

    rows = _compute_global_leaderboard_rows(tournament_id)
    rebuild_global_leaderboard_entries(tournament_id, rows)
    return rows


def rebuild_global_leaderboard_entries(tournament_id, rows=None):
    from predictions.models import GlobalLeaderboardEntry

    if rows is None:
        rows = _compute_global_leaderboard_rows(tournament_id)

    if tournament_id:
        GlobalLeaderboardEntry.objects.filter(tournament_id=tournament_id).delete()
    else:
        GlobalLeaderboardEntry.objects.filter(tournament__isnull=True).delete()

    GlobalLeaderboardEntry.objects.bulk_create(
        [
            GlobalLeaderboardEntry(
                tournament_id=tournament_id,
                user_id=row["user_id"],
                total_points=row["total_points"],
                exact_predictions=row["exact_predictions"],
                correct_outcomes=row["correct_outcomes"],
                rank=row["rank"],
            )
            for row in rows
        ]
    )
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


def _compute_group_leaderboard_rows(group, tournament_id):
    member_ids = list(
        GroupMember.objects.filter(group=group).values_list("user_id", flat=True)
    )
    if not member_ids:
        return []

    predictions_qs = _predictions_for_tournament(tournament_id).filter(
        user_id__in=member_ids
    )
    stats = {
        entry["user_id"]: entry
        for entry in predictions_qs.values("user_id")
        .annotate(
            total_points=Sum("points_awarded"),
            exact_predictions=Count("id", filter=Q(points_awarded__gte=5)),
            correct_outcomes=Count("id", filter=Q(points_awarded__gte=1)),
        )
    }
    users = User.objects.in_bulk(member_ids)
    rows = []
    for member_id in member_ids:
        entry = stats.get(member_id)
        member = users.get(member_id)
        rows.append(
            {
                "user_id": member_id,
                "username": member.username if member else "?",
                "total_points": (entry["total_points"] if entry else 0) or 0,
                "exact_predictions": entry["exact_predictions"] if entry else 0,
                "correct_outcomes": entry["correct_outcomes"] if entry else 0,
            }
        )
    assign_competition_ranks(rows)
    return rows


def build_group_leaderboard(group, tournament_id):
    from predictions.models import GroupLeaderboardEntry

    tournament_filter = {"tournament_id": tournament_id} if tournament_id else {"tournament__isnull": True}
    stored = list(
        GroupLeaderboardEntry.objects.filter(group=group, **tournament_filter)
        .select_related("user")
        .order_by("rank", "user__username")
    )
    if stored:
        member_order = list(
            GroupMember.objects.filter(group=group).values_list("user_id", flat=True)
        )
        by_user = {entry.user_id: entry for entry in stored}
        rows = []
        for member_id in member_order:
            entry = by_user.get(member_id)
            if not entry:
                member = User.objects.filter(pk=member_id).first()
                rows.append(
                    {
                        "user_id": member_id,
                        "username": member.username if member else "?",
                        "total_points": 0,
                        "exact_predictions": 0,
                        "correct_outcomes": 0,
                        "rank": len(member_order),
                    }
                )
                continue
            rows.append(
                {
                    "user_id": entry.user_id,
                    "username": entry.user.username,
                    "total_points": entry.total_points,
                    "exact_predictions": entry.exact_predictions,
                    "correct_outcomes": entry.correct_outcomes,
                    "rank": entry.rank,
                }
            )
        return rows

    rows = _compute_group_leaderboard_rows(group, tournament_id)
    rebuild_group_leaderboard_entries(group, tournament_id, rows)
    return rows


def rebuild_group_leaderboard_entries(group, tournament_id, rows=None):
    from predictions.models import GroupLeaderboardEntry

    if rows is None:
        rows = _compute_group_leaderboard_rows(group, tournament_id)

    if tournament_id:
        GroupLeaderboardEntry.objects.filter(
            group=group, tournament_id=tournament_id
        ).delete()
    else:
        GroupLeaderboardEntry.objects.filter(
            group=group, tournament__isnull=True
        ).delete()

    GroupLeaderboardEntry.objects.bulk_create(
        [
            GroupLeaderboardEntry(
                group=group,
                tournament_id=tournament_id,
                user_id=row["user_id"],
                total_points=row["total_points"],
                exact_predictions=row["exact_predictions"],
                correct_outcomes=row["correct_outcomes"],
                rank=row["rank"],
            )
            for row in rows
        ]
    )
    return rows


def rebuild_tournament_leaderboards(tournament_id):
    rebuild_global_leaderboard_entries(tournament_id)
    for group in tournament_groups_with_members(tournament_id):
        rebuild_group_leaderboard_entries(group, tournament_id)


def get_cached_global_leaderboard(tournament_id):
    from django.core.cache import cache

    from predictions.services.cache_keys import (
        GLOBAL_LEADERBOARD_TTL,
        global_leaderboard_key,
    )

    key = global_leaderboard_key(tournament_id)
    cached = cache.get(key)
    if cached is not None:
        return cached
    rows = build_global_leaderboard(tournament_id)
    cache.set(key, rows, GLOBAL_LEADERBOARD_TTL)
    return rows


def get_cached_group_leaderboard(group, tournament_id):
    from django.core.cache import cache

    from predictions.services.cache_keys import (
        GROUP_LEADERBOARD_TTL,
        group_leaderboard_key,
    )

    key = group_leaderboard_key(group.id, tournament_id)
    cached = cache.get(key)
    if cached is not None:
        return cached
    rows = build_group_leaderboard(group, tournament_id)
    cache.set(key, rows, GROUP_LEADERBOARD_TTL)
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
