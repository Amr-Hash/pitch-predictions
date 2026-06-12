from rest_framework.exceptions import ValidationError

from tournaments.models import Match


def validate_prediction_lock(match):
    if match.status == Match.Status.FINISHED:
        raise ValidationError(
            {"detail": "This match has finished. Predictions can no longer be changed."}
        )
    if match.is_locked:
        message = match.lock_reason or "Prediction window has closed for this match."
        raise ValidationError({"detail": message})


def validate_knockout_winner(match, predicted_home, predicted_away, predicted_winner):
    if match.is_knockout and predicted_home == predicted_away and not predicted_winner:
        raise ValidationError(
            {"predicted_winner_team_id": "Please select the team that advances."}
        )
