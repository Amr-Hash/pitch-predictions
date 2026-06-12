"""Fetch live scores by scraping public score pages (no paid API)."""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import requests
from bs4 import BeautifulSoup

from tournaments.models import Match
from tournaments.services.team_name_matching import build_code_lookup, scraped_team_name_to_code

logger = logging.getLogger(__name__)

DEFAULT_SCRAPE_URL = (
    "https://fdh-api.frontend.fifa.com/v1/calendar/47246?locale=en"
)
SCORE_PATTERN = re.compile(r"^\s*(\d+)\s*[-–]\s*(\d+)\s*$")


@dataclass(frozen=True)
class ScrapedScore:
    home_code: str | None
    away_code: str | None
    home_name: str
    away_name: str
    home_score: int | None
    away_score: int | None
    status: str
    match_date: date | None


def resolve_scores_url(config: dict[str, Any] | None) -> str:
    config = config or {}
    url = (
        str(config.get("scores_url") or "").strip()
        or os.environ.get("LIVE_SCORE_SCRAPE_URL", "").strip()
        or DEFAULT_SCRAPE_URL
    )
    return url


def fetch_scraped_scores(scores_url: str) -> list[ScrapedScore]:
    headers = {
        "User-Agent": "AlhabeedLiveScores/1.0 (+https://alhabeed.vercel.app)",
        "Accept": "text/html,application/json",
    }
    response = requests.get(scores_url, headers=headers, timeout=30)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "")
    if "json" in content_type or scores_url.endswith(".json"):
        return _parse_json_payload(response.json())
    return _parse_html_payload(response.text)


def _parse_json_payload(payload: Any) -> list[ScrapedScore]:
    lookup = build_code_lookup()
    rows: list[ScrapedScore] = []
    items = payload
    if isinstance(payload, dict):
        items = payload.get("results") or payload.get("Matches") or payload.get("matches") or []
    if not isinstance(items, list):
        return rows

    for item in items:
        if not isinstance(item, dict):
            continue
        parsed = _parse_json_match(item, lookup)
        if parsed:
            rows.append(parsed)
    return rows


def _parse_json_match(item: dict[str, Any], lookup: dict[str, str]) -> ScrapedScore | None:
    home = item.get("homeTeam") or item.get("HomeTeam") or item.get("home") or {}
    away = item.get("awayTeam") or item.get("AwayTeam") or item.get("away") or {}
    if isinstance(home, str):
        home_name = home
        away_name = str(away)
        home_code = scraped_team_name_to_code(home_name, lookup)
        away_code = scraped_team_name_to_code(away_name, lookup)
    else:
        home_name = str(home.get("name") or home.get("Name") or home.get("teamName") or "")
        away_name = str(away.get("name") or away.get("Name") or away.get("teamName") or "")
        home_code = (
            str(home.get("countryCode") or home.get("IdCountry") or "").upper()
            or scraped_team_name_to_code(home_name, lookup)
        )
        away_code = (
            str(away.get("countryCode") or away.get("IdCountry") or "").upper()
            or scraped_team_name_to_code(away_name, lookup)
        )
    if not home_name or not away_name:
        return None

    home_score = _coerce_score(
        item.get("homeTeamScore")
        or item.get("HomeTeamScore")
        or item.get("home_score")
        or (item.get("score") or {}).get("home")
    )
    away_score = _coerce_score(
        item.get("awayTeamScore")
        or item.get("AwayTeamScore")
        or item.get("away_score")
        or (item.get("score") or {}).get("away")
    )
    status = _map_external_status(
        item.get("matchStatus")
        or item.get("MatchStatus")
        or item.get("status")
        or item.get("Status")
    )
    match_date = _parse_match_date(
        item.get("date")
        or item.get("Date")
        or item.get("kickoffTime")
        or item.get("KickoffTime")
    )
    return ScrapedScore(
        home_code=home_code,
        away_code=away_code,
        home_name=home_name,
        away_name=away_name,
        home_score=home_score,
        away_score=away_score,
        status=status,
        match_date=match_date,
    )


def _parse_html_payload(html: str) -> list[ScrapedScore]:
    lookup = build_code_lookup()
    soup = BeautifulSoup(html, "html.parser")
    rows: list[ScrapedScore] = []

    for element in soup.select("[data-home-team], .fixture, .match-row, article"):
        home_name = (
            element.get("data-home-team")
            or _text(element.select_one(".home-team, .team-home, [class*='home']"))
        )
        away_name = (
            element.get("data-away-team")
            or _text(element.select_one(".away-team, .team-away, [class*='away']"))
        )
        score_text = _text(
            element.select_one(".score, .fixture__score, [class*='score']")
        )
        if not home_name or not away_name:
            continue
        home_score, away_score = _parse_score_text(score_text)
        status = Match.Status.FINISHED if home_score is not None else Match.Status.SCHEDULED
        rows.append(
            ScrapedScore(
                home_code=scraped_team_name_to_code(home_name, lookup),
                away_code=scraped_team_name_to_code(away_name, lookup),
                home_name=home_name,
                away_name=away_name,
                home_score=home_score,
                away_score=away_score,
                status=status,
                match_date=None,
            )
        )
    return rows


def find_scraped_score_for_match(
    match: Match,
    scraped_rows: list[ScrapedScore],
) -> ScrapedScore | None:
    home_code = match.home_team.code.upper()
    away_code = match.away_team.code.upper()
    home_name = match.home_team.name
    away_name = match.away_team.name

    for row in scraped_rows:
        if row.home_code == home_code and row.away_code == away_code:
            return row
        if (
            normalize_team(row.home_name) == normalize_team(home_name)
            and normalize_team(row.away_name) == normalize_team(away_name)
        ):
            return row
    return None


def normalize_team(name: str) -> str:
    from tournaments.services.team_name_matching import normalize_team_name

    return normalize_team_name(name)


def _coerce_score(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_score_text(value: str) -> tuple[int | None, int | None]:
    match = SCORE_PATTERN.match(value or "")
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


def _parse_match_date(value: Any) -> date | None:
    if not value:
        return None
    text = str(value)
    try:
        if "T" in text:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _map_external_status(value: Any) -> str:
    if value is None:
        return Match.Status.SCHEDULED
    if isinstance(value, int):
        if value in {0, 1, 2}:
            return Match.Status.SCHEDULED
        if value in {3, 4, 5, 6, 7, 8, 9, 10, 11, 12}:
            return Match.Status.LIVE
        return Match.Status.FINISHED
    text = str(value).strip().lower()
    if text in {"live", "in progress", "inprogress", "playing", "1h", "2h", "ht"}:
        return Match.Status.LIVE
    if text in {"finished", "ft", "full time", "fulltime", "ended", "aet", "pen"}:
        return Match.Status.FINISHED
    return Match.Status.SCHEDULED


def _text(node) -> str:
    if node is None:
        return ""
    return " ".join(node.get_text(" ", strip=True).split())
