from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tournaments.models import Match, Stage, StandingRuleSet, Team, Tournament, TournamentSubscription
from tournaments.services.subscriptions import subscribe_user_to_default_world_cup

User = get_user_model()


class TournamentSubscriptionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="fan",
            email="fan@test.com",
            password="pass12345",
        )
        self.other = User.objects.create_user(
            username="other",
            email="other@test.com",
            password="pass12345",
        )
        self.ruleset = StandingRuleSet.objects.create(
            slug="wc-sub-test",
            name="WC Sub Test",
            competition_type=StandingRuleSet.CompetitionType.WORLD_CUP,
            version="2026",
            engine=Tournament.StandingRules.FIFA_WORLD_CUP,
            qualifiers_per_group=2,
            is_active=True,
        )
        self.tournament = Tournament.objects.create(
            name="World Cup Sub Test",
            year=2026,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            competition_type=StandingRuleSet.CompetitionType.WORLD_CUP,
            standing_rule_set=self.ruleset,
            standing_rules=Tournament.StandingRules.FIFA_WORLD_CUP,
            is_active=True,
        )
        self.other_tournament = Tournament.objects.create(
            name="Other Cup",
            year=2027,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=30),
            competition_type=StandingRuleSet.CompetitionType.OTHER,
            standing_rules=Tournament.StandingRules.SIMPLE,
            is_active=True,
        )

    def test_register_auto_subscribes_to_world_cup(self):
        new_user = User.objects.create_user(
            username="newfan",
            email="newfan@test.com",
            password="pass12345",
        )
        subscription = subscribe_user_to_default_world_cup(new_user)
        self.assertIsNotNone(subscription)
        self.assertEqual(subscription.tournament_id, self.tournament.id)

    def test_list_returns_only_subscribed_tournaments(self):
        TournamentSubscription.objects.create(user=self.user, tournament=self.tournament)
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/tournaments")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        rows = payload["results"] if isinstance(payload, dict) else payload
        ids = [row["id"] for row in rows]
        self.assertEqual(ids, [self.tournament.id])

    def test_available_lists_active_tournaments(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/tournaments/available")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data}
        self.assertIn(self.tournament.id, ids)
        self.assertIn(self.other_tournament.id, ids)

    def test_subscribe_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/tournaments/{self.other_tournament.id}/subscribe")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            TournamentSubscription.objects.filter(
                user=self.user, tournament=self.other_tournament
            ).exists()
        )
