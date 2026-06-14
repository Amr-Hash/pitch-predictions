import os
from datetime import timedelta
from unittest.mock import Mock, patch

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
from tournaments.services.datetime_utils import ensure_aware_datetime
from tournaments.services.live_scores import (
    apply_live_match_update,
    sync_tournament_live_scores,
)
from tournaments.services.team_eligibility import (
    apply_team_eligibility_defaults,
    default_team_eligibility_for_competition,
    eligible_teams_for_tournament,
    ineligibility_reason,
    team_eligible_for_tournament,
    validate_team_ids_for_tournament,
)
from tournaments.services.team_geography import geography_for_team_code

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

    def test_admin_group_stage_draw_does_not_require_winner(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f"/api/tournaments/admin/matches/{self.match.id}",
            {
                "home_score": 1,
                "away_score": 1,
                "status": "finished",
                "winner_team": None,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["home_score"], 1)
        self.assertEqual(response.data["away_score"], 1)
        self.assertIsNone(response.data["winner_team"])

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
        self.assertEqual(response.data["live_score_provider"], "football_data")
        self.assertEqual(response.data["live_score_config"], {"competition_code": "WC"})


class LiveScoreStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="adminstatus",
            email="adminstatus@test.com",
            password="pass12345",
            is_staff=True,
        )
        self.home = Team.objects.create(name="Egypt", code="EGY")
        self.away = Team.objects.create(name="Morocco", code="MAR")
        self.tournament = Tournament.objects.create(
            name="Status Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            live_score_provider=Tournament.LiveScoreProvider.FOOTBALL_DATA,
            live_score_config={"competition_code": "WC"},
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
        )

    def test_overview_requires_staff(self):
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_overview_returns_environment_and_tournament_status(self):
        self.client.force_authenticate(user=self.admin)
        with patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False):
            response = self.client.get(
                "/api/tournaments/admin/tournaments/live-score-overview"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["environment"]["cron_secret_configured"] is False)
        self.assertTrue(response.data["environment"]["football_data_api_configured"])
        self.assertEqual(response.data["summary"]["tournament_count"], 1)
        tournament = response.data["tournaments"][0]
        self.assertEqual(tournament["tournament_id"], self.tournament.id)
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
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch.dict(
        os.environ,
        {"LIVE_SCORE_SYNC_START": "not-a-date"},
        clear=False,
    )
    def test_overview_tolerates_invalid_sync_window_env(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["environment"]["sync_window_open"])

    def test_overview_tolerates_non_dict_live_score_config(self):
        self.tournament.live_score_config = "not-a-config"
        self.tournament.save(update_fields=["live_score_config"])
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/tournaments/admin/tournaments/live-score-overview"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tournament = response.data["tournaments"][0]
        self.assertEqual(tournament["live_score_config"], {})

    def test_kickoff_isoformat_handles_none(self):
        from tournaments.services.live_score_status import kickoff_isoformat

        self.assertIsNone(kickoff_isoformat(None))

    def test_overview_isolates_per_tournament_failure(self):
        Tournament.objects.create(
            name="Bad Cup",
            year=2025,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            live_score_provider=Tournament.LiveScoreProvider.MANUAL,
        )
        from tournaments.services import live_score_status as lss

        original = lss.get_tournament_live_score_status

        def status_with_failure(tournament, *, detailed=False):
            if tournament.name == "Bad Cup":
                raise RuntimeError("simulated status failure")
            return original(tournament, detailed=detailed)

        self.client.force_authenticate(user=self.admin)
        with patch.object(
            lss, "get_tournament_live_score_status", side_effect=status_with_failure
        ):
            response = self.client.get(
                "/api/tournaments/admin/tournaments/live-score-overview"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["tournament_count"], 2)
        bad_row = next(
            row for row in response.data["tournaments"] if row["tournament_name"] == "Bad Cup"
        )
        self.assertEqual(bad_row["health"], "error")
        self.assertIn("status_build_failed", bad_row["issues"])


