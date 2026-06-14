"""
Live score ingestion for tournaments.

Providers:
- manual: admin enters live/final scores in the dashboard.
- football_data: poll football-data.org (https://www.football-data.org).

Prediction points are only awarded when a match moves to FINISHED (see scoring.py).
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

import requests
from django.db import transaction
from django.db.models.signals import post_save
from django.utils import timezone

from tournaments.models import Match, Tournament
from tournaments.services.datetime_utils import ensure_aware_datetime
from tournaments.services.football_data import (
    fetch_competition_matches,
    find_football_data_match_for_match,
    resolve_api_token,
    resolve_competition_code,
    resolve_season,
)

logger = logging.getLogger(__name__)

SYNC_WINDOW_BEFORE = timedelta(minutes=15)
SYNC_WINDOW_AFTER = timedelta(hours=3)


def parse_sync_bound(raw: str) -> date | None:
    """Parse LIVE_SCORE_SYNC_* env values (YYYY-MM-DD or ISO datetime prefix)."""
    value = raw.strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        logger.warning("Ignoring invalid LIVE_SCORE_SYNC date value: %r", value)
        return None


def is_sync_window_open() -> bool:
    """Optional date gate via LIVE_SCORE_SYNC_START / LIVE_SCORE_SYNC_END env."""
    import os

    start = parse_sync_bound(os.environ.get("LIVE_SCORE_SYNC_START", ""))
    end = parse_sync_bound(os.environ.get("LIVE_SCORE_SYNC_END", ""))
    if not start and not end:
        return True
    today = timezone.now().date()
    if start and today < start:
        return False
    if end and today > end:
        return False
    return True


def _save_live_match_fields(
    match: Match,
    *,
    status: str,
    home_score: int | None,
    away_score: int | None,
    winner_team_id: int | None = None,
    finalize: bool = False,
) -> Match:
    match.status = Match.Status.FINISHED if finalize else status
    match.home_score = home_score
    match.away_score = away_score
    if finalize or status == Match.Status.FINISHED:
        match.winner_team_id = winner_team_id
    update_fields = ["status", "home_score", "away_score"]
    if finalize or status == Match.Status.FINISHED:
        update_fields.append("winner_team")
    match.save(update_fields=update_fields)
    return match


def apply_live_match_update(
    match: Match,
    *,
    status: str,
    home_score: int | None,
    away_score: int | None,
    winner_team_id: int | None = None,
    finalize: bool = False,
) -> Match:
    """Update display scores; post_save signal recalculates when finished."""
    return _save_live_match_fields(
        match,
        status=status,
        home_score=home_score,
        away_score=away_score,
        winner_team_id=winner_team_id,
        finalize=finalize,
    )


def sync_all_configured_tournaments() -> list[dict[str, Any]]:
    if not is_sync_window_open():
        return [{"skipped": True, "reason": "outside_sync_window"}]

    results = []
    tournaments = Tournament.objects.exclude(
        live_score_provider=Tournament.LiveScoreProvider.MANUAL
    )
    for tournament in tournaments:
        result = sync_tournament_live_scores(tournament)
        results.append({"tournament_id": tournament.id, **result})
    return results


def sync_tournament_live_scores(tournament: Tournament) -> dict[str, Any]:
    if tournament.live_score_provider == Tournament.LiveScoreProvider.MANUAL:
        return {"updated": 0, "skipped": 0}
    if tournament.live_score_provider == Tournament.LiveScoreProvider.FOOTBALL_DATA:
        return _sync_football_data(tournament)
    return {"updated": 0, "skipped": 0, "error": "unknown_provider"}


def _match_in_sync_window(match: Match, now: datetime) -> bool:
    if match.status == Match.Status.LIVE:
        return True
    if not match.kickoff_time:
        return False
    kickoff = ensure_aware_datetime(match.kickoff_time)
    start = kickoff - SYNC_WINDOW_BEFORE
    end = kickoff + SYNC_WINDOW_AFTER
    return start <= now <= end


def _sync_football_data(tournament: Tournament) -> dict[str, Any]:
    from predictions.services.scoring import recalculate_match_scores
    from predictions.signals import recalculate_predictions_when_match_finishes

    config = tournament.live_score_config or {}
    if not resolve_api_token():
        return {"updated": 0, "skipped": 0, "error": "missing_api_token"}

    competition_code = resolve_competition_code(config)
    season = resolve_season(config, tournament.year)
    now = timezone.now()

    try:
        matches = list(
            Match.objects.filter(tournament=tournament)
            .exclude(status=Match.Status.FINISHED)
            .select_related("home_team", "away_team")
        )
        active_matches = [match for match in matches if _match_in_sync_window(match, now)]
        skipped = len(matches) - len(active_matches)
        if not active_matches:
            return {"updated": 0, "skipped": skipped}

        date_from, date_to = _fetch_date_bounds(active_matches)
        api_matches = fetch_competition_matches(
            competition_code=competition_code,
            season=season,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as exc:
        if str(exc) == "missing_api_token":
            return {"updated": 0, "skipped": 0, "error": "missing_api_token"}
        logger.exception("Football-data config error for tournament %s: %s", tournament.id, exc)
        return {"updated": 0, "skipped": 0, "error": "api_config_error"}
    except requests.RequestException as exc:
        logger.exception("Football-data fetch failed for tournament %s: %s", tournament.id, exc)
        return {"updated": 0, "skipped": 0, "error": "api_fetch_failed"}

    updated = 0
    finalized_match_ids: list[int] = []

    post_save.disconnect(recalculate_predictions_when_match_finishes, sender=Match)
    try:
        with transaction.atomic():
            for match in active_matches:
                external = find_football_data_match_for_match(match, api_matches)
                if not external:
                    skipped += 1
                    continue
                if external.home_score is None or external.away_score is None:
                    if external.status == Match.Status.SCHEDULED:
                        skipped += 1
                        continue
                    home_score = external.home_score if external.home_score is not None else 0
                    away_score = external.away_score if external.away_score is not None else 0
                else:
                    home_score = external.home_score
                    away_score = external.away_score

                winner_team_id = None
                if external.status == Match.Status.FINISHED and match.is_knockout:
                    if home_score > away_score:
                        winner_team_id = match.home_team_id
                    elif away_score > home_score:
                        winner_team_id = match.away_team_id

                finalize = external.status == Match.Status.FINISHED
                _save_live_match_fields(
                    match,
                    status=external.status,
                    home_score=home_score,
                    away_score=away_score,
                    winner_team_id=winner_team_id,
                    finalize=finalize,
                )
                if finalize:
                    finalized_match_ids.append(match.id)
                updated += 1
    finally:
        post_save.connect(recalculate_predictions_when_match_finishes, sender=Match)

    for match_id in finalized_match_ids:
        match = Match.objects.select_related(
            "stage", "home_team", "away_team", "winner_team"
        ).get(pk=match_id)
        recalculate_match_scores(match)

    return {
        "updated": updated,
        "skipped": skipped,
        "finalized": len(finalized_match_ids),
        "api_matches": len(api_matches),
        "competition_code": competition_code,
    }


def _fetch_date_bounds(active_matches: list[Match]) -> tuple[date, date]:
    kickoff_dates = [
        ensure_aware_datetime(match.kickoff_time).date()
        for match in active_matches
        if match.kickoff_time
    ]
    if not kickoff_dates:
        today = timezone.now().date()
        return today, today
    return min(kickoff_dates), max(kickoff_dates)
