GLOBAL_LEADERBOARD_TTL = 60
GROUP_LEADERBOARD_TTL = 60


def global_leaderboard_key(tournament_id):
    return f"leaderboard:global:{tournament_id or 'all'}"


def group_leaderboard_key(group_id, tournament_id):
    return f"leaderboard:group:{group_id}:{tournament_id or 'all'}"


def invalidate_tournament_leaderboard_cache(tournament_id):
    from django.core.cache import cache

    from groups.models import GroupMember
    from predictions.models import Prediction

    cache.delete(global_leaderboard_key(tournament_id))
    user_ids = Prediction.objects.filter(
        match__tournament_id=tournament_id
    ).values_list("user_id", flat=True).distinct()
    group_ids = GroupMember.objects.filter(user_id__in=user_ids).values_list(
        "group_id", flat=True
    ).distinct()
    keys = [group_leaderboard_key(group_id, tournament_id) for group_id in group_ids]
    if keys:
        cache.delete_many(keys)
