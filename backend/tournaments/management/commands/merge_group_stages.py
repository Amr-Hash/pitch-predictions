from django.core.management.base import BaseCommand
from django.db import transaction

from tournaments.ar_translations import stage_name_ar
from tournaments.models import Match, Stage, Tournament


class Command(BaseCommand):
    help = (
        "Merge per-matchday group stages into a single Group Stage "
        "(matches keep their matchday field)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show changes without writing to the database",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        merged_tournaments = 0
        moved_matches = 0
        removed_stages = 0

        for tournament in Tournament.objects.all().order_by("year", "id"):
            group_stages = list(
                Stage.objects.filter(
                    tournament=tournament,
                    stage_type=Stage.StageType.GROUP,
                ).order_by("order", "id")
            )
            if len(group_stages) <= 1:
                if len(group_stages) == 1 and group_stages[0].name != "Group Stage":
                    stage = group_stages[0]
                    self.stdout.write(
                        f"  {tournament.name} ({tournament.year}): "
                        f'rename "{stage.name}" -> "Group Stage"'
                    )
                    if not dry_run:
                        stage.name = "Group Stage"
                        stage.name_ar = stage_name_ar("Group Stage")
                        stage.order = 1
                        stage.save(update_fields=["name", "name_ar", "order"])
                continue

            primary = group_stages[0]
            extras = group_stages[1:]
            self.stdout.write(
                f"{tournament.name} ({tournament.year}): "
                f"merge {len(group_stages)} group stages into one"
            )

            with transaction.atomic():
                if not dry_run:
                    primary.name = "Group Stage"
                    primary.name_ar = stage_name_ar("Group Stage")
                    primary.order = 1
                    primary.save(update_fields=["name", "name_ar", "order"])

                for stage in extras:
                    count = Match.objects.filter(stage=stage).count()
                    if count:
                        self.stdout.write(
                            f"  move {count} match(es) from "
                            f'"{stage.name}" (order {stage.order})'
                        )
                        moved_matches += count
                        if not dry_run:
                            Match.objects.filter(stage=stage).update(stage=primary)
                    self.stdout.write(f'  remove stage "{stage.name}" (order {stage.order})')
                    removed_stages += 1
                    if not dry_run:
                        stage.delete()

                merged_tournaments += 1

        summary = (
            f"Done: {merged_tournaments} tournament(s) merged, "
            f"{moved_matches} match(es) moved, {removed_stages} stage(s) removed."
        )
        if dry_run:
            self.stdout.write(self.style.WARNING(f"Dry run — {summary}"))
        else:
            self.stdout.write(self.style.SUCCESS(summary))
