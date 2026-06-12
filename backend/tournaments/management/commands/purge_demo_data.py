from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from groups.models import Group

User = get_user_model()

DEMO_TOURNAMENT_NAME = "Demo Test Cup"
DEMO_TOURNAMENT_NAME_AR = "كأس التجربة"
DEMO_GROUP_NAME = "Demo Predictors"

DEMO_USERNAMES = (
    "admin_worldcup_legacy",
    "demo_worldcup_legacy",
    "testuser",
    "test309",
    "signupfix",
    "demo",
)

DEMO_USER_EMAILS = (
    "demo@alhabeed.com",
    "demo@worldcup.com",
    "admin@worldcup.com",
)

PROTECTED_USERNAMES = ("admin",)
PROTECTED_EMAILS = ("admin@alhabeed.com",)


class Command(BaseCommand):
    help = (
        "Remove Demo Test Cup (and related data), Demo Predictors, "
        "and legacy/demo/test user accounts."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without making changes.",
        )

    def _demo_tournaments(self):
        from tournaments.models import Tournament

        return Tournament.objects.filter(
            Q(name=DEMO_TOURNAMENT_NAME) | Q(name_ar=DEMO_TOURNAMENT_NAME_AR)
        )

    def _demo_groups(self):
        return Group.objects.filter(name=DEMO_GROUP_NAME)

    def _demo_users(self):
        return User.objects.filter(
            Q(username__in=DEMO_USERNAMES) | Q(email__in=DEMO_USER_EMAILS)
        ).exclude(
            Q(username__in=PROTECTED_USERNAMES) | Q(email__in=PROTECTED_EMAILS)
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        demo_tournaments = self._demo_tournaments()
        demo_groups = self._demo_groups()
        demo_users = self._demo_users()

        self.stdout.write(f"Demo tournaments: {demo_tournaments.count()}")
        self.stdout.write(f"Demo groups: {demo_groups.count()}")
        self.stdout.write(f"Demo/test users: {demo_users.count()}")

        if dry_run:
            for tournament in demo_tournaments:
                label = tournament.name_ar or tournament.name
                self.stdout.write(
                    f"  would delete tournament: {tournament.name} · {label} ({tournament.year})"
                )
            for group in demo_groups:
                self.stdout.write(f"  would delete group: {group.name}")
            for user in demo_users:
                self.stdout.write(f"  would delete user: {user.username} <{user.email}>")
            return

        tournament_count, _ = demo_tournaments.delete()
        group_count, _ = demo_groups.delete()
        user_count, _ = demo_users.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Removed {tournament_count} tournament row(s), "
                f"{group_count} group row(s), {user_count} user row(s)."
            )
        )
