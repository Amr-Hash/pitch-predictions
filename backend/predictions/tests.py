from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
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

    def test_knockout_draw_correct_advancing_team(self):
        match = self._make_match(1, 1, knockout=True, winner=self.home)
        pred = self._make_prediction(match, 1, 1, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 5)
        self.assertEqual(result.winner_bonus_points, 0)
        self.assertEqual(result.total_points, 5)

    def test_knockout_draw_wrong_advancing_team_exact_score(self):
        match = self._make_match(1, 1, knockout=True, winner=self.home)
        pred = self._make_prediction(match, 1, 1, winner=self.away)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 0)
        self.assertEqual(result.goal_difference_points, 3)
        self.assertEqual(result.total_points, 3)

    def test_knockout_draw_correct_advancing_team_different_draw_score(self):
        match = self._make_match(1, 1, knockout=True, winner=self.home)
        pred = self._make_prediction(match, 0, 0, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.total_points, 5)

    def test_knockout_draw_wrong_advancing_team_different_draw_score(self):
        match = self._make_match(2, 2, knockout=True, winner=self.away)
        pred = self._make_prediction(match, 0, 0, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.total_points, 3)

    def test_knockout_winner_point_when_score_wrong(self):
        match = self._make_match(2, 1, knockout=True)
        pred = self._make_prediction(match, 1, 1, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.exact_score_points, 0)
        self.assertEqual(result.winner_bonus_points, 1)
        self.assertEqual(result.total_points, 1)

    def test_knockout_winner_point_on_draw_prediction_vs_decisive_result(self):
        match = self._make_match(5, 2, knockout=True)
        pred = self._make_prediction(match, 0, 0, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.total_points, 1)

    def test_knockout_advancing_team_from_score_not_stale_winner_field(self):
        match = self._make_match(5, 2, knockout=True, winner=self.away)
        pred = self._make_prediction(match, 0, 0, winner=self.home)
        result = calculate_prediction_points(pred, match)
        self.assertEqual(result.total_points, 1)

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

    def test_admin_finish_knockout_awards_advancing_team_point(self):
        knockout_stage = Stage.objects.create(
            tournament=self.tournament,
            name="Final",
            order=2,
            stage_type=Stage.StageType.KNOCKOUT,
        )
        knockout_match = Match.objects.create(
            tournament=self.tournament,
            stage=knockout_stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=2),
        )
        prediction = Prediction.objects.create(
            user=self.user,
            match=knockout_match,
            predicted_home_score=0,
            predicted_away_score=0,
            predicted_winner_team=self.home,
        )
        response = self.client.patch(
            f"/api/tournaments/admin/matches/{knockout_match.id}",
            {
                "status": Match.Status.FINISHED,
                "home_score": 5,
                "away_score": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prediction.refresh_from_db()
        self.assertEqual(prediction.points_awarded, 1)

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

    def test_prediction_allowed_until_kickoff(self):
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
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_locked_prediction_rejected_after_kickoff(self):
        match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() - timedelta(minutes=1),
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
        self.group_stage = Stage.objects.create(
            tournament=self.tournament,
            name="Group Stage",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.group = Group.objects.create(name="MD Group", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        self.md1_match = Match.objects.create(
            tournament=self.tournament,
            stage=self.group_stage,
            matchday=1,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=5),
        )
        self.md2_match = Match.objects.create(
            tournament=self.tournament,
            stage=self.group_stage,
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

    def test_stage_completion_blocks_next_stage_until_games_finish(self):
        self.assertTrue(self.match2.is_stage_locked)
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.match2.id,
                "predicted_home_score": 1,
                "predicted_away_score": 0,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("previous round", str(response.data).lower())

    def test_stage_completion_allows_after_games_finish_without_prior_prediction(self):
        self.match1.status = Match.Status.FINISHED
        self.match1.home_score = 1
        self.match1.away_score = 0
        self.match1.save()
        self.assertFalse(self.match2.is_stage_locked)
        response = self.client.post(
            "/api/predictions/",
            {
                "match": self.match2.id,
                "predicted_home_score": 2,
                "predicted_away_score": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class GroupMemberViewsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="gmember", email="gmember@example.com", password="pass12345"
        )
        self.other = User.objects.create_user(
            username="gother", email="gother@example.com", password="pass12345"
        )
        self.outsider = User.objects.create_user(
            username="goutsider", email="outsider@example.com", password="pass12345"
        )
        self.group = Group.objects.create(name="Friends", created_by=self.user)
        GroupMember.objects.create(
            group=self.group, user=self.user, role=GroupMember.Role.ADMIN
        )
        GroupMember.objects.create(group=self.group, user=self.other)
        self.home = Team.objects.create(name="Home", code="GHM")
        self.away = Team.objects.create(name="Away", code="GAW")
        self.tournament = Tournament.objects.create(
            name="Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament, name="Day 1", order=1,
        )
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(days=2),
        )
        Prediction.objects.create(
            user=self.user,
            match=self.match,
            predicted_home_score=2,
            predicted_away_score=1,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_group_members_visible_to_member(self):
        response = self.client.get(f"/api/groups/{self.group.id}/members")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        usernames = {row["username"] for row in response.data}
        self.assertEqual(usernames, {"gmember", "gother"})

    def test_group_members_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/groups/{self.group.id}/members")
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_group_predictions_for_tournament(self):
        response = self.client.get(
            f"/api/groups/{self.group.id}/predictions",
            {"tournament": self.tournament.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["members"]), 2)
        self.assertEqual(len(response.data["matches"]), 1)
        preds = response.data["matches"][0]["predictions"]
        self.assertEqual(len(preds), 2)
        by_user = {row["username"]: row for row in preds}
        self.assertTrue(by_user["gmember"]["has_prediction"])
        self.assertTrue(by_user["gmember"]["is_hidden"])
        self.assertIsNone(by_user["gmember"]["predicted_home_score"])
        self.assertFalse(by_user["gother"]["has_prediction"])
        self.assertIsNone(by_user["gother"]["predicted_home_score"])

    def test_group_predictions_require_tournament(self):
        response = self.client.get(f"/api/groups/{self.group.id}/predictions")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_remove_member(self):
        other_membership = self.group.memberships.get(user=self.other)
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{other_membership.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(self.group.memberships.filter(user=self.other).exists())

    def test_cannot_remove_group_creator(self):
        creator_membership = self.group.memberships.get(user=self.user)
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{creator_membership.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_remove_member(self):
        other_membership = self.group.memberships.get(user=self.other)
        self.client.force_authenticate(user=self.other)
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{other_membership.id}"
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_member_can_leave_group(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.post(f"/api/groups/{self.group.id}/leave")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(self.group.memberships.filter(user=self.other).exists())

    def test_creator_cannot_leave_group(self):
        response = self.client.post(f"/api/groups/{self.group.id}/leave")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(self.group.memberships.filter(user=self.user).exists())


class LeaderboardTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
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


class CompetitionRankTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alpha", email="alpha@example.com", password="pass12345"
        )
        self.tie_user = User.objects.create_user(
            username="zulu", email="zulu@example.com", password="pass12345"
        )
        self.third = User.objects.create_user(
            username="middle", email="middle@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="H", code="TH")
        self.away = Team.objects.create(name="A", code="TA")
        self.tournament = Tournament.objects.create(
            name="Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament, name="Day 1", order=1
        )
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() - timedelta(days=1),
            status=Match.Status.FINISHED,
            home_score=2,
            away_score=1,
        )
        for user, points in (
            (self.user, 10),
            (self.tie_user, 10),
            (self.third, 5),
        ):
            Prediction.objects.create(
                user=user,
                match=self.match,
                predicted_home_score=2,
                predicted_away_score=1,
                points_awarded=points,
            )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_tied_points_share_rank_on_global_leaderboard(self):
        response = self.client.get(
            f"/api/leaderboards/global?tournament={self.tournament.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ranks = {row["username"]: row["rank"] for row in response.data}
        self.assertEqual(ranks["alpha"], 1)
        self.assertEqual(ranks["zulu"], 1)
        self.assertEqual(ranks["middle"], 2)

    def test_global_podium_includes_all_tied_leaders(self):
        from predictions.services.leaderboard import global_podium_for_user

        podium = global_podium_for_user(self.tournament.id, self.user.id)
        rank_one = [entry for entry in podium if entry["rank"] == 1]
        self.assertEqual(len(rank_one), 2)
        self.assertEqual({entry["username"] for entry in rank_one}, {"alpha", "zulu"})
        rank_two = [entry for entry in podium if entry["rank"] == 2]
        self.assertEqual(len(rank_two), 1)
        self.assertEqual(rank_two[0]["username"], "middle")

    def test_group_leaderboard_sorted_by_rank(self):
        group = Group.objects.create(name="Rank Group", created_by=self.user)
        for user in (self.third, self.tie_user, self.user):
            GroupMember.objects.create(group=group, user=user, role=GroupMember.Role.MEMBER)

        from predictions.services.leaderboard import rebuild_group_leaderboard_entries

        rebuild_group_leaderboard_entries(group, self.tournament.id)

        response = self.client.get(
            f"/api/leaderboards/group/{group.id}?tournament={self.tournament.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["username"] for row in response.data],
            ["alpha", "zulu", "middle"],
        )
        self.assertEqual([row["rank"] for row in response.data], [1, 1, 2])


class NotificationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="notifadmin",
            email="notifadmin@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="notifuser", email="notifuser@example.com", password="pass12345"
        )
        self.other = User.objects.create_user(
            username="otheruser", email="other@example.com", password="pass12345"
        )
        self.spectator = User.objects.create_user(
            username="spectator", email="spectator@example.com", password="pass12345"
        )
        self.home = Team.objects.create(name="Home", code="NH")
        self.away = Team.objects.create(name="Away", code="NA")
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
        self.group = Group.objects.create(name="Notif Group", created_by=self.user)
        for member in (self.user, self.other, self.spectator):
            GroupMember.objects.create(
                group=self.group,
                user=member,
                role=GroupMember.Role.ADMIN if member == self.user else GroupMember.Role.MEMBER,
            )
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() - timedelta(hours=2),
        )
        Prediction.objects.create(
            user=self.user,
            match=self.match,
            predicted_home_score=2,
            predicted_away_score=1,
        )
        Prediction.objects.create(
            user=self.other,
            match=self.match,
            predicted_home_score=0,
            predicted_away_score=1,
        )
        from tournaments.models import TournamentSubscription

        for member in (self.user, self.other, self.spectator):
            TournamentSubscription.objects.create(
                user=member, tournament=self.tournament
            )
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)
        self.user_client = APIClient()
        self.user_client.force_authenticate(user=self.user)

    def test_match_finish_creates_match_result_notification(self):
        with (
            patch("predictions.services.notifications.push_configured", return_value=True),
            patch(
                "predictions.services.notifications.send_push_to_user", return_value=1
            ) as mock_push,
        ):
            response = self.admin_client.patch(
                f"/api/tournaments/admin/matches/{self.match.id}",
                {
                    "status": Match.Status.FINISHED,
                    "home_score": 2,
                    "away_score": 1,
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        from notifications.models import Notification

        notification = Notification.objects.get(
            user=self.user,
            notification_type=Notification.Type.MATCH_RESULT,
        )
        self.assertFalse(notification.is_read)
        self.assertEqual(notification.payload["points_awarded"], 5)
        self.assertEqual(notification.payload["home_score"], 2)
        self.assertEqual(notification.payload["global_rank"], 1)
        self.assertGreaterEqual(mock_push.call_count, 1)
        match_push = next(
            call
            for call in mock_push.call_args_list
            if call.kwargs.get("url") == "/leaderboards"
            and "pts" in call.kwargs.get("body", "")
        )
        self.assertIn("Home", match_push.kwargs["title"])

    def test_podium_change_notifies_all_group_members(self):
        with (
            patch("predictions.services.notifications.push_configured", return_value=True),
            patch(
                "predictions.services.notifications.send_push_to_user", return_value=1
            ) as mock_push,
        ):
            self.admin_client.patch(
                f"/api/tournaments/admin/matches/{self.match.id}",
                {
                    "status": Match.Status.FINISHED,
                    "home_score": 2,
                    "away_score": 1,
                },
                format="json",
            )

        from notifications.models import Notification

        podium_notifications = Notification.objects.filter(
            notification_type=Notification.Type.GROUP_PODIUM,
            payload__group_id=self.group.id,
        )
        self.assertEqual(podium_notifications.count(), 3)
        self.assertTrue(
            podium_notifications.filter(user=self.spectator).exists()
        )
        self.assertGreaterEqual(mock_push.call_count, 3)
        podium_push = next(
            call
            for call in mock_push.call_args_list
            if call.kwargs.get("url") == f"/leaderboards?group={self.group.id}"
        )
        self.assertIn(self.group.name, podium_push.kwargs["title"])

    def test_scoring_push_not_sent_when_notification_already_exists(self):
        from notifications.models import Notification

        Notification.objects.create(
            user=self.user,
            notification_type=Notification.Type.MATCH_RESULT,
            dedup_key=f"match_result:{self.match.id}",
            payload={"match_id": self.match.id},
        )
        with patch(
            "predictions.services.notifications.send_push_to_user", return_value=1
        ) as mock_push:
            self.admin_client.patch(
                f"/api/tournaments/admin/matches/{self.match.id}",
                {
                    "status": Match.Status.FINISHED,
                    "home_score": 2,
                    "away_score": 1,
                },
                format="json",
            )
        mock_push.assert_not_called()

    def test_notification_mark_read_and_mark_all(self):
        self.admin_client.patch(
            f"/api/tournaments/admin/matches/{self.match.id}",
            {
                "status": Match.Status.FINISHED,
                "home_score": 2,
                "away_score": 1,
            },
            format="json",
        )

        list_response = self.user_client.get("/api/notifications")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreater(list_response.data["unread_count"], 0)
        notification_id = list_response.data["results"][0]["id"]

        read_response = self.user_client.post(
            f"/api/notifications/{notification_id}/read"
        )
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertTrue(read_response.data["is_read"])

        mark_all = self.user_client.post("/api/notifications/mark-all-read")
        self.assertEqual(mark_all.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.user_client.get("/api/notifications").data["unread_count"], 0
        )


class DashboardPendingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dashuser",
            email="dash@example.com",
            password="pass12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.tournament = Tournament.objects.create(
            name="Dash Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="MD1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.home = Team.objects.create(name="Home", code="HOM")
        self.away = Team.objects.create(name="Away", code="AWY")

    def _create_open_match(self, *, offset_hours: int):
        return Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(hours=offset_hours),
            status=Match.Status.SCHEDULED,
            matchday=1,
        )

    def test_dashboard_returns_all_predictable_matches_not_only_ten(self):
        for index in range(12):
            self._create_open_match(offset_hours=24 + index)

        response = self.client.get(f"/api/dashboard?tournament={self.tournament.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pending_count"], 12)
        self.assertEqual(len(response.data["pending_predictions"]), 12)
        self.assertEqual(len(response.data["upcoming_matches"]), 12)

    def test_dashboard_excludes_locked_and_predicted_matches(self):
        open_match = self._create_open_match(offset_hours=48)
        locked_match = self._create_open_match(offset_hours=72)
        locked_match.kickoff_time = timezone.now() - timedelta(minutes=5)
        locked_match.save(update_fields=["kickoff_time"])
        predicted_match = self._create_open_match(offset_hours=96)
        Prediction.objects.create(
            user=self.user,
            match=predicted_match,
            predicted_home_score=1,
            predicted_away_score=0,
        )

        response = self.client.get(f"/api/dashboard?tournament={self.tournament.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending_ids = {row["id"] for row in response.data["pending_predictions"]}
        self.assertIn(open_match.id, pending_ids)
        self.assertNotIn(locked_match.id, pending_ids)
        self.assertNotIn(predicted_match.id, pending_ids)
        self.assertEqual(response.data["pending_count"], 1)


class DashboardOptimizationTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.user = User.objects.create_user(
            username="optuser",
            email="opt@example.com",
            password="pass12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.tournament = Tournament.objects.create(
            name="Opt Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="MD1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.home = Team.objects.create(name="Home", code="HOM")
        self.away = Team.objects.create(name="Away", code="AWY")

    def test_dashboard_builds_global_leaderboard_once(self):
        Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(hours=24),
            status=Match.Status.SCHEDULED,
        )
        with patch(
            "predictions.services.leaderboard.get_cached_global_leaderboard",
            wraps=__import__(
                "predictions.services.leaderboard",
                fromlist=["get_cached_global_leaderboard"],
            ).get_cached_global_leaderboard,
        ) as mock_cached:
            response = self.client.get(
                f"/api/dashboard?tournament={self.tournament.id}"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_cached.call_count, 1)

    def test_pending_count_endpoint(self):
        Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() + timedelta(hours=24),
            status=Match.Status.SCHEDULED,
        )
        response = self.client.get(
            f"/api/dashboard/pending-count?tournament={self.tournament.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pending_count"], 1)

    def test_group_leaderboard_uses_single_aggregate_query(self):
        group = Group.objects.create(name="Opt Group", created_by=self.user)
        GroupMember.objects.create(
            group=group, user=self.user, role=GroupMember.Role.ADMIN
        )
        other = User.objects.create_user(
            username="optother", email="optother@example.com", password="pass12345"
        )
        GroupMember.objects.create(group=group, user=other)
        match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now() - timedelta(days=1),
            status=Match.Status.FINISHED,
            home_score=1,
            away_score=0,
        )
        Prediction.objects.create(
            user=self.user,
            match=match,
            predicted_home_score=1,
            predicted_away_score=0,
            points_awarded=5,
        )
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        with CaptureQueriesContext(connection) as context:
            response = self.client.get(
                f"/api/leaderboards/group/{group.id}?tournament={self.tournament.id}"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prediction_queries = [
            q["sql"]
            for q in context.captured_queries
            if "predictions_prediction" in q["sql"].lower()
        ]
        self.assertLessEqual(len(prediction_queries), 2)
