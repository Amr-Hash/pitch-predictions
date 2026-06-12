from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tournaments.models import CupGroup, Match, Stage, Team, Tournament

User = get_user_model()


class AdminApiTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="regular",
            email="user@example.com",
            password="pass12345",
        )
        self.home = Team.objects.create(name="Egypt", code="EGY")
        self.away = Team.objects.create(name="Morocco", code="MAR")
        self.tournament = Tournament.objects.create(
            name="Test Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Group MD1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.cup_group = CupGroup.objects.create(
            tournament=self.tournament,
            name="A",
        )
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            cup_group=self.cup_group,
            matchday=1,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=1),
        )
        self.client = APIClient()

    def test_me_includes_is_staff(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_staff"])

    def test_admin_endpoints_require_staff(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/tournaments/admin/tournaments")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_list_tournaments(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get("/api/tournaments/admin/tournaments")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_admin_create_and_toggle_tournament(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            "/api/tournaments/admin/tournaments",
            {
                "name": "New Cup",
                "year": 2027,
                "start_date": "2027-06-01",
                "end_date": "2027-07-01",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tournament_id = response.data["id"]

        response = self.client.patch(
            f"/api/tournaments/admin/tournaments/{tournament_id}",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active"])

    def test_admin_create_stage(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            "/api/tournaments/admin/stages",
            {
                "tournament": self.tournament.id,
                "name": "Group MD2",
                "order": 2,
                "stage_type": "group",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_cup_group_crud(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            "/api/tournaments/admin/cup-groups",
            {
                "tournament": self.tournament.id,
                "name": "B",
                "team_ids": [self.home.id, self.away.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        group_id = response.data["id"]

        response = self.client.get(
            f"/api/tournaments/admin/cup-groups?tournament={self.tournament.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)

        response = self.client.patch(
            f"/api/tournaments/admin/cup-groups/{group_id}",
            {"team_ids": [self.away.id, self.home.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_create_team(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            "/api/tournaments/teams",
            {"name": "USA", "code": "USA", "flag_url": "https://flagcdn.com/w80/us.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_update_match_scores(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f"/api/tournaments/admin/matches/{self.match.id}",
            {
                "home_score": 2,
                "away_score": 1,
                "status": "finished",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["home_score"], 2)
        self.assertEqual(response.data["status"], "finished")

    def test_admin_finished_match_requires_scores(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f"/api/tournaments/admin/matches/{self.match.id}",
            {"status": "finished"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_create_match(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            "/api/tournaments/admin/matches",
            {
                "tournament": self.tournament.id,
                "stage": self.stage.id,
                "cup_group": self.cup_group.id,
                "matchday": 1,
                "home_team": self.home.id,
                "away_team": self.away.id,
                "kickoff_time": (timezone.now() + timedelta(days=2)).isoformat(),
                "status": "scheduled",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_list_matches_filtered(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get(
            f"/api/tournaments/admin/matches?tournament={self.tournament.id}&matchday=1"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)


class GroupStandingsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="standingsuser",
            email="standings@example.com",
            password="pass12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.tournament = Tournament.objects.create(
            name="Standings Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            standing_rules=Tournament.StandingRules.FIFA_WORLD_CUP,
            qualifiers_per_group=2,
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Group Stage",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.teams = {
            code: Team.objects.create(name=code, code=code)
            for code in ("AAA", "BBB", "CCC", "DDD")
        }
        self.cup_group = CupGroup.objects.create(
            tournament=self.tournament,
            name="A",
        )
        for order, code in enumerate(("AAA", "BBB", "CCC", "DDD")):
            self.cup_group.group_teams.create(
                team=self.teams[code],
                order=order,
            )

    def _finish(self, home_code, away_code, home_score, away_score, matchday=1):
        return Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            cup_group=self.cup_group,
            matchday=matchday,
            home_team=self.teams[home_code],
            away_team=self.teams[away_code],
            kickoff_time=timezone.now() - timedelta(days=1),
            status=Match.Status.FINISHED,
            home_score=home_score,
            away_score=away_score,
        )

    def test_standings_points_and_goal_difference(self):
        self._finish("AAA", "BBB", 2, 0)
        self._finish("CCC", "DDD", 1, 1)

        response = self.client.get(f"/api/tournaments/{self.tournament.id}/standings")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group = response.data["groups"][0]
        by_code = {row["team"]["code"]: row for row in group["standings"]}

        self.assertEqual(by_code["AAA"]["points"], 3)
        self.assertEqual(by_code["AAA"]["goal_difference"], 2)
        self.assertEqual(by_code["AAA"]["rank"], 1)
        self.assertTrue(by_code["AAA"]["qualifies"])
        self.assertEqual(by_code["CCC"]["points"], 1)
        self.assertEqual(by_code["CCC"]["goals_for"], 1)
        self.assertEqual(by_code["CCC"]["goals_against"], 1)

    def test_fifa_ranks_by_goal_difference_when_points_tied(self):
        self._finish("AAA", "BBB", 2, 0)
        self._finish("CCC", "DDD", 1, 0)
        self._finish("AAA", "CCC", 0, 0)
        self._finish("BBB", "DDD", 1, 0)

        response = self.client.get(f"/api/tournaments/{self.tournament.id}/standings")
        group = response.data["groups"][0]
        ranked_codes = [row["team"]["code"] for row in group["standings"]]
        self.assertEqual(ranked_codes[0], "AAA")

    def test_uefa_head_to_head_breaks_two_team_tie(self):
        self.tournament.standing_rules = Tournament.StandingRules.UEFA_CHAMPIONS_LEAGUE
        self.tournament.save(update_fields=["standing_rules"])

        self._finish("AAA", "BBB", 1, 0)
        self._finish("AAA", "CCC", 0, 0)
        self._finish("BBB", "CCC", 1, 0)

        response = self.client.get(f"/api/tournaments/{self.tournament.id}/standings")
        group = response.data["groups"][0]
        by_code = {row["team"]["code"]: row for row in group["standings"]}

        self.assertEqual(by_code["AAA"]["points"], 4)
        self.assertEqual(by_code["BBB"]["points"], 3)
        self.assertEqual(by_code["AAA"]["rank"], 1)
        self.assertEqual(by_code["BBB"]["rank"], 2)
        self.assertTrue(by_code["AAA"]["qualifies"])
        self.assertTrue(by_code["BBB"]["qualifies"])

    def test_uefa_head_to_head_wins_when_points_are_level(self):
        self.tournament.standing_rules = Tournament.StandingRules.UEFA_CHAMPIONS_LEAGUE
        self.tournament.save(update_fields=["standing_rules"])

        self._finish("AAA", "BBB", 1, 0)
        self._finish("AAA", "CCC", 0, 0)
        self._finish("DDD", "AAA", 1, 0)
        self._finish("BBB", "CCC", 1, 0)
        self._finish("BBB", "DDD", 0, 0)
        self._finish("CCC", "DDD", 0, 0)

        response = self.client.get(f"/api/tournaments/{self.tournament.id}/standings")
        group = response.data["groups"][0]
        by_code = {row["team"]["code"]: row for row in group["standings"]}

        self.assertEqual(by_code["DDD"]["rank"], 1)
        self.assertEqual(by_code["AAA"]["points"], by_code["BBB"]["points"])
        self.assertLess(by_code["AAA"]["rank"], by_code["BBB"]["rank"])
