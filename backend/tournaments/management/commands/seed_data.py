from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from groups.models import Group, GroupMember
from tournaments.models import CupGroup, CupGroupTeam, Match, Stage, Team, Tournament
from tournaments.wc2026_data import (
    WC2026_GROUP_MATCHES,
    WC2026_GROUPS,
    WC2026_TEAMS,
    WC2026_TOURNAMENT,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Seed FIFA World Cup 2026 tournament data"

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")

        admin, _ = User.objects.get_or_create(
            email="admin@worldcup.com",
            defaults={"username": "admin", "is_staff": True, "is_superuser": True},
        )
        admin.username = admin.username or "admin"
        admin.is_staff = True
        admin.is_superuser = True
        admin.is_active = True
        admin.set_password("admin12345")
        admin.save()

        demo, _ = User.objects.get_or_create(
            email="demo@worldcup.com",
            defaults={"username": "demo"},
        )
        demo.is_active = True
        demo.set_password("demo12345")
        demo.save()

        teams = {}
        for name, code, flag_iso in WC2026_TEAMS:
            flag_url = f"https://flagcdn.com/w80/{flag_iso}.png"
            team, _ = Team.objects.update_or_create(
                code=code,
                defaults={"name": name, "flag_url": flag_url},
            )
            teams[code] = team

        tournament, _ = Tournament.objects.update_or_create(
            name=WC2026_TOURNAMENT["name"],
            year=WC2026_TOURNAMENT["year"],
            defaults={
                "start_date": WC2026_TOURNAMENT["start_date"],
                "end_date": WC2026_TOURNAMENT["end_date"],
            },
        )

        stages_config = [
            ("Group Stage — Matchday 1", 1, Stage.StageType.GROUP),
            ("Group Stage — Matchday 2", 2, Stage.StageType.GROUP),
            ("Group Stage — Matchday 3", 3, Stage.StageType.GROUP),
            ("Round of 32", 4, Stage.StageType.KNOCKOUT),
            ("Round of 16", 5, Stage.StageType.KNOCKOUT),
            ("Quarter Finals", 6, Stage.StageType.KNOCKOUT),
            ("Semi Finals", 7, Stage.StageType.KNOCKOUT),
            ("Third Place Match", 8, Stage.StageType.KNOCKOUT),
            ("Final", 9, Stage.StageType.KNOCKOUT),
        ]

        stages = {}
        for name, order, stage_type in stages_config:
            stage, _ = Stage.objects.update_or_create(
                tournament=tournament,
                order=order,
                defaults={"name": name, "stage_type": stage_type},
            )
            stages[order] = stage

        cup_groups = {}
        for letter, team_codes in WC2026_GROUPS.items():
            cup_group, _ = CupGroup.objects.update_or_create(
                tournament=tournament,
                name=letter,
            )
            cup_groups[letter] = cup_group
            CupGroupTeam.objects.filter(cup_group=cup_group).delete()
            for order, code in enumerate(team_codes):
                CupGroupTeam.objects.create(
                    cup_group=cup_group,
                    team=teams[code],
                    order=order,
                )

        Match.objects.filter(tournament=tournament).delete()

        for group_letter, matchday, home_code, away_code, kickoff_iso in WC2026_GROUP_MATCHES:
            kickoff = datetime.fromisoformat(kickoff_iso.replace("Z", "+00:00"))
            Match.objects.create(
                tournament=tournament,
                stage=stages[matchday],
                cup_group=cup_groups[group_letter],
                matchday=matchday,
                home_team=teams[home_code],
                away_team=teams[away_code],
                kickoff_time=kickoff,
            )

        group, _ = Group.objects.get_or_create(
            name="Demo Predictors",
            defaults={"description": "Sample prediction group", "created_by": demo},
        )
        GroupMember.objects.get_or_create(
            group=group, user=demo, defaults={"role": GroupMember.Role.ADMIN}
        )
        GroupMember.objects.get_or_create(group=group, user=admin)

        match_count = Match.objects.filter(tournament=tournament).count()
        self.stdout.write(self.style.SUCCESS("Seed data created successfully!"))
        self.stdout.write(f"Tournament: {tournament} — {match_count} group-stage matches")
        self.stdout.write("Admin: admin@worldcup.com / admin12345")
        self.stdout.write("Demo:  demo@worldcup.com / demo12345")
