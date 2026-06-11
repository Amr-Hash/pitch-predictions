from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from groups.models import Group, GroupMember
from tournaments.models import Match, Stage, Team, Tournament
from predictions.models import Prediction
from predictions.services.scoring import calculate_prediction_points, ScoreBreakdown

User = get_user_model()


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_and_login(self):
        response = self.client.post(
            "/api/auth/register",
            {
                "username": "testuser",
                "email": "test@example.com",
                "password": "testpass123",
                "password_confirm": "testpass123",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            "/api/auth/login",
            {"email": "test@example.com", "password": "testpass123"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_register_password_mismatch(self):
        response = self.client.post(
            "/api/auth/register",
            {
                "username": "testuser",
                "email": "test@example.com",
                "password": "testpass123",
                "password_confirm": "wrongpass",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class GroupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="groupuser", email="group@example.com", password="pass12345"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_and_join_group(self):
        response = self.client.post(
            "/api/groups",
            {"name": "Test Group", "description": "A test group"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invite_code = response.data["invite_code"]

        other = User.objects.create_user(
            username="other", email="other@example.com", password="pass12345"
        )
        self.client.force_authenticate(user=other)
        response = self.client.post(
            "/api/groups/join", {"invite_code": invite_code}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class ScoringEngineTests(TestCase):
    def setUp(self):
        self.home = Team.objects.create(name="Home", code="HOM")
        self.away = Team.objects.create(name="Away", code="AWY")
        self.tournament = Tournament.objects.create(
            name="Test Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament, name="Group Day 1", order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.knockout_stage = Stage.objects.create(
            tournament=self.tournament, name="Final", order=2,
            stage_type=Stage.StageType.KNOCKOUT,
        )

    def _make_match(self, home_score, away_score, knockout=False, winner=None):
        stage = self.knockout_stage if knockout else self.stage
        return Match.objects.create(
            tournament=self.tournament,
            stage=stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() - timedelta(hours=2),
            status=Match.Status.FINISHED,
            home_score=home_score,
            away_score=away_score,
            winner_team=winner,
        )

    def _make_prediction(self, match, home, away, winner=None):
        user = User.objects.create_user(
            username="preduser", email="pred@example.com", password="pass"
        )
        return Prediction.objects.create(
            user=user, match=match,
            predicted_home_score=home, predicted_away_score=away,
            predicted_winner_team=winner,
        )

    def test_exact_score(self):
        match = self._make_match(2, 1)
        pred = self._make_prediction(match, 2, 1)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 5)
        self.assertEqual(result.total_points, 5)

    def test_goal_difference(self):
        match = self._make_match(2, 0)
        pred = self._make_prediction(match, 3, 1)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.goal_difference_points, 3)
        self.assertEqual(result.total_points, 3)

    def test_correct_outcome(self):
        match = self._make_match(2, 1)
        pred = self._make_prediction(match, 3, 0)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.outcome_points, 1)
        self.assertEqual(result.goal_difference_points, 0)
        self.assertEqual(result.total_points, 1)

    def test_draw_goal_difference(self):
        match = self._make_match(2, 2)
        pred = self._make_prediction(match, 0, 0)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.goal_difference_points, 3)
        self.assertEqual(result.total_points, 3)

    def test_incorrect_prediction(self):
        match = self._make_match(0, 2)
        pred = self._make_prediction(match, 2, 1)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.total_points, 0)

    def test_knockout_winner_bonus(self):
        match = self._make_match(1, 1, knockout=True, winner=self.home)
        pred = self._make_prediction(match, 1, 1, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 5)
        self.assertEqual(result.winner_bonus_points, 1)
        self.assertEqual(result.total_points, 6)

    def test_knockout_winner_point_when_score_wrong(self):
        match = self._make_match(2, 1, knockout=True)
        pred = self._make_prediction(match, 1, 1, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 0)
        self.assertEqual(result.winner_bonus_points, 1)
        self.assertEqual(result.total_points, 1)

    def test_knockout_wrong_advancing_team_on_tie_exact_score(self):
        match = self._make_match(1, 1, knockout=True, winner=self.home)
        pred = self._make_prediction(match, 1, 1, winner=self.away)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 5)
        self.assertEqual(result.winner_bonus_points, 0)
        self.assertEqual(result.total_points, 5)

    def test_correct_outcome_only_when_goal_diff_differs(self):
        match = self._make_match(3, 1)
        pred = self._make_prediction(match, 4, 1)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.outcome_points, 1)
        self.assertEqual(result.total_points, 1)

    def test_away_win_outcome_only(self):
        match = self._make_match(0, 3)
        pred = self._make_prediction(match, 0, 2)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.outcome_points, 1)
        self.assertEqual(result.total_points, 1)


class ScoringIntegrationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="adminscore",
            email="adminscore@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="scoreuser", email="scoreuser@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="Home", code="HSC")
        self.away = Team.objects.create(name="Away", code="ASC")
        self.tournament = Tournament.objects.create(
            name="Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Day 1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=2),
        )
        self.prediction = Prediction.objects.create(
            user=self.user,
            match=self.match,
            predicted_home_score=3,
            predicted_away_score=0,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_admin_finish_match_awards_outcome_point(self):
        response = self.client.patch(
            f"/api/tournaments/admin/matches/{self.match.id}",
            {
                "status": Match.Status.FINISHED,
                "home_score": 2,
                "away_score": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.prediction.refresh_from_db()
        self.assertEqual(self.prediction.points_awarded, 1)


class PredictionLockTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="lockuser", email="lock@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="Home", code="H1")
        self.away = Team.objects.create(name="Away", code="A1")
        self.tournament = Tournament.objects.create(
            name="Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament, name="Day 1", order=1,
        )
        self.group = Group.objects.create(name="Lock Group", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_locked_prediction_rejected(self):
        match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(minutes=30),
        )
        response = self.client.post(
            "/api/predictions/",
            {
                "match": match.id,
                "predicted_home_score": 1,
                "predicted_away_score": 0,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("closed", str(response.data).lower())


class MatchdayLockTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mduser", email="md@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="Home", code="HM")
        self.away = Team.objects.create(name="Away", code="AW")
        self.tournament = Tournament.objects.create(
            name="Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage1 = Stage.objects.create(
            tournament=self.tournament,
            name="Matchday 1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.stage2 = Stage.objects.create(
            tournament=self.tournament,
            name="Matchday 2",
            order=2,
            stage_type=Stage.StageType.GROUP,
        )
        self.group = Group.objects.create(name="MD Group", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        self.md1_match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage1,
            matchday=1,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=5),
        )
        self.md2_match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage2,
            matchday=2,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=10),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_matchday_two_locked_until_matchday_one_finishes(self):
        self.assertTrue(self.md2_match.is_matchday_locked)
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.md2_match.id,
                "predicted_home_score": 1,
                "predicted_away_score": 0,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("matchday 1", str(response.data).lower())

    def test_matchday_two_unlocks_after_matchday_one_complete(self):
        self.md1_match.status = Match.Status.FINISHED
        self.md1_match.home_score = 1
        self.md1_match.away_score = 0
        self.md1_match.save()
        self.assertFalse(self.md2_match.is_matchday_locked)
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.md2_match.id,
                "predicted_home_score": 2,
                "predicted_away_score": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class StageProgressionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="stageuser", email="stage@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="H", code="HH")
        self.away = Team.objects.create(name="A", code="AA")
        self.tournament = Tournament.objects.create(
            name="Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage1 = Stage.objects.create(
            tournament=self.tournament, name="Round of 32", order=1,
            stage_type=Stage.StageType.KNOCKOUT,
        )
        self.stage2 = Stage.objects.create(
            tournament=self.tournament, name="Round of 16", order=2,
            stage_type=Stage.StageType.KNOCKOUT,
        )
        self.group = Group.objects.create(name="Stage Group", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        self.match1 = Match.objects.create(
            tournament=self.tournament, stage=self.stage1,
            home_team=self.home, away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=2),
        )
        self.match2 = Match.objects.create(
            tournament=self.tournament, stage=self.stage2,
            home_team=self.home, away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=3),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_stage_progression_blocks_next_stage(self):
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.match2.id,
                "predicted_home_score": 1,
                "predicted_away_score": 0,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("previous stage", str(response.data).lower())

    def test_stage_progression_allows_after_completion(self):
        Prediction.objects.create(
            user=self.user, match=self.match1,
            predicted_home_score=1, predicted_away_score=0,
        )
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.match2.id,
                "predicted_home_score": 2,
                "predicted_away_score": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class LeaderboardTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="leader", email="leader@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="H", code="LH")
        self.away = Team.objects.create(name="A", code="LA")
        self.tournament = Tournament.objects.create(
            name="Cup", year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament, name="Day 1", order=1,
        )
        self.group = Group.objects.create(name="Leader Group", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        self.match = Match.objects.create(
            tournament=self.tournament, stage=self.stage,
            home_team=self.home, away_team=self.away,
            kickoff_time=timezone.now() - timedelta(days=1),
            status=Match.Status.FINISHED,
            home_score=2, away_score=1,
        )
        Prediction.objects.create(
            user=self.user, match=self.match,
            predicted_home_score=2, predicted_away_score=1,
            points_awarded=5,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_group_leaderboard(self):
        response = self.client.get(f"/api/leaderboards/group/{self.group.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["total_points"], 5)
        self.assertEqual(response.data[0]["rank"], 1)

    def test_global_leaderboard(self):
        response = self.client.get("/api/leaderboards/global")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)
