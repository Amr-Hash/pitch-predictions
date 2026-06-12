from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from groups.models import Group, GroupMember
from tournaments.ar_translations import (
    DEMO_TEST_CUP_AR,
    WC2026_TOURNAMENT_AR,
    cup_group_name_ar,
    stage_name_ar,
    team_name_ar,
)
from tournaments.models import CupGroup, CupGroupTeam, Match, Stage, Team, Tournament
from tournaments.test_tournament_data import build_test_tournament_schedule
from tournaments.wc2026_data import (
    WC2026_GROUP_MATCHES,
    WC2026_GROUPS,
    WC2026_TEAMS,
    WC2026_TOURNAMENT,
)

User = get_user_model()

STAGES_CONFIG = [
    ("Group Stage", 1, Stage.StageType.GROUP),
    ("Round of 32", 4, Stage.StageType.KNOCKOUT),
    ("Round of 16", 5, Stage.StageType.KNOCKOUT),
    ("Quarter Finals", 6, Stage.StageType.KNOCKOUT),
    ("Semi Finals", 7, Stage.StageType.KNOCKOUT),
    ("Third Place Match", 8, Stage.StageType.KNOCKOUT),
    ("Final", 9, Stage.StageType.KNOCKOUT),
]

TEST_STAGES_CONFIG = [
    ("Group Stage", 1, Stage.StageType.GROUP),
]


