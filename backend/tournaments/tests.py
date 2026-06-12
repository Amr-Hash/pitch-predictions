import os
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from predictions.models import Prediction
from tournaments.models import (
    CupGroup,
    Match,
    Stage,
    StandingRuleSet,
    Team,
    Tournament,
    TournamentSubscription,
)
from tournaments.services.standing_rules import get_rule_metadata
from tournaments.services.live_scores import (
    apply_live_match_update,
    sync_tournament_live_scores,
)

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

    def test_admin_live_score_does_not_award_points(self):
        pred = Prediction.objects.create(
            user=self.user,
            match=self.match,
            predicted_home_score=2,
            predicted_away_score=1,
        )
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f"/api/tournaments/admin/matches/{self.match.id}",
            {"home_score": 2, "away_score": 1, "status": "live"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "live")
        pred.refresh_from_db()
        self.assertEqual(pred.points_awarded, 0)

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
        TournamentSubscription.objects.create(user=self.user, tournament=self.tournament)

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

    def _add_group_b(self):
        self.group_b = CupGroup.objects.create(tournament=self.tournament, name="B")
        for order, code in enumerate(("EEE", "FFF", "GGG", "HHH")):
            if code not in self.teams:
                self.teams[code] = Team.objects.create(name=code, code=code)
            self.group_b.group_teams.create(team=self.teams[code], order=order)

    def _finish_in_group(self, cup_group, home_code, away_code, home_score, away_score, matchday=1):
        return Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            cup_group=cup_group,
            matchday=matchday,
            home_team=self.teams[home_code],
            away_team=self.teams[away_code],
            kickoff_time=timezone.now() - timedelta(days=1),
            status=Match.Status.FINISHED,
            home_score=home_score,
            away_score=away_score,
        )

    def _complete_group_a(self):
        self._finish("AAA", "BBB", 2, 0, matchday=1)
        self._finish("CCC", "DDD", 1, 1, matchday=1)
        self._finish("AAA", "CCC", 3, 0, matchday=2)
        self._finish("BBB", "DDD", 2, 0, matchday=2)
        self._finish("AAA", "DDD", 4, 0, matchday=3)
        self._finish("BBB", "CCC", 1, 0, matchday=3)

    def _complete_group_b(self, ggg_goals_for=1):
        self._finish_in_group(self.group_b, "EEE", "FFF", 2, 0, matchday=1)
        self._finish_in_group(self.group_b, "GGG", "HHH", ggg_goals_for, 0, matchday=1)
        self._finish_in_group(self.group_b, "EEE", "GGG", 2, 0, matchday=2)
        self._finish_in_group(self.group_b, "FFF", "HHH", 2, 0, matchday=2)
        self._finish_in_group(self.group_b, "EEE", "HHH", 3, 0, matchday=3)
        self._finish_in_group(self.group_b, "FFF", "GGG", 1, 0, matchday=3)

    def test_best_third_place_teams_qualify_across_groups(self):
        self._add_group_b()
        self._complete_group_a()
        self._complete_group_b(ggg_goals_for=2)

        fifa_meta = {
            **get_rule_metadata(Tournament.StandingRules.FIFA_WORLD_CUP),
            "best_third_place_qualifiers": 1,
        }
        with patch(
            "tournaments.services.standings.get_tournament_rule_metadata",
            return_value=fifa_meta,
        ):
            response = self.client.get(f"/api/tournaments/{self.tournament.id}/standings")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["best_third_place_qualifiers"], 1)

        group_a = next(g for g in response.data["groups"] if g["group_name"] == "A")
        group_b = next(g for g in response.data["groups"] if g["group_name"] == "B")
        third_a = group_a["standings"][2]
        third_b = group_b["standings"][2]

        self.assertEqual(third_a["team"]["code"], "CCC")
        self.assertEqual(third_b["team"]["code"], "GGG")
        self.assertFalse(third_a["qualifies"])
        self.assertEqual(third_a["qualification_via"], None)
        self.assertTrue(third_b["qualifies"])
        self.assertEqual(third_b["qualification_via"], "best_third")

        ranking = response.data["third_place_ranking"]
        self.assertEqual(len(ranking), 2)
        self.assertEqual(ranking[0]["team"]["code"], "GGG")
        self.assertTrue(ranking[0]["qualifies"])
        self.assertEqual(ranking[1]["team"]["code"], "CCC")
        self.assertFalse(ranking[1]["qualifies"])


class StandingRuleSetApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="rulesadmin",
            email="rulesadmin@test.com",
            password="pass12345",
            is_staff=True,
        )
        self.ruleset = StandingRuleSet.objects.create(
            slug="test-wc-2030",
            name="World Cup 2030",
            competition_type=StandingRuleSet.CompetitionType.WORLD_CUP,
            version="2030",
            engine=Tournament.StandingRules.FIFA_WORLD_CUP,
            qualifiers_per_group=2,
            best_third_place_qualifiers=8,
            is_active=True,
        )

    def test_list_requires_staff(self):
        response = self.client.get("/api/tournaments/admin/standing-rule-sets")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_create_ruleset(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/tournaments/admin/standing-rule-sets",
            {
                "slug": "ucl-2027",
                "name": "UCL 2027",
                "competition_type": "champions_league",
                "version": "2027",
                "engine": "uefa_champions_league",
                "qualifiers_per_group": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["tiebreakers_en"])

    def test_tournament_create_with_ruleset(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/tournaments/admin/tournaments",
            {
                "name": "WC 2030",
                "year": 2030,
                "start_date": "2030-06-01",
                "end_date": "2030-07-15",
                "standing_rule_set": self.ruleset.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ruleset_data = response.data["standing_rule_set"]
        ruleset_id = ruleset_data["id"] if isinstance(ruleset_data, dict) else ruleset_data
        self.assertEqual(ruleset_id, self.ruleset.id)
        self.assertEqual(response.data["standing_rules"], "fifa_world_cup")
        self.assertEqual(response.data["qualifiers_per_group"], 2)

    def test_club_rejected_from_world_cup_group(self):
        from tournaments.services.standing_rule_sets import sync_builtin_rule_sets

        sync_builtin_rule_sets()
        club = Team.objects.create(
            name="Test FC",
            code="TFC",
            team_type=Team.TeamType.CLUB,
            country_code="eg",
            continent="africa",
            division="Egyptian League",
        )
        national = Team.objects.create(
            name="Nat",
            code="NAT",
            team_type=Team.TeamType.NATIONAL,
            country_code="eg",
            continent="africa",
        )
        self.client.force_authenticate(user=self.admin)
        tournament_resp = self.client.post(
            "/api/tournaments/admin/tournaments",
            {
                "name": "WC Eligibility",
                "competition_type": "world_cup",
                "year": 2030,
                "start_date": "2030-06-01",
                "end_date": "2030-07-15",
            },
            format="json",
        )
        tournament_id = tournament_resp.data["id"]
        group_resp = self.client.post(
            "/api/tournaments/admin/cup-groups",
            {
                "tournament": tournament_id,
                "name": "A",
                "team_ids": [club.id, national.id],
            },
            format="json",
        )
        self.assertEqual(group_resp.status_code, status.HTTP_400_BAD_REQUEST)
        ok_resp = self.client.post(
            "/api/tournaments/admin/cup-groups",
            {
                "tournament": tournament_id,
                "name": "A",
                "team_ids": [national.id],
            },
            format="json",
        )
        self.assertEqual(ok_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CupGroup.objects.filter(tournament_id=tournament_id).count(), 1)

    def test_tournament_create_with_competition_type_defaults(self):
        from tournaments.services.standing_rule_sets import sync_builtin_rule_sets

        sync_builtin_rule_sets()
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/tournaments/admin/tournaments",
            {
                "name": "World Cup 2034",
                "competition_type": "world_cup",
                "year": 2034,
                "start_date": "2034-06-01",
                "end_date": "2034-07-15",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["competition_type"], "world_cup")
        self.assertEqual(response.data["standing_rules"], "fifa_world_cup")
        self.assertEqual(response.data["live_score_provider"], "api_football")
        self.assertEqual(response.data["live_score_config"]["league_id"], 1)
        self.assertEqual(response.data["live_score_config"]["season"], 2034)


class LiveScoreStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="adminstatus",
            email="adminstatus@test.com",
            password="pass12345",
            is_staff=True,
        )
        self.home = Team.objects.create(name="Egypt", code="EGS")
        self.away = Team.objects.create(name="Morocco", code="MRS")
        self.tournament = Tournament.objects.create(
            name="Status Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            live_score_provider=Tournament.LiveScoreProvider.API_FOOTBALL,
            live_score_config={"league_id": 1, "season": 2026},
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="MD1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now(),
            status=Match.Status.SCHEDULED,
            external_fixture_id="12345",
        )

    def test_overview_requires_staff(self):
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch.dict(os.environ, {"API_FOOTBALL_KEY": "test-key"}, clear=False)
    def test_overview_returns_environment_and_tournament_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["environment"]["api_football_key_configured"])
        self.assertEqual(response.data["summary"]["tournament_count"], 1)
        tournament = response.data["tournaments"][0]
        self.assertEqual(tournament["tournament_id"], self.tournament.id)
        self.assertEqual(tournament["matches"]["mapped_fixtures"], 1)
        self.assertEqual(tournament["health"], "ready")

    def test_overview_tolerates_naive_kickoff_times(self):
        from datetime import datetime

        Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=datetime(2026, 6, 12, 18, 0, 0),
            status=Match.Status.SCHEDULED,
            external_fixture_id="",
        )
        self.client.force_authenticate(user=self.admin)
        with patch.dict(os.environ, {"API_FOOTBALL_KEY": "test-key"}, clear=False):
            response = self.client.get(
                "/api/tournaments/admin/tournaments/live-score-overview"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch.dict(
        os.environ,
        {"LIVE_SCORE_SYNC_START": "not-a-date", "API_FOOTBALL_KEY": "test-key"},
        clear=False,
    )
    def test_overview_tolerates_invalid_sync_window_env(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["environment"]["sync_window_open"])

    @patch.dict(os.environ, {"API_FOOTBALL_KEY": ""}, clear=False)
    def test_detail_flags_missing_api_key(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f"/api/tournaments/admin/tournaments/{self.tournament.id}/live-score-status"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("missing_api_key", response.data["tournament"]["issues"])
        self.assertEqual(response.data["tournament"]["health"], "error")


class LiveScoreSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.home = Team.objects.create(name="Egypt", code="EGY")
        self.away = Team.objects.create(name="Morocco", code="MAR")
        self.tournament = Tournament.objects.create(
            name="Test Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            live_score_provider=Tournament.LiveScoreProvider.API_FOOTBALL,
            live_score_config={"league_id": 1, "season": 2026},
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Group MD1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.cup_group = CupGroup.objects.create(tournament=self.tournament, name="A")
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            cup_group=self.cup_group,
            matchday=1,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=timezone.now(),
            status=Match.Status.SCHEDULED,
            external_fixture_id="999001",
        )
        self.user = User.objects.create_user(
            username="predictor",
            email="pred@example.com",
            password="pass12345",
        )
        self.prediction = Prediction.objects.create(
            user=self.user,
            match=self.match,
            predicted_home_score=2,
            predicted_away_score=1,
        )

    def _fixture_payload(self, *, short_status: str, home: int, away: int) -> dict:
        return {
            "fixture": {"id": 999001, "status": {"short": short_status}},
            "goals": {"home": home, "away": away},
            "teams": {"home": {"winner": None}, "away": {"winner": None}},
        }

    @override_settings()
    def test_cron_endpoint_rejects_missing_secret(self):
        with patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"}, clear=False):
            response = self.client.get("/api/cron/sync-live-scores")
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"})
    @patch(
        "tournaments.services.live_scores.sync_all_configured_tournaments",
        return_value=[{"tournament_id": 1, "updated": 0, "skipped": 0}],
    )
    def test_cron_endpoint_accepts_bearer_secret(self, _mock_sync):
        response = self.client.get(
            "/api/cron/sync-live-scores",
            HTTP_X_CRON_SECRET="test-cron-secret",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tournaments", response.data)

    def test_apply_live_update_does_not_award_points(self):
        apply_live_match_update(
            self.match,
            status=Match.Status.LIVE,
            home_score=2,
            away_score=1,
        )
        self.prediction.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.LIVE)
        self.assertEqual(self.prediction.points_awarded, 0)

    def test_apply_finished_update_awards_points(self):
        apply_live_match_update(
            self.match,
            status=Match.Status.FINISHED,
            home_score=2,
            away_score=1,
            finalize=True,
        )
        self.prediction.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.FINISHED)
        self.assertGreater(self.prediction.points_awarded, 0)

    @patch.dict(os.environ, {"API_FOOTBALL_KEY": "test-key"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_season_fixtures")
    def test_api_football_sync_live_does_not_award_points(self, mock_fetch):
        mock_fetch.return_value = [self._fixture_payload(short_status="2H", home=1, away=0)]
        result = sync_tournament_live_scores(self.tournament)
        self.assertEqual(result["updated"], 1)
        self.prediction.refresh_from_db()
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.LIVE)
        self.assertEqual(self.prediction.points_awarded, 0)

    @patch.dict(os.environ, {"API_FOOTBALL_KEY": "test-key"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_season_fixtures")
    def test_api_football_sync_finished_awards_points(self, mock_fetch):
        mock_fetch.return_value = [self._fixture_payload(short_status="FT", home=2, away=1)]
        result = sync_tournament_live_scores(self.tournament)
        self.assertEqual(result["updated"], 1)
        self.prediction.refresh_from_db()
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.FINISHED)
        self.assertGreater(self.prediction.points_awarded, 0)
