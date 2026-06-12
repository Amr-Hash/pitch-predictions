from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tournaments.services.live_scores import ensure_aware_datetime

from tournaments.models import Match, Tournament
from tournaments.wc2026_data import WC2026_GROUP_MATCHES, WC2026_TOURNAMENT


def parse_kickoff(iso: str):
    return ensure_aware_datetime(datetime.fromisoformat(iso.replace("Z", "+00:00")))


class Command(BaseCommand):
    help = "Update FIFA World Cup 2026 group-stage kickoff times from wc2026_data (safe for live DB)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show changes without writing to the database",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        tournament = Tournament.objects.filter(
            name=WC2026_TOURNAMENT["name"],
            year=WC2026_TOURNAMENT["year"],
        ).first()
        if not tournament:
            self.stderr.write(
                self.style.ERROR(
                    f"Tournament not found: {WC2026_TOURNAMENT['name']} "
                    f"({WC2026_TOURNAMENT['year']}). Run seed_data first."
                )
            )
            return

        updated = 0
        missing = 0
        unchanged = 0

        with transaction.atomic():
            for _group, matchday, home_code, away_code, kickoff_iso in WC2026_GROUP_MATCHES:
                new_kickoff = parse_kickoff(kickoff_iso)
                match = (
                    Match.objects.filter(
                        tournament=tournament,
                        matchday=matchday,
                        home_team__code=home_code,
                        away_team__code=away_code,
                    )
                    .select_related("home_team", "away_team")
                    .first()
                )
                if not match:
                    missing += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Missing: MD{matchday} {home_code} vs {away_code}"
                        )
                    )
                    continue

                if match.kickoff_time == new_kickoff:
                    unchanged += 1
                    continue

                old = match.kickoff_time.isoformat()
                self.stdout.write(
                    f"  {home_code} vs {away_code} (MD{matchday}): "
                    f"{old} -> {new_kickoff.isoformat()}"
                )
                if not dry_run:
                    match.kickoff_time = new_kickoff
                    match.save(update_fields=["kickoff_time"])
                updated += 1

            if dry_run:
                transaction.set_rollback(True)

        label = "Would update" if dry_run else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{label} {updated} match(es); {unchanged} already correct; "
                f"{missing} not found in DB."
            )
        )
