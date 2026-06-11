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
