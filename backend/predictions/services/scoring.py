from dataclasses import dataclass

from tournaments.models import Match, Stage


@dataclass
class ScoreBreakdown:
    exact_score_points: int = 0
    goal_difference_points: int = 0
    outcome_points: int = 0
    winner_bonus_points: int = 0

    @property
    def total_points(self):
        base = max(
            self.exact_score_points,
            self.goal_difference_points,
            self.outcome_points,
        )
        return base + self.winner_bonus_points


def _get_outcome(home_score, away_score):
    if home_score > away_score:
        return "home"
    if away_score > home_score:
        return "away"
    return "draw"


def _get_advancing_team_id(match):
    """Team that advances from a finished knockout match."""
    if match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.home_team_id
    if match.away_score > match.home_score:
        return match.away_team_id
    # Tied after extra time — advancement is decided by penalties.
    return match.winner_team_id


def calculate_prediction_points(prediction, match):
    """
    Calculate points for a prediction against a finished match.
    Only one of exact score, goal difference, or outcome is awarded.

    Knockout draws (level after 90/extra time): if the user predicted a tie,
    points depend on the advancing-team pick — 5 if correct, 3 if wrong — even
    when the exact score was right. Otherwise a correct advancing pick on a
    non-draw prediction earns +1 on top of score points.
    """
    breakdown = ScoreBreakdown()

    if match.status != Match.Status.FINISHED:
        return breakdown

    if match.home_score is None or match.away_score is None:
        return breakdown

    pred_home = prediction.predicted_home_score
    pred_away = prediction.predicted_away_score
    actual_home = match.home_score
    actual_away = match.away_score
    is_knockout = match.stage.stage_type == Stage.StageType.KNOCKOUT
    actual_draw = actual_home == actual_away
    pred_draw = pred_home == pred_away

    if is_knockout and actual_draw and pred_draw:
        advancing_team_id = _get_advancing_team_id(match)
        if advancing_team_id and prediction.predicted_winner_team_id:
            if prediction.predicted_winner_team_id == advancing_team_id:
                breakdown.exact_score_points = 5
            else:
                breakdown.goal_difference_points = 3
            return breakdown

    if pred_home == actual_home and pred_away == actual_away:
        breakdown.exact_score_points = 5
    elif (pred_home - pred_away) == (actual_home - actual_away):
        breakdown.goal_difference_points = 3
    elif _get_outcome(pred_home, pred_away) == _get_outcome(actual_home, actual_away):
        breakdown.outcome_points = 1

    if is_knockout and not pred_draw:
        advancing_team_id = _get_advancing_team_id(match)
        if (
            prediction.predicted_winner_team_id
            and advancing_team_id
            and prediction.predicted_winner_team_id == advancing_team_id
        ):
            breakdown.winner_bonus_points = 1

    return breakdown


def recalculate_match_scores(match):
    from predictions.models import Prediction

    match = Match.objects.select_related(
        "stage", "home_team", "away_team", "winner_team"
    ).get(pk=match.pk)
    predictions = Prediction.objects.filter(match=match).select_related(
        "user", "predicted_winner_team"
    )
    results = []
    for prediction in predictions:
        breakdown = calculate_prediction_points(prediction, match)
        prediction.points_awarded = breakdown.total_points
        prediction.save(update_fields=["points_awarded"])
        results.append(
            {
                "prediction_id": prediction.id,
                "user_id": prediction.user_id,
                "username": prediction.user.username,
                "predicted_score": f"{prediction.predicted_home_score}-{prediction.predicted_away_score}",
                "predicted_advancing_team_id": prediction.predicted_winner_team_id,
                "points_awarded": breakdown.total_points,
            }
        )
    return results
