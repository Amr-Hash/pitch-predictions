from __future__ import annotations

import logging
import os
from typing import Any

from django.db.models import Count
from django.utils import timezone

from tournaments.models import Match, Tournament
from tournaments.services.datetime_utils import ensure_aware_datetime
from tournaments.services.football_data import (
    DEFAULT_COMPETITION_CODE,
    resolve_api_token,
    resolve_competition_code,
)
from tournaments.services.live_scores import (
    SYNC_WINDOW_AFTER,
    SYNC_WINDOW_BEFORE,
    is_sync_window_open,
    parse_sync_bound,
)

logger = logging.getLogger(__name__)


def safe_live_score_config(config: Any) -> dict[str, Any]:
    if isinstance(config, dict):
        return config
    return {}


def kickoff_isoformat(kickoff_time) -> str | None:
    if not kickoff_time:
        return None
    return ensure_aware_datetime(kickoff_time).isoformat()


def get_global_live_score_environment() -> dict[str, Any]:
    start_raw = os.environ.get("LIVE_SCORE_SYNC_START", "").strip()
    end_raw = os.environ.get("LIVE_SCORE_SYNC_END", "").strip()
    start = parse_sync_bound(start_raw)
    end = parse_sync_bound(end_raw)
    return {
        "cron_secret_configured": bool(os.environ.get("CRON_SECRET", "").strip()),
        "sync_window_open": is_sync_window_open(),
        "sync_window_start": start.isoformat() if start else (start_raw or None),
        "sync_window_end": end.isoformat() if end else (end_raw or None),
        # Schedules run in the Django scheduler container (backend/cron/crontab).
        "cron_schedule": "django_scheduler",
        "football_data_api_configured": bool(resolve_api_token()),
        "default_competition_code": DEFAULT_COMPETITION_CODE,
    }


def _config_issues(tournament: Tournament) -> list[str]:
    if tournament.live_score_provider == Tournament.LiveScoreProvider.MANUAL:
        return []

    issues: list[str] = []
    if tournament.live_score_provider == Tournament.LiveScoreProvider.FOOTBALL_DATA:
        if not resolve_api_token():
            issues.append("missing_api_token")

    if not is_sync_window_open():
        issues.append("outside_sync_window")

    return issues


def _health_status(tournament: Tournament, issues: list[str]) -> str:
    if tournament.live_score_provider == Tournament.LiveScoreProvider.MANUAL:
        return "manual"
    blocking = {issue for issue in issues if issue in {"missing_api_token"}}
    if blocking:
        return "error"
    if "outside_sync_window" in issues:
        return "warning"
    return "ready"


def _failed_tournament_status(tournament: Tournament, exc: Exception) -> dict[str, Any]:
    logger.exception(
        "Failed to build live score status for tournament %s (%s)",
        tournament.id,
        tournament.name,
    )
    return {
        "tournament_id": tournament.id,
        "tournament_name": tournament.name,
        "tournament_name_ar": tournament.name_ar,
        "year": tournament.year,
        "is_active": tournament.is_active,
        "is_archived": tournament.is_archived,
        "live_score_provider": tournament.live_score_provider,
        "live_score_config": safe_live_score_config(tournament.live_score_config),
        "health": "error",
        "issues": ["status_build_failed"],
        "status_error": str(exc),
        "matches": {
            "total": 0,
            "scheduled": 0,
            "live": 0,
            "finished": 0,
            "in_sync_window": 0,
        },
    }


def get_tournament_live_score_status(
    tournament: Tournament,
    *,
    detailed: bool = False,
) -> dict[str, Any]:
    now = timezone.now()
    matches = Match.objects.filter(tournament=tournament)
    status_counts = {
        row["status"]: row["count"]
        for row in matches.values("status").annotate(count=Count("id"))
    }
    total_matches = sum(status_counts.values())

    sync_window_matches = 0
    for match in matches.exclude(status=Match.Status.FINISHED).iterator():
        if match.status == Match.Status.LIVE:
            sync_window_matches += 1
            continue
        if not match.kickoff_time:
            continue
        kickoff = ensure_aware_datetime(match.kickoff_time)
        window_start = kickoff - SYNC_WINDOW_BEFORE
        window_end = kickoff + SYNC_WINDOW_AFTER
        if window_start <= now <= window_end:
            sync_window_matches += 1

    issues = _config_issues(tournament)
    config = safe_live_score_config(tournament.live_score_config)

    payload: dict[str, Any] = {
        "tournament_id": tournament.id,
        "tournament_name": tournament.name,
        "tournament_name_ar": tournament.name_ar,
        "year": tournament.year,
        "is_active": tournament.is_active,
        "is_archived": tournament.is_archived,
        "live_score_provider": tournament.live_score_provider,
        "live_score_config": config,
        "competition_code": (
            resolve_competition_code(config)
            if tournament.live_score_provider == Tournament.LiveScoreProvider.FOOTBALL_DATA
            else None
        ),
        "health": _health_status(tournament, issues),
        "issues": issues,
        "matches": {
            "total": total_matches,
            "scheduled": status_counts.get(Match.Status.SCHEDULED, 0),
            "live": status_counts.get(Match.Status.LIVE, 0),
            "finished": status_counts.get(Match.Status.FINISHED, 0),
            "in_sync_window": sync_window_matches,
        },
    }

    if detailed and tournament.live_score_provider == Tournament.LiveScoreProvider.FOOTBALL_DATA:
        upcoming = (
            matches.filter(status__in=[Match.Status.SCHEDULED, Match.Status.LIVE])
            .select_related("home_team", "away_team")
            .order_by("kickoff_time")[:25]
        )
        payload["upcoming_matches"] = [
            {
                "id": match.id,
                "home_team": match.home_team.name,
                "away_team": match.away_team.name,
                "kickoff_time": kickoff_isoformat(match.kickoff_time),
                "status": match.status,
            }
            for match in upcoming
        ]

    return payload


def get_live_score_overview() -> dict[str, Any]:
    tournament_rows: list[dict[str, Any]] = []
    for tournament in Tournament.objects.all().order_by("-year", "name"):
        try:
            tournament_rows.append(get_tournament_live_score_status(tournament))
        except Exception as exc:
            tournament_rows.append(_failed_tournament_status(tournament, exc))

    auto_sync_count = sum(
        1
        for row in tournament_rows
        if row["live_score_provider"] != Tournament.LiveScoreProvider.MANUAL
    )
    return {
        "environment": get_global_live_score_environment(),
        "summary": {
            "tournament_count": len(tournament_rows),
            "auto_sync_tournament_count": auto_sync_count,
            "ready_count": sum(1 for row in tournament_rows if row["health"] == "ready"),
            "warning_count": sum(1 for row in tournament_rows if row["health"] == "warning"),
            "error_count": sum(1 for row in tournament_rows if row["health"] == "error"),
        },
        "tournaments": tournament_rows,
    }
