from __future__ import annotations

import os
from typing import Any

import requests

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"


def api_football_headers() -> dict[str, str]:
    api_key = os.environ.get("API_FOOTBALL_KEY", "").strip()
    if not api_key:
        raise ValueError("API_FOOTBALL_KEY is not set")
    return {"x-apisports-key": api_key}


def fetch_season_fixtures(league_id: int, season: int) -> list[dict[str, Any]]:
    """Fetch all fixtures for a league season (paginated)."""
    headers = api_football_headers()
    fixtures: list[dict[str, Any]] = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        res = requests.get(
            f"{API_FOOTBALL_BASE}/fixtures",
            headers=headers,
            params={"league": league_id, "season": season, "page": page},
            timeout=30,
        )
        res.raise_for_status()
        body = res.json()
        fixtures.extend(body.get("response") or [])
        paging = body.get("paging") or {}
        total_pages = int(paging.get("total") or 1)
        page += 1

    return fixtures