class FootballDataTests(TestCase):
    @patch("tournaments.services.football_data.requests.get")
    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    def test_fetch_competition_matches_parses_json(self, mock_get):
        from tournaments.services.football_data import fetch_competition_matches

        mock_response = Mock()
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            "matches": [
                {
                    "utcDate": "2026-06-13T19:00:00Z",
                    "status": "FINISHED",
                    "homeTeam": {"name": "Egypt", "tla": "EGY"},
                    "awayTeam": {"name": "Morocco", "tla": "MAR"},
                    "score": {"fullTime": {"home": 2, "away": 1}},
                }
            ]
        }
        mock_get.return_value = mock_response

        rows = fetch_competition_matches(
            competition_code="WC",
            season=2026,
            date_from=timezone.now().date(),
            date_to=timezone.now().date(),
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].home_code, "EGY")
        self.assertEqual(rows[0].away_code, "MAR")
        self.assertEqual(rows[0].home_score, 2)
        self.assertEqual(rows[0].status, Match.Status.FINISHED)

    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    def test_find_football_data_match_for_match(self):
        from tournaments.services.football_data import (
            FootballDataMatch,
            find_football_data_match_for_match,
        )

        home = Team.objects.create(name="Egypt", code="EGY")
        away = Team.objects.create(name="Morocco", code="MAR")
        tournament = Tournament.objects.create(
            name="Cup",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
        )
        stage = Stage.objects.create(
            tournament=tournament,
            name="MD1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        kickoff = timezone.now()
        match = Match.objects.create(
            tournament=tournament,
            stage=stage,
            home_team=home,
            away_team=away,
            kickoff_time=kickoff,
            status=Match.Status.SCHEDULED,
        )

        api_rows = [
            FootballDataMatch(
                home_code="EGY",
                away_code="MAR",
                home_name="Egypt",
                away_name="Morocco",
                home_score=1,
                away_score=0,
                status=Match.Status.LIVE,
                utc_date=kickoff,
            )
        ]
        found = find_football_data_match_for_match(match, api_rows)
        self.assertIsNotNone(found)
        self.assertEqual(found.home_score, 1)


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
            live_score_provider=Tournament.LiveScoreProvider.FOOTBALL_DATA,
            live_score_config={"competition_code": "WC"},
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
        TournamentSubscription.objects.get_or_create(
            user=self.user, tournament=self.tournament
        )

    def _api_row(self, *, status: str, home: int, away: int):
        from tournaments.services.football_data import FootballDataMatch

        return FootballDataMatch(
            home_code="EGY",
            away_code="MAR",
            home_name="Egypt",
            away_name="Morocco",
            home_score=home,
            away_score=away,
            status=status,
            utc_date=self.match.kickoff_time,
        )

    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_competition_matches")
    def test_football_data_sync_live_does_not_award_points(self, mock_fetch):
        mock_fetch.return_value = [self._api_row(status=Match.Status.LIVE, home=1, away=0)]
        result = sync_tournament_live_scores(self.tournament)
        self.assertEqual(result["updated"], 1)
        self.prediction.refresh_from_db()
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.LIVE)
        self.assertEqual(self.prediction.points_awarded, 0)

    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_competition_matches")
    def test_football_data_sync_finished_awards_points(self, mock_fetch):
        mock_fetch.return_value = [
            self._api_row(status=Match.Status.FINISHED, home=2, away=1)
        ]
        result = sync_tournament_live_scores(self.tournament)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["finalized"], 1)
        self.prediction.refresh_from_db()
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.FINISHED)
        self.assertGreater(self.prediction.points_awarded, 0)

    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_competition_matches")
    def test_football_data_sync_finished_creates_match_result_notification(self, mock_fetch):
        mock_fetch.return_value = [
            self._api_row(status=Match.Status.FINISHED, home=2, away=1)
        ]
        with (
            patch("predictions.services.notifications.push_configured", return_value=True),
            patch(
                "predictions.services.notifications.send_push_to_user", return_value=1
            ) as mock_push,
        ):
            sync_tournament_live_scores(self.tournament)

        from notifications.models import Notification

        notification = Notification.objects.get(
            user=self.user,
            notification_type=Notification.Type.MATCH_RESULT,
        )
        self.assertFalse(notification.is_read)
        self.assertEqual(notification.payload["points_awarded"], 5)
        self.assertEqual(notification.payload["home_score"], 2)
        self.assertGreaterEqual(mock_push.call_count, 1)

    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_competition_matches")
    def test_football_data_sync_skips_outside_match_window(self, mock_fetch):
        self.match.kickoff_time = timezone.now() + timedelta(days=2)
        self.match.save(update_fields=["kickoff_time"])
        result = sync_tournament_live_scores(self.tournament)
        mock_fetch.assert_not_called()
        self.assertEqual(result["updated"], 0)

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
    def test_cron_endpoint_accepts_header_secret(self, _mock_sync):
        response = self.client.get(
            "/api/cron/sync-live-scores",
            HTTP_X_CRON_SECRET="test-cron-secret",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tournaments", response.data)

    @patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"})
    def test_cron_sync_accepts_bearer_secret(self):
        with patch(
            "tournaments.services.live_scores.sync_all_configured_tournaments",
            return_value=[{"tournament_id": 1, "updated": 0, "skipped": 0}],
        ):
            response = self.client.get(
                "/api/cron/sync-live-scores",
                HTTP_AUTHORIZATION="Bearer test-cron-secret",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

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

    @patch.dict(os.environ, {"FOOTBALL_DATA_API_TOKEN": "test-token"}, clear=False)
    @patch("tournaments.services.live_scores.fetch_competition_matches", return_value=[])
    def test_admin_sync_tolerates_naive_kickoff(self, _mock_fetch):
        from datetime import datetime

        admin = User.objects.create_user(
            username="adminsync",
            email="adminsync@test.com",
            password="pass12345",
            is_staff=True,
        )
        self.match.kickoff_time = datetime(2026, 6, 12, 18, 0, 0)
        self.match.save(update_fields=["kickoff_time"])
        self.client.force_authenticate(user=admin)
        response = self.client.post(
            f"/api/tournaments/admin/tournaments/{self.tournament.id}/sync-live-scores"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TeamEligibilityServiceTests(TestCase):
    def setUp(self):
        self.national_eg = Team.objects.create(
            name="Egypt",
            code="EGY",
            team_type=Team.TeamType.NATIONAL,
            country_code="eg",
            continent="africa",
        )
        self.national_fr = Team.objects.create(
            name="France",
            code="FRA",
            team_type=Team.TeamType.NATIONAL,
            country_code="fr",
            continent="europe",
        )
        self.club = Team.objects.create(
            name="Test FC",
            code="TFC",
            team_type=Team.TeamType.CLUB,
            country_code="eg",
            continent="africa",
            division="Egyptian League",
        )
        self.club_eu = Team.objects.create(
            name="Euro FC",
            code="EFC",
            team_type=Team.TeamType.CLUB,
            country_code="de",
            continent="europe",
            division="Bundesliga",
        )
        self.world_cup = Tournament.objects.create(
            name="WC",
            year=2030,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            competition_type="world_cup",
            allowed_team_type=Tournament.AllowedTeamType.NATIONAL,
            team_scope=Tournament.TeamScope.WORLDWIDE,
        )
        self.ucl = Tournament.objects.create(
            name="UCL",
            year=2030,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            competition_type="champions_league",
            allowed_team_type=Tournament.AllowedTeamType.CLUB,
            team_scope=Tournament.TeamScope.CONTINENT,
            allowed_continent="europe",
        )

    def test_default_eligibility_by_competition_type(self):
        wc = default_team_eligibility_for_competition("world_cup")
        self.assertEqual(wc["allowed_team_type"], Tournament.AllowedTeamType.NATIONAL)
        self.assertEqual(wc["team_scope"], Tournament.TeamScope.WORLDWIDE)

        ucl = default_team_eligibility_for_competition("champions_league")
        self.assertEqual(ucl["allowed_team_type"], Tournament.AllowedTeamType.CLUB)
        self.assertEqual(ucl["allowed_continent"], "europe")

        other = default_team_eligibility_for_competition("other")
        self.assertEqual(other["allowed_team_type"], Tournament.AllowedTeamType.ANY)

    def test_apply_team_eligibility_defaults_on_create(self):
        attrs = apply_team_eligibility_defaults(
            {"competition_type": "world_cup"},
            instance=None,
        )
        self.assertEqual(attrs["allowed_team_type"], Tournament.AllowedTeamType.NATIONAL)

    def test_team_eligibility_rules(self):
        self.assertTrue(team_eligible_for_tournament(self.national_eg, self.world_cup))
        self.assertFalse(team_eligible_for_tournament(self.club, self.world_cup))
        self.assertIn("national teams", ineligibility_reason(self.club, self.world_cup).lower())

        self.assertTrue(team_eligible_for_tournament(self.club_eu, self.ucl))
        self.assertFalse(team_eligible_for_tournament(self.club, self.ucl))
        self.assertIn("continent", ineligibility_reason(self.club, self.ucl).lower())

    def test_validate_team_ids_for_tournament(self):
        with self.assertRaises(ValueError) as missing:
            validate_team_ids_for_tournament([99999], self.world_cup)
        self.assertIn("Unknown team", str(missing.exception))

        with self.assertRaises(ValueError) as ineligible:
            validate_team_ids_for_tournament([self.club.id], self.world_cup)
        self.assertIn(self.club.code, str(ineligible.exception))

    def test_eligible_teams_queryset_filters(self):
        ids = set(eligible_teams_for_tournament(self.world_cup).values_list("id", flat=True))
        self.assertIn(self.national_eg.id, ids)
        self.assertNotIn(self.club.id, ids)

        ucl_ids = set(eligible_teams_for_tournament(self.ucl).values_list("id", flat=True))
        self.assertNotIn(self.national_eg.id, ucl_ids)

    def test_country_and_division_scope(self):
        country_cup = Tournament.objects.create(
            name="Egy Cup",
            year=2031,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            allowed_team_type=Tournament.AllowedTeamType.ANY,
            team_scope=Tournament.TeamScope.COUNTRY,
            allowed_country_code="EG",
        )
        self.assertTrue(team_eligible_for_tournament(self.national_eg, country_cup))
        self.assertFalse(team_eligible_for_tournament(self.national_fr, country_cup))

        league = Tournament.objects.create(
            name="Egy League",
            year=2031,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            allowed_team_type=Tournament.AllowedTeamType.CLUB,
            team_scope=Tournament.TeamScope.DIVISION,
            allowed_division="Egyptian League",
        )
        self.assertTrue(team_eligible_for_tournament(self.club, league))
        self.club.division = "Other"
        self.club.save(update_fields=["division"])
        self.assertIn("division", ineligibility_reason(self.club, league).lower())

    def test_geography_for_unknown_team_code(self):
        geo = geography_for_team_code("XYZ", "us")
        self.assertEqual(geo["country_code"], "us")
        self.assertEqual(geo["continent"], "")

    def test_ensure_aware_datetime(self):
        from datetime import datetime, timezone as dt_timezone

        naive = datetime(2026, 6, 12, 18, 0, 0)
        aware = ensure_aware_datetime(naive)
        self.assertTrue(timezone.is_aware(aware))

        already = datetime(2026, 6, 12, 18, 0, 0, tzinfo=dt_timezone.utc)
        self.assertIs(ensure_aware_datetime(already), already)
