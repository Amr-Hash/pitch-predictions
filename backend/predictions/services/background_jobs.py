import logging

from predictions.models import BackgroundJob

logger = logging.getLogger(__name__)


def _serialize_before_state(before_podiums, before_global_ranks, before_group_ranks):
    podiums_json = {}
    for group_id, data in before_podiums.items():
        podiums_json[str(group_id)] = {
            "group_id": data["group_id"],
            "group_name": data["group_name"],
            "signature": [
                [rank, list(members)]
                for rank, members in data.get("signature", ())
            ],
            "podium": data.get("podium", []),
        }
    return {
        "podiums": podiums_json,
        "global_ranks": {str(user_id): rank for user_id, rank in before_global_ranks.items()},
        "group_ranks": {
            f"{group_id}:{user_id}": rank
            for (group_id, user_id), rank in before_group_ranks.items()
        },
    }


def _deserialize_before_state(state):
    podiums = {}
    for group_id, data in state["podiums"].items():
        podiums[int(group_id)] = {
            "group_id": data["group_id"],
            "group_name": data["group_name"],
            "signature": tuple(
                (rank, tuple(members))
                for rank, members in data.get("signature", [])
            ),
            "podium": data.get("podium", []),
        }
    global_ranks = {
        int(user_id): rank for user_id, rank in state["global_ranks"].items()
    }
    group_ranks = {}
    for key, rank in state["group_ranks"].items():
        group_id_str, user_id_str = key.split(":", 1)
        group_ranks[(int(group_id_str), int(user_id_str))] = rank
    return podiums, global_ranks, group_ranks


def enqueue_scoring_notifications_job(match_id, tournament_id, *, before_state):
    existing = BackgroundJob.objects.filter(
        status=BackgroundJob.Status.PENDING,
        job_type=BackgroundJob.JobType.PROCESS_SCORING_NOTIFICATIONS,
        payload__match_id=match_id,
    ).first()
    if existing:
        return existing
    return BackgroundJob.objects.create(
        job_type=BackgroundJob.JobType.PROCESS_SCORING_NOTIFICATIONS,
        payload={
            "match_id": match_id,
            "tournament_id": tournament_id,
            "before_state": before_state,
        },
    )


def process_scoring_notifications_job(payload):
    from predictions.services.notifications import process_match_scoring_notifications
    from tournaments.models import Match

    match_id = payload["match_id"]
    before_state = payload["before_state"]

    match = Match.objects.select_related(
        "stage", "home_team", "away_team", "winner_team", "tournament"
    ).get(pk=match_id)

    from predictions.models import Prediction

    results = []
    for prediction in Prediction.objects.filter(match=match).select_related("user"):
        results.append(
            {
                "prediction_id": prediction.id,
                "user_id": prediction.user_id,
                "username": prediction.user.username,
                "predicted_score": (
                    f"{prediction.predicted_home_score}-{prediction.predicted_away_score}"
                ),
                "predicted_advancing_team_id": prediction.predicted_winner_team_id,
                "points_awarded": prediction.points_awarded,
            }
        )

    group_ranks = {}
    before_podiums, before_global_ranks, group_ranks = _deserialize_before_state(
        before_state
    )

    process_match_scoring_notifications(
        match,
        results,
        before_podiums,
        before_global_ranks,
        group_ranks,
    )


def _process_job(job):
    if job.job_type == BackgroundJob.JobType.PROCESS_SCORING_NOTIFICATIONS:
        process_scoring_notifications_job(job.payload)
        return
    raise ValueError(f"Unknown job type: {job.job_type}")


def process_pending_background_jobs(*, limit=50):
    processed = 0
    failed = 0
    jobs = list(
        BackgroundJob.objects.filter(status=BackgroundJob.Status.PENDING)
        .order_by("created_at")[:limit]
    )
    for job in jobs:
        updated = BackgroundJob.objects.filter(
            pk=job.pk, status=BackgroundJob.Status.PENDING
        ).update(status=BackgroundJob.Status.PROCESSING)
        if not updated:
            continue
        job.refresh_from_db()
        try:
            _process_job(job)
        except Exception as exc:
            logger.exception("Background job %s failed", job.id)
            job.status = BackgroundJob.Status.FAILED
            job.error_message = str(exc)
            job.save(update_fields=["status", "error_message", "updated_at"])
            failed += 1
            continue
        job.status = BackgroundJob.Status.COMPLETED
        job.save(update_fields=["status", "updated_at"])
        processed += 1

    return {"processed": processed, "failed": failed}


def run_background_jobs_inline():
    from django.conf import settings

    if getattr(settings, "BACKGROUND_JOBS_SYNC", False):
        return process_pending_background_jobs(limit=50)
    return {"processed": 0, "failed": 0}
