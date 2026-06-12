"""
Live score ingestion for tournaments.

Providers:
- manual: admin enters live/final scores in the dashboard.
- api_football: poll API-Football (api-sports.io) — set API_FOOTBALL_KEY in env.
- sportmonks: poll SportMonks — set SPORTMONKS_API_KEY in env.

Prediction points are only awarded when a match moves to FINISHED (see scoring.py).
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone as dt_timezone
from typing import Any

import requests
from django.db import transaction
from django.utils import timezone

from tournaments.models import Match, Tournament
from tournaments.services.api_football_client import fetch_season_fixtures

logger = logging.getLogger(__name__)

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
SPORTMONKS_BASE = "https://api.sportmonks.com/v3/football"

SYNC_WINDOW_BEFORE = timedelta(minutes=15)
SYNC_WINDOW_AFTER = timedelta(hours=3)

# API-Football short status → our Match.Status
API_FOOTBALL_STATUS = {
    "NS": Match.Status.SCHEDULED,
    "TBD": Match.Status.SCHEDULED,
    "PST": Match.Status.SCHEDULED,
    "1H": Match.Status.LIVE,
    "HT": Match.Status.LIVE,
    "2H": Match.Status.LIVE,
    "ET": Match.Status.LIVE,
    "BT": Match.Status.LIVE,
    "P": Match.Status.LIVE,
    "LIVE": Match.Status.LIVE,
    "FT": Match.Status.FINISHED,
    "AET": Match.Status.FINISHED,
    "PEN": Match.Status.FINISHED,
}


def ensure_aware_datetime(value: datetime) -> datetime:
    """Normalize kickoff (and similar) datetimes to timezone-aware UTC."""
    if timezone.is_aware(value):
        return value
    return timezone.make_aware(value, dt_timezone.utc)


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
    provider = tournament.live_score_provider
    if provider == Tournament.LiveScoreProvider.MANUAL:
        return {"updated": 0, "skipped": 0}
    if provider == Tournament.LiveScoreProvider.API_FOOTBALL:
        return _sync_api_football(tournament)
    if provider == Tournament.LiveScoreProvider.SPORTMONKS:
        return _sync_sportmonks(tournament)
    return {"updated": 0, "skipped": 0}


def _match_in_sync_window(match: Match, now: datetime) -> bool:
    if match.status == Match.Status.LIVE:
        return True
    start = match.kickoff_time - SYNC_WINDOW_BEFORE
    end = match.kickoff_time + SYNC_WINDOW_AFTER
    return start <= now <= end


def _sync_api_football(tournament: Tournament) -> dict[str, Any]:
    api_key = os.environ.get("API_FOOTBALL_KEY", "").strip()
    if not api_key:
        logger.warning("API_FOOTBALL_KEY is not set; skipping tournament %s", tournament.id)
        return {"updated": 0, "skipped": 0, "error": "missing_api_key"}

    config = tournament.live_score_config or {}
    league_id = config.get("league_id")
    season = config.get("season")
    if not league_id or not season:
        logger.warning(
            "Tournament %s missing live_score_config.league_id/season", tournament.id
        )
        return {"updated": 0, "skipped": 0, "error": "missing_config"}

    try:
        fixtures = fetch_season_fixtures(int(league_id), int(season))
    except (requests.RequestException, ValueError) as exc:
        logger.exception("API-Football request failed: %s", exc)
        return {"updated": 0, "skipped": 0, "error": "request_failed"}

    by_external_id = {
        str(item["fixture"]["id"]): item
        for item in fixtures
        if item.get("fixture", {}).get("id")
    }

    now = timezone.now()
    updated = 0
    skipped = 0
    matches = Match.objects.filter(tournament=tournament).exclude(
        status=Match.Status.FINISHED
    )

    with transaction.atomic():
        for match in matches.select_for_update():
            ext_id = (match.external_fixture_id or "").strip()
            if not ext_id or ext_id not in by_external_id:
                skipped += 1
                continue
            if not _match_in_sync_window(match, now):
                payload = by_external_id[ext_id]
                short = ((payload.get("fixture") or {}).get("status") or {}).get("short")
                if short not in {"FT", "AET", "PEN"}:
                    skipped += 1
                    continue
            payload = by_external_id[ext_id]
            if _apply_api_football_payload(match, payload):
                updated += 1
            else:
                skipped += 1

    return {"updated": updated, "skipped": skipped}


def _apply_api_football_payload(match: Match, payload: dict[str, Any]) -> bool:
    fixture = payload.get("fixture") or {}
    goals = payload.get("goals") or {}
    teams = payload.get("teams") or {}
    short = (fixture.get("status") or {}).get("short") or "NS"
    status = API_FOOTBALL_STATUS.get(short, Match.Status.SCHEDULED)

    home_score = goals.get("home")
    away_score = goals.get("away")
    if home_score is None or away_score is None:
        if status != Match.Status.SCHEDULED:
            home_score = home_score if home_score is not None else 0
            away_score = away_score if away_score is not None else 0
        else:
            return False

    winner_team_id = None
    if status == Match.Status.FINISHED and match.is_knockout and home_score == away_score:
        winner_side = (teams.get("home") or {}).get("winner"), (teams.get("away") or {}).get(
            "winner"
        )
        if winner_side[0]:
            winner_team_id = match.home_team_id
        elif winner_side[1]:
            winner_team_id = match.away_team_id

    apply_live_match_update(
        match,
        status=status,
        home_score=int(home_score),
        away_score=int(away_score),
        winner_team_id=winner_team_id,
        finalize=status == Match.Status.FINISHED,
    )
    return True


def _sync_sportmonks(tournament: Tournament) -> dict[str, Any]:
    api_key = os.environ.get("SPORTMONKS_API_KEY", "").strip()
    if not api_key:
        logger.warning("SPORTMONKS_API_KEY is not set; skipping tournament %s", tournament.id)
        return {"updated": 0, "skipped": 0, "error": "missing_api_key"}

    config = tournament.live_score_config or {}
    season_id = config.get("season_id")
    if not season_id:
        logger.warning("Tournament %s missing live_score_config.season_id", tournament.id)
        return {"updated": 0, "skipped": 0, "error": "missing_config"}

    logger.info(
        "SportMonks sync stub for tournament %s (season_id=%s)", tournament.id, season_id
    )
    return {"updated": 0, "skipped": 0, "error": "sportmonks_not_implemented"}
