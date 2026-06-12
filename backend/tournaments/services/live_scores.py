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
from typing import Any

import requests
from django.db import transaction

from tournaments.models import Match, Tournament

logger = logging.getLogger(__name__)

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
SPORTMONKS_BASE = "https://api.sportmonks.com/v3/football"

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


def sync_tournament_live_scores(tournament: Tournament) -> dict[str, int]:
    provider = tournament.live_score_provider
    if provider == Tournament.LiveScoreProvider.MANUAL:
        return {"updated": 0, "skipped": 0}
    if provider == Tournament.LiveScoreProvider.API_FOOTBALL:
        return _sync_api_football(tournament)
    if provider == Tournament.LiveScoreProvider.SPORTMONKS:
        return _sync_sportmonks(tournament)
    return {"updated": 0, "skipped": 0}


def _sync_api_football(tournament: Tournament) -> dict[str, int]:
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

    headers = {"x-apisports-key": api_key}
    fixtures: list[dict[str, Any]] = []

    for params in (
        {"league": league_id, "season": season, "live": "all"},
        {"league": league_id, "season": season, "next": 50},
    ):
        try:
            res = requests.get(
                f"{API_FOOTBALL_BASE}/fixtures",
                headers=headers,
                params=params,
                timeout=20,
            )
            res.raise_for_status()
            fixtures.extend(res.json().get("response") or [])
        except requests.RequestException as exc:
            logger.exception("API-Football request failed: %s", exc)
            return {"updated": 0, "skipped": 0, "error": "request_failed"}

    by_external_id = {
        str(item["fixture"]["id"]): item
        for item in fixtures
        if item.get("fixture", {}).get("id")
    }

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


def _sync_sportmonks(tournament: Tournament) -> dict[str, int]:
    api_key = os.environ.get("SPORTMONKS_API_KEY", "").strip()
    if not api_key:
        logger.warning("SPORTMONKS_API_KEY is not set; skipping tournament %s", tournament.id)
        return {"updated": 0, "skipped": 0, "error": "missing_api_key"}

    config = tournament.live_score_config or {}
    season_id = config.get("season_id")
    if not season_id:
        logger.warning("Tournament %s missing live_score_config.season_id", tournament.id)
        return {"updated": 0, "skipped": 0, "error": "missing_config"}

    # SportMonks livescores — map fixtures via external_fixture_id on each match.
    logger.info(
        "SportMonks sync stub for tournament %s (season_id=%s)", tournament.id, season_id
    )
    return {"updated": 0, "skipped": 0, "error": "sportmonks_not_implemented"}
