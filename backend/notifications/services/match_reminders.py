from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from notifications.models import KickoffReminderSent, Notification, PushSubscription
from notifications.services.push import push_configured, send_push_to_user
from predictions.models import Prediction
from tournaments.models import Match, TournamentSubscription

User = get_user_model()

REMINDER_BEFORE = timedelta(hours=1)


def _reminder_payload(match: Match, prediction: Prediction | None) -> dict:
    payload = {
        "match_id": match.id,
        "tournament_id": match.tournament_id,
        "home_team": match.home_team.name,
        "away_team": match.away_team.name,
        "home_team_ar": getattr(match.home_team, "name_ar", None) or "",
        "away_team_ar": getattr(match.away_team, "name_ar", None) or "",
        "kickoff_time": match.kickoff_time.isoformat(),
        "has_prediction": prediction is not None,
        "predicted_home_score": None,
        "predicted_away_score": None,
        "predicted_winner_team_id": None,
        "predicted_winner_name": "",
        "predicted_winner_name_ar": "",
    }
    if prediction:
        payload["predicted_home_score"] = prediction.predicted_home_score
        payload["predicted_away_score"] = prediction.predicted_away_score
        if prediction.predicted_winner_team_id:
            winner = prediction.predicted_winner_team
            payload["predicted_winner_team_id"] = prediction.predicted_winner_team_id
            payload["predicted_winner_name"] = winner.name if winner else ""
            payload["predicted_winner_name_ar"] = (
                getattr(winner, "name_ar", None) or "" if winner else ""
            )
    return payload


def _push_copy(match: Match, prediction: Prediction | None) -> tuple[str, str]:
    home = match.home_team.name
    away = match.away_team.name
    if prediction:
        pick = f"{prediction.predicted_home_score}-{prediction.predicted_away_score}"
        title = f"{home} vs {away} in 1 hour"
        body = f"Kickoff soon. Your pick: {pick}. Tap to review or change it."
    else:
        title = f"{home} vs {away} in 1 hour"
        body = "Kickoff soon. You have not submitted a prediction yet."
    return title, body


def send_match_kickoff_reminders() -> dict:
    """
    Notify tournament subscribers ~1 hour before kickoff.
    Always creates an in-app notification; also sends Web Push when VAPID is
    configured and the user has a browser push subscription.
    """
    now = timezone.now()
    reminder_deadline = now + REMINDER_BEFORE

    matches = list(
        Match.objects.filter(
            status=Match.Status.SCHEDULED,
            kickoff_time__gt=now,
            kickoff_time__lte=reminder_deadline,
            tournament__is_active=True,
            tournament__is_archived=False,
        ).select_related("home_team", "away_team", "tournament")
    )
    if not matches:
        return {
            "enabled": True,
            "push_enabled": push_configured(),
            "matches": 0,
            "eligible_users": 0,
            "in_app_created": 0,
            "push_sent": 0,
        }

    match_ids = [match.id for match in matches]
    predictions = Prediction.objects.filter(match_id__in=match_ids).select_related(
        "predicted_winner_team"
    )
    prediction_by_user_match = {
        (row.user_id, row.match_id): row for row in predictions
    }

    push_enabled = push_configured()
    in_app_created = 0
    push_sent = 0
    eligible_users = 0
    for match in matches:
        subscribed_user_ids = set(
            TournamentSubscription.objects.filter(
                tournament_id=match.tournament_id
            ).values_list("user_id", flat=True)
        )
        if not subscribed_user_ids:
            continue

        already_sent = set(
            KickoffReminderSent.objects.filter(
                match_id=match.id, user_id__in=subscribed_user_ids
            ).values_list("user_id", flat=True)
        )
        users = User.objects.filter(
            id__in=subscribed_user_ids - already_sent,
            is_active=True,
            is_staff=False,
        )
        push_user_ids = set(
            PushSubscription.objects.filter(user_id__in=subscribed_user_ids).values_list(
                "user_id", flat=True
            )
        )
        dedup_key = f"match_kickoff_reminder:{match.id}"
        match_url = f"/matches/{match.id}"

        for user in users:
            eligible_users += 1
            prediction = prediction_by_user_match.get((user.id, match.id))
            payload = _reminder_payload(match, prediction)
            _notification, was_created = Notification.objects.get_or_create(
                user_id=user.id,
                dedup_key=dedup_key,
                defaults={
                    "notification_type": Notification.Type.MATCH_KICKOFF_REMINDER,
                    "payload": payload,
                    "is_read": False,
                },
            )
            if was_created:
                in_app_created += 1

            if push_enabled and user.id in push_user_ids:
                title, body = _push_copy(match, prediction)
                push_sent += send_push_to_user(
                    user.id,
                    title=title,
                    body=body,
                    url=match_url,
                )

            KickoffReminderSent.objects.get_or_create(user_id=user.id, match_id=match.id)

    return {
        "enabled": True,
        "push_enabled": push_enabled,
        "matches": len(matches),
        "eligible_users": eligible_users,
        "in_app_created": in_app_created,
        "push_sent": push_sent,
    }
