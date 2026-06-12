from django.core.management.base import BaseCommand

from tournaments.models import Tournament
from tournaments.services.live_scores import is_sync_window_open, sync_tournament_live_scores


class Command(BaseCommand):
    help = "Poll configured live-score providers and update in-progress matches."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tournament",
            type=int,
            help="Sync a single tournament id (default: all with a non-manual provider).",
        )

    def handle(self, *args, **options):
        if not is_sync_window_open():
            self.stdout.write("Outside LIVE_SCORE_SYNC_START/END window; skipping.")
            return

        tournament_id = options.get("tournament")
        if tournament_id:
            tournaments = Tournament.objects.filter(id=tournament_id)
        else:
            tournaments = Tournament.objects.exclude(
                live_score_provider=Tournament.LiveScoreProvider.MANUAL
            )

        if not tournaments.exists():
            self.stdout.write("No tournaments configured for live score sync.")
            return

        for tournament in tournaments:
            result = sync_tournament_live_scores(tournament)
            self.stdout.write(
                f"{tournament.name} ({tournament.live_score_provider}): {result}"
            )
