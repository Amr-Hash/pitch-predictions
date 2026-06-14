from notifications.models import Notification


def _rank_changed(rank, previous):
    if rank is None:
        return False
    if previous is None:
        return True
    return rank != previous


def notification_action_url(notification_type: str, payload: dict) -> str:
    if notification_type == Notification.Type.MATCH_KICKOFF_REMINDER:
        match_id = payload.get("match_id")
        return f"/matches/{match_id}" if match_id else "/dashboard"

    if notification_type == Notification.Type.GROUP_PODIUM:
        group_id = payload.get("group_id")
        return f"/leaderboards?group={group_id}" if group_id else "/leaderboards"

    if notification_type == Notification.Type.MATCH_RESULT:
        if _rank_changed(payload.get("global_rank"), payload.get("previous_global_rank")):
            return "/leaderboards"
        for group in payload.get("groups") or []:
            if _rank_changed(group.get("rank"), group.get("previous_rank")):
                group_id = group.get("group_id")
                if group_id:
                    return f"/leaderboards?group={group_id}"
        match_id = payload.get("match_id")
        return f"/matches/{match_id}" if match_id else "/dashboard"

    return "/dashboard"
