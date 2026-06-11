"""Compact demo tournament for matchday-lock testing before the real World Cup.

Schedule: tomorrow 12:00–14:00 Egypt time (Africa/Cairo, UTC+2).
Six group-stage matches (2 groups × 3 matchdays) with minimal spacing.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

CAIRO = ZoneInfo("Africa/Cairo")

TEST_TOURNAMENT_META = {
    "name": "Demo Test Cup",
}

# Reuse well-known teams already in the WC seed
TEST_TEAMS = [
    ("Egypt", "EGY", "eg"),
    ("Morocco", "MAR", "ma"),
    ("USA", "USA", "us"),
    ("Mexico", "MEX", "mx"),
]

TEST_GROUPS = {
    "A": ["EGY", "MAR"],
    "B": ["USA", "MEX"],
}

# (group, matchday, home, away, minutes after 12:00 Egypt start)
TEST_MATCH_OFFSETS = [
    ("A", 1, "EGY", "MAR", 10),
    ("B", 1, "USA", "MEX", 12),
    ("A", 2, "MAR", "EGY", 45),
    ("B", 2, "MEX", "USA", 47),
    ("A", 3, "EGY", "MAR", 90),
    ("B", 3, "USA", "MEX", 92),
]


def build_test_tournament_schedule(now: datetime | None = None):
    """Return tournament metadata and match kickoffs (UTC-aware)."""
    if now is None:
        now = datetime.now(CAIRO)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=CAIRO)
    else:
        now = now.astimezone(CAIRO)

    start = (now + timedelta(days=1)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    end = start + timedelta(hours=2)

    matches = []
    for group, matchday, home, away, offset_minutes in TEST_MATCH_OFFSETS:
        kickoff_cairo = start + timedelta(minutes=offset_minutes)
        matches.append(
            (group, matchday, home, away, kickoff_cairo.astimezone(ZoneInfo("UTC")))
        )

    return {
        "name": TEST_TOURNAMENT_META["name"],
        "year": start.year,
        "start_date": start.date(),
        "end_date": end.date(),
        "start_cairo": start,
        "end_cairo": end,
        "teams": TEST_TEAMS,
        "groups": TEST_GROUPS,
        "matches": matches,
    }
