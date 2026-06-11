from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from groups.models import Group, GroupMember
from tournaments.models import Match, Stage, Team, Tournament
from predictions.models import Prediction

User = get_user_model()


class KnockoutValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ko_user", email="ko@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="Home", code="KH")
        self.away = Team.objects.create(name="Away", code="KA")
        self.tournament = Tournament.objects.create(
            name="Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament, name="Final", order=1,
            stage_type=Stage.StageType.KNOCKOUT,
        )
        self.group = Group.objects.create(name="KO Group", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        self.match = Match.objects.create(
            tournament=self.tournament, stage=self.stage,
            home_team=self.home, away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=2),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_knockout_tie_requires_winner(self):
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.match.id,
                "predicted_home_score": 1,
                "predicted_away_score": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("advances", str(response.data).lower())


class DashboardTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dash", email="dash@example.com", password="pass12345"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.tournament = Tournament.objects.create(
            name="World Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Group Stage — Matchday 1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        home = Team.objects.create(name="Home", code="HOM")
        away = Team.objects.create(name="Away", code="AWY")
        Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=home,
            away_team=away,
            kickoff_time=timezone.now() - timedelta(days=1),
            status=Match.Status.FINISHED,
            home_score=2,
            away_score=1,
        )

    def test_dashboard_returns_data(self):
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("groups", response.data)
        self.assertIn("total_points", response.data)

    def test_dashboard_with_tournament_filter(self):
        response = self.client.get(f"/api/dashboard?tournament={self.tournament.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["recent_results"]), 1)


class LogoutTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="logout", email="logout@example.com", password="pass12345"
        )
        self.client = APIClient()

    def test_me_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "logout@example.com")

    def test_password_reset_request(self):
        response = self.client.post(
            "/api/auth/password-reset", {"email": "logout@example.com"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_logout_blacklists_token(self):
        login = self.client.post(
            "/api/auth/login",
            {"email": "logout@example.com", "password": "pass12345"},
        )
        refresh = login.data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.post("/api/auth/logout", {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class AdminUserListTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="siteadmin",
            email="admin@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="regular", email="user@example.com", password="pass12345"
        )
        self.group = Group.objects.create(name="League", created_by=self.user)
        GroupMember.objects.create(group=self.group, user=self.user)
        self.client = APIClient()

    def test_admin_can_list_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/auth/admin/users")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)
        regular = next(row for row in response.data if row["username"] == "regular")
        self.assertEqual(regular["group_count"], 1)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/auth/admin/users")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminGroupListTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="gadmin",
            email="gadmin@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="gm1", email="gm1@example.com", password="pass12345"
        )
        self.other = User.objects.create_user(
            username="gm2", email="gm2@example.com", password="pass12345"
        )
        self.group = Group.objects.create(name="Friends", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        GroupMember.objects.create(group=self.group, user=self.other)
        self.client = APIClient()

    def test_admin_can_list_all_groups(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/groups/admin")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["member_count"], 2)

    def test_admin_can_view_group_members(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/groups/admin/{self.group.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["members"]), 2)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/groups/admin")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TournamentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tourn", email="tourn@example.com", password="pass12345"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        Tournament.objects.create(
            name="World Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )

    def test_list_tournaments(self):
        response = self.client.get("/api/tournaments")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