class Command(BaseCommand):
    help = "Seed tournament data and demo accounts for الهبيد (Al-Habeed)"

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")

        legacy_accounts = [
            ("admin@worldcup.com", "admin_worldcup_legacy"),
            ("demo@worldcup.com", "demo_worldcup_legacy"),
        ]
        for email, legacy_username in legacy_accounts:
            User.objects.filter(email=email).update(
                is_active=False,
                username=legacy_username,
            )

        admin, _ = User.objects.get_or_create(
            email="admin@alhabeed.com",
            defaults={"username": "admin", "is_staff": True, "is_superuser": True},
        )
        admin.username = admin.username or "admin"
        admin.is_staff = True
        admin.is_superuser = True
        admin.is_active = True
        admin.set_password("admin12345")
        admin.save()

        demo, _ = User.objects.get_or_create(
            email="demo@alhabeed.com",
            defaults={"username": "demo"},
        )
        demo.is_active = True
        demo.set_password("demo12345")
        demo.save()

        teams = self._seed_teams(WC2026_TEAMS)
        wc_count = self._seed_wc_tournament(teams)
        test_schedule = build_test_tournament_schedule()
        test_count = self._seed_test_tournament(teams, test_schedule)

        group, _ = Group.objects.get_or_create(
            name="Demo Predictors",
            defaults={"description": "Sample prediction group", "created_by": demo},
        )
        GroupMember.objects.get_or_create(
            group=group, user=demo, defaults={"role": GroupMember.Role.ADMIN}
        )
        GroupMember.objects.get_or_create(group=group, user=admin)

        self.stdout.write(self.style.SUCCESS("Seed data created successfully!"))
        self.stdout.write(f"FIFA World Cup (2026): {wc_count} group-stage matches")
        self.stdout.write(
            f"Demo Test Cup: {test_count} matches — "
            f"{test_schedule['start_cairo'].strftime('%a %d %b %Y %H:%M')}–"
            f"{test_schedule['end_cairo'].strftime('%H:%M')} Egypt time"
        )
        self.stdout.write("Admin: admin@alhabeed.com / admin12345")
        self.stdout.write("Demo:  demo@alhabeed.com / demo12345")

    def _seed_teams(self, team_rows):
        teams = {}
        for name, code, flag_iso in team_rows:
            flag_url = f"https://flagcdn.com/w80/{flag_iso}.png"
            team, _ = Team.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "name_ar": team_name_ar(code, name),
                    "flag_url": flag_url,
                },
            )
            teams[code] = team
        return teams

    def _create_stages(self, tournament, stages_config):
        stages = {}
        for name, order, stage_type in stages_config:
            stage, _ = Stage.objects.update_or_create(
                tournament=tournament,
                order=order,
                defaults={
                    "name": name,
                    "name_ar": stage_name_ar(name),
                    "stage_type": stage_type,
                },
            )
            stages[order] = stage
        return stages

    def _create_cup_groups(self, tournament, group_map, teams):
        cup_groups = {}
        for letter, team_codes in group_map.items():
            cup_group, _ = CupGroup.objects.update_or_create(
                tournament=tournament,
                name=letter,
                defaults={"name_ar": cup_group_name_ar(letter)},
            )
            if not cup_group.name_ar:
                cup_group.name_ar = cup_group_name_ar(letter)
                cup_group.save(update_fields=["name_ar"])
            cup_groups[letter] = cup_group
            CupGroupTeam.objects.filter(cup_group=cup_group).delete()
            for order, code in enumerate(team_codes):
                CupGroupTeam.objects.create(
                    cup_group=cup_group,
                    team=teams[code],
                    order=order,
                )
        return cup_groups

    def _seed_wc_tournament(self, teams):
        tournament, created = Tournament.objects.update_or_create(
            name=WC2026_TOURNAMENT["name"],
            year=WC2026_TOURNAMENT["year"],
            defaults={
                "name_ar": WC2026_TOURNAMENT_AR,
                "start_date": WC2026_TOURNAMENT["start_date"],
                "end_date": WC2026_TOURNAMENT["end_date"],
            },
        )
        update_fields = []
        if created:
            tournament.is_active = True
            update_fields.append("is_active")
        if not tournament.name_ar:
            tournament.name_ar = WC2026_TOURNAMENT_AR
            update_fields.append("name_ar")
        if update_fields:
            tournament.save(update_fields=update_fields)

        if Match.objects.filter(tournament=tournament).exists():
            return Match.objects.filter(tournament=tournament).count()

        stages = self._create_stages(tournament, STAGES_CONFIG)
        cup_groups = self._create_cup_groups(tournament, WC2026_GROUPS, teams)

        for group_letter, matchday, home_code, away_code, kickoff in WC2026_GROUP_MATCHES:
            if isinstance(kickoff, str):
                from datetime import datetime

                kickoff = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
            Match.objects.create(
                tournament=tournament,
                stage=stages[1],
                cup_group=cup_groups[group_letter],
                matchday=matchday,
                home_team=teams[home_code],
                away_team=teams[away_code],
                kickoff_time=kickoff,
            )
        return Match.objects.filter(tournament=tournament).count()

    def _seed_test_tournament(self, teams, schedule):
        tournament, created = Tournament.objects.update_or_create(
            name=schedule["name"],
            year=schedule["year"],
            defaults={
                "name_ar": DEMO_TEST_CUP_AR,
                "start_date": schedule["start_date"],
                "end_date": schedule["end_date"],
            },
        )
        update_fields = []
        if created:
            tournament.is_active = True
            update_fields.append("is_active")
        if not tournament.name_ar:
            tournament.name_ar = DEMO_TEST_CUP_AR
            update_fields.append("name_ar")
        if update_fields:
            tournament.save(update_fields=update_fields)

        if Match.objects.filter(tournament=tournament).exists():
            return Match.objects.filter(tournament=tournament).count()

        stages = self._create_stages(tournament, TEST_STAGES_CONFIG)
        cup_groups = self._create_cup_groups(tournament, schedule["groups"], teams)

        for group_letter, matchday, home_code, away_code, kickoff in schedule["matches"]:
            Match.objects.create(
                tournament=tournament,
                stage=stages[1],
                cup_group=cup_groups[group_letter],
                matchday=matchday,
                home_team=teams[home_code],
                away_team=teams[away_code],
                kickoff_time=kickoff,
            )
        return Match.objects.filter(tournament=tournament).count()
