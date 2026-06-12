from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from tournaments.models import Match, Tournament
from tournaments.services.api_football_client import fetch_season_fixtures
from tournaments.services.api_football_mapping import api_team_name_to_code, build_code_lookup
from tournaments.wc2026_data import WC2026_TOURNAMENT

DEFAULT_LEAGUE_ID = 1
DEFAULT_SEASON = 2026
KICKOFF_TOLERANCE = timedelta(minutes=30)


class Command(BaseCommand):
    help = "Map FIFA World Cup 2026 group matches to API-Football fixture IDs."

    def add_arguments(self, parser):
        parser.add_argument("--league-id", type=int, default=DEFAULT_LEAGUE_ID)
        parser.add_argument("--season", type=int, default=DEFAULT_SEASON)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        league_id = options["league_id"]
        season = options["season"]
        dry_run = options["dry_run"]

        tournament = Tournament.objects.filter(
            name=WC2026_TOURNAMENT["name"],
            year=WC2026_TOURNAMENT["year"],
        ).first()
        if not tournament:
            self.stderr.write("World Cup 2026 tournament not found. Run seed_data first.")
            return

        try:
            fixtures = fetch_season_fixtures(league_id, season)
        except ValueError:
            self.stderr.write("API_FOOTBALL_KEY is not set.")
            return
        except Exception as exc:
            self.stderr.write(f"API-Football request failed: {exc}")
            return
        self.stdout.write(f"Fetched {len(fixtures)} fixtures from API-Football.")

        lookup = build_code_lookup()
        matches = (
            Match.objects.filter(tournament=tournament, stage__stage_type="group")
            .select_related("home_team", "away_team")
            .order_by("kickoff_time")
        )

        mapped = 0
        unmatched = 0
        ambiguous = 0

        for match in matches:
            candidates = []
            for item in fixtures:
                fixture = item.get("fixture") or {}
                kickoff_raw = fixture.get("date")
                if not kickoff_raw:
                    continue
                from tournaments.services.live_scores import ensure_aware_datetime

                kickoff = ensure_aware_datetime(
                    datetime.fromisoformat(kickoff_raw.replace("Z", "+00:00"))
                )
                if abs(kickoff - match.kickoff_time) > KICKOFF_TOLERANCE:
                    continue

                teams = item.get("teams") or {}
                home_name = (teams.get("home") or {}).get("name") or ""
                away_name = (teams.get("away") or {}).get("name") or ""
                home_code = api_team_name_to_code(home_name, lookup)
                away_code = api_team_name_to_code(away_name, lookup)
                if home_code == match.home_team.code and away_code == match.away_team.code:
                    candidates.append(str(fixture["id"]))

            if len(candidates) == 1:
                ext_id = candidates[0]
                if not dry_run:
                    match.external_fixture_id = ext_id
                    match.save(update_fields=["external_fixture_id"])
                self.stdout.write(
                    f"Mapped {match.home_team.code} vs {match.away_team.code} → {ext_id}"
                )
                mapped += 1
            elif len(candidates) == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f"No fixture for {match.home_team.code} vs {match.away_team.code} "
                        f"({match.kickoff_time.isoformat()})"
                    )
                )
                unmatched += 1
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f"Ambiguous fixture for {match.home_team.code} vs {match.away_team.code}: "
                        f"{candidates}"
                    )
                )
                ambiguous += 1

        if not dry_run:
            tournament.live_score_provider = Tournament.LiveScoreProvider.API_FOOTBALL
            tournament.live_score_config = {"league_id": league_id, "season": season}
            tournament.save(update_fields=["live_score_provider", "live_score_config"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: mapped={mapped}, unmatched={unmatched}, ambiguous={ambiguous}"
                + (" (dry run)" if dry_run else "")
            )
        )
