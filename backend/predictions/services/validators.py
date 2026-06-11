from rest_framework.exceptions import ValidationError

from tournaments.models import Match, Stage


def validate_prediction_lock(match):
    if match.status == Match.Status.FINISHED:
        raise ValidationError(
            {"detail": "This match has finished. Predictions can no longer be changed."}
        )
    if match.is_locked:
        message = match.lock_reason or "Prediction window has closed for this match."
        raise ValidationError({"detail": message})


def validate_stage_progression(user, match):
    if match.stage.stage_type == Stage.StageType.GROUP:
        return

    stage = match.stage
    previous_stage = (
        Stage.objects.filter(
            tournament=stage.tournament,
            order__lt=stage.order,
        )
        .order_by("-order")
        .first()
    )
    if not previous_stage:
        return

    from predictions.models import Prediction

    previous_match_ids = list(previous_stage.matches.values_list("id", flat=True))
    predicted_count = Prediction.objects.filter(
        user=user,
        match_id__in=previous_match_ids,
    ).count()

    if predicted_count < len(previous_match_ids):
        raise ValidationError(
            {
                "detail": "You must complete predictions for the previous stage before continuing."
            }
        )


def validate_knockout_winner(match, predicted_home, predicted_away, predicted_winner):
    if match.is_knockout and predicted_home == predicted_away and not predicted_winner:
        raise ValidationError(
            {"predicted_winner_team_id": "Please select the team that advances."}
        )
