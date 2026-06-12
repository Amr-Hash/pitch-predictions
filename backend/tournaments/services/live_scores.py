"""
Live score ingestion for tournaments.

Providers:
- manual: admin enters live/final scores in the dashboard.
- scraping: poll a public scores page (no API key).

Prediction points are only awarded when a match moves to FINISHED (see scoring.py).
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

import requests
from django.db import transaction
from django.utils import timezone

from tournaments.models import Match, Tournament
from tournaments.services.datetime_utils import ensure_aware_datetime
from tournaments.services.score_scraper import (
    fetch_scraped_scores,
    find_scraped_score_for_match,
    resolve_scores_url,
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


def apply_live_match_update(
    match: Match,
    *,
    status: str,
    home_score: int | None,
    away_score: int | None,
    winner_team_id: int | None = None,
    finalize: bool = False,
) -> Match:
    """Update display scores; recalculate predictions only when finished."""
    from predictions.services.scoring import recalculate_match_scores

    match.status = Match.Status.FINISHED if finalize else status
    match.home_score = home_score
    match.away_score = away_score
    if finalize or status == Match.Status.FINISHED:
        match.winner_team_id = winner_team_id
    update_fields = ["status", "home_score", "away_score"]
    if finalize or status == Match.Status.FINISHED:
        update_fields.append("winner_team")
    match.save(update_fields=update_fields)

    if match.status == Match.Status.FINISHED:
        recalculate_match_scores(match)
    return match


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
    if tournament.live_score_provider == Tournament.LiveScoreProvider.SCRAPING:
        return _sync_scraping(tournament)
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


def _sync_scraping(tournament: Tournament) -> dict[str, Any]:
    config = tournament.live_score_config or {}
    scores_url = resolve_scores_url(config)
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

        scraped_rows = fetch_scraped_scores(scores_url)
    except (requests.RequestException, ValueError) as exc:
        logger.exception("Score scrape failed for tournament %s: %s", tournament.id, exc)
        return {"updated": 0, "skipped": 0, "error": "scrape_failed"}

    updated = 0
    with transaction.atomic():
        for match in active_matches:
            scraped = find_scraped_score_for_match(match, scraped_rows)
            if not scraped:
                skipped += 1
                continue
            if scraped.home_score is None or scraped.away_score is None:
                if scraped.status == Match.Status.SCHEDULED:
                    skipped += 1
                    continue
                home_score = scraped.home_score if scraped.home_score is not None else 0
                away_score = scraped.away_score if scraped.away_score is not None else 0
            else:
                home_score = scraped.home_score
                away_score = scraped.away_score

            winner_team_id = None
            if scraped.status == Match.Status.FINISHED and match.is_knockout:
                if home_score > away_score:
                    winner_team_id = match.home_team_id
                elif away_score > home_score:
                    winner_team_id = match.away_team_id

            apply_live_match_update(
                match,
                status=scraped.status,
                home_score=home_score,
                away_score=away_score,
                winner_team_id=winner_team_id,
                finalize=scraped.status == Match.Status.FINISHED,
            )
            updated += 1

    return {"updated": updated, "skipped": skipped, "scraped_matches": len(scraped_rows)}
