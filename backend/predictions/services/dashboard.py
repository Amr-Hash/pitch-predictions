from django.db.models import Q
from django.utils import timezone

from predictions.models import Prediction
from tournaments.models import Match


def _base_matches_qs(tournament_id):
    qs = Match.objects.select_related("home_team", "away_team", "stage", "cup_group")
    if tournament_id:
        qs = qs.filter(tournament_id=tournament_id)
    return qs


def get_upcoming_matches(tournament_id, *, limit=20):
    now = timezone.now()
    return list(
        _base_matches_qs(tournament_id)
        .exclude(status=Match.Status.FINISHED)
        .filter(kickoff_time__gt=now)
        .order_by("kickoff_time")[:limit]
    )


def get_live_matches(tournament_id, *, limit=10):
    now = timezone.now()
    return (
        _base_matches_qs(tournament_id)
        .exclude(status=Match.Status.FINISHED)
        .filter(Q(status=Match.Status.LIVE) | Q(kickoff_time__lte=now))
        .order_by("-kickoff_time")[:limit]
    )


def get_recent_results(tournament_id, *, limit=10):
    qs = Match.objects.filter(status=Match.Status.FINISHED).select_related(
        "home_team", "away_team", "stage"
    )
    if tournament_id:
        qs = qs.filter(tournament_id=tournament_id)
    return qs.order_by("-kickoff_time")[:limit]


def _predicted_match_ids(user, tournament_id):
    predictions_qs = Prediction.objects.filter(user=user)
    if tournament_id:
        predictions_qs = predictions_qs.filter(match__tournament_id=tournament_id)
    return set(predictions_qs.values_list("match_id", flat=True))


def get_pending_matches(user, tournament_id):
    predicted_match_ids = _predicted_match_ids(user, tournament_id)
    candidates = (
        _base_matches_qs(tournament_id)
        .exclude(status=Match.Status.FINISHED)
        .order_by("kickoff_time")
    )
    return [
        match
        for match in candidates
        if match.id not in predicted_match_ids and not match.is_locked
    ]


def count_pending_predictions(user, tournament_id):
    return len(get_pending_matches(user, tournament_id))
