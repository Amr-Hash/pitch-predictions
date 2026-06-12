from groups.models import GroupMember
from notifications.models import Notification
from predictions.services.leaderboard import (
    capture_tournament_podiums,
    global_rank_map,
    group_rank_map,
    tournament_groups_with_members,
)
from tournaments.models import Match


def _match_result_payload(match, prediction, points_awarded, before_global, after_global, group_rank_changes):
    return {
        "match_id": match.id,
        "tournament_id": match.tournament_id,
        "home_team": match.home_team.name,
        "away_team": match.away_team.name,
        "home_team_ar": getattr(match.home_team, "name_ar", None) or "",
        "away_team_ar": getattr(match.away_team, "name_ar", None) or "",
        "home_score": match.home_score,
        "away_score": match.away_score,
        "predicted_home_score": prediction.predicted_home_score,
        "predicted_away_score": prediction.predicted_away_score,
        "points_awarded": points_awarded,
        "global_rank": after_global.get(prediction.user_id),
        "previous_global_rank": before_global.get(prediction.user_id),
        "groups": group_rank_changes,
    }


def _group_rank_changes_for_user(user_id, before_group_ranks, after_group_ranks, groups):
    changes = []
    for group in groups:
        if not GroupMember.objects.filter(group=group, user_id=user_id).exists():
            continue
        after_rank = after_group_ranks.get((group.id, user_id))
        before_rank = before_group_ranks.get((group.id, user_id))
        changes.append(
            {
                "group_id": group.id,
                "group_name": group.name,
                "rank": after_rank,
                "previous_rank": before_rank,
            }
        )
    return changes


def _upsert_notification(user_id, notification_type, dedup_key, payload, mark_unread=False):
    defaults = {
        "notification_type": notification_type,
        "payload": payload,
    }
    if mark_unread:
        defaults["is_read"] = False
    notification, created = Notification.objects.update_or_create(
        user_id=user_id,
        dedup_key=dedup_key,
        defaults=defaults,
    )
    return notification, created


def process_match_scoring_notifications(
    match,
    scoring_results,
    before_podiums,
    before_global_ranks,
    before_group_ranks,
):
    if match.status != Match.Status.FINISHED:
        return

    tournament_id = match.tournament_id
    after_global_ranks = global_rank_map(tournament_id)
    groups = list(tournament_groups_with_members(tournament_id))
    after_group_ranks = {}
    for group in groups:
        for uid, rank in group_rank_map(group, tournament_id).items():
            after_group_ranks[(group.id, uid)] = rank

    from predictions.models import Prediction

    predictions_by_user = {
        row.user_id: row
        for row in Prediction.objects.filter(match=match).select_related("user")
    }

    for result in scoring_results:
        user_id = result["user_id"]
        prediction = predictions_by_user.get(user_id)
        if not prediction:
            continue
        group_changes = _group_rank_changes_for_user(
            user_id, before_group_ranks, after_group_ranks, groups
        )
        payload = _match_result_payload(
            match,
            prediction,
            result["points_awarded"],
            before_global_ranks,
            after_global_ranks,
            group_changes,
        )
        _upsert_notification(
            user_id,
            Notification.Type.MATCH_RESULT,
            f"match_result:{match.id}",
            payload,
            mark_unread=True,
        )

    after_podiums = capture_tournament_podiums(tournament_id)
    for group_id, after_data in after_podiums.items():
        before_data = before_podiums.get(group_id, {})
        before_sig = before_data.get("signature", ())
        after_sig = after_data.get("signature", ())
        if before_sig == after_sig:
            continue

        podium_payload = {
            "group_id": group_id,
            "group_name": after_data["group_name"],
            "tournament_id": tournament_id,
            "match_id": match.id,
            "podium": [
                {
                    "rank": row["rank"],
                    "user_id": row["user_id"],
                    "username": row["username"],
                    "total_points": row["total_points"],
                }
                for row in after_data.get("podium", [])
            ],
        }
        member_ids = GroupMember.objects.filter(group_id=group_id).values_list(
            "user_id", flat=True
        )
        dedup_key = f"group_podium:{group_id}:{match.id}"
        for member_id in member_ids:
            _upsert_notification(
                member_id,
                Notification.Type.GROUP_PODIUM,
                dedup_key,
                podium_payload,
                mark_unread=True,
            )
