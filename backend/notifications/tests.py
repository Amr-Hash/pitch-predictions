from datetime import timedelta
import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from notifications.models import KickoffReminderSent, Notification, PushSubscription
from notifications.services.match_reminders import send_match_kickoff_reminders
from predictions.models import Prediction
from tournaments.models import Match, Stage, Team, Tournament, TournamentSubscription

User = get_user_model()


@patch.dict(
    os.environ,
    {
        "VAPID_PUBLIC_KEY": "test-public",
        "VAPID_PRIVATE_KEY": "test-private",
        "VAPID_ADMIN_EMAIL": "test@example.com",
    },
    clear=False,
)
class MatchKickoffReminderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="fan1", email="fan1@test.com", password="pass12345"
        )
        self.other = User.objects.create_user(
            username="fan2", email="fan2@test.com", password="pass12345"
        )
        self.tournament = Tournament.objects.create(
            name="Test Cup",
            year=2026,
            start_date="2026-06-01",
            end_date="2026-07-01",
            is_active=True,
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Group Day 1",
            order=1,
            stage_type=Stage.StageType.GROUP,
        )
        self.home = Team.objects.create(name="Home FC", code="HFC")
        self.away = Team.objects.create(name="Away FC", code="AFC")
        self.kickoff = timezone.now() + timedelta(hours=1)
        self.match = Match.objects.create(
            tournament=self.tournament,
            stage=self.stage,
            home_team=self.home,
            away_team=self.away,
            kickoff_time=self.kickoff,
            status=Match.Status.SCHEDULED,
        )
        self.prediction = Prediction.objects.create(
            user=self.user,
            match=self.match,
            predicted_home_score=2,
            predicted_away_score=1,
        )
        TournamentSubscription.objects.create(user=self.user, tournament=self.tournament)
        TournamentSubscription.objects.create(user=self.other, tournament=self.tournament)
        PushSubscription.objects.create(
            user=self.user,
            endpoint="https://push.example/fan1",
            p256dh="p256dh",
            auth="auth",
        )
        PushSubscription.objects.create(
            user=self.other,
            endpoint="https://push.example/fan2",
            p256dh="p256dh2",
            auth="auth2",
        )

    def test_in_app_reminders_when_push_not_configured(self):
        with patch.dict(os.environ, {"VAPID_PUBLIC_KEY": ""}, clear=False):
            result = send_match_kickoff_reminders()

        self.assertTrue(result["enabled"])
        self.assertFalse(result["push_enabled"])
        self.assertEqual(result["push_sent"], 0)
        self.assertEqual(result["in_app_created"], 2)
        self.assertEqual(KickoffReminderSent.objects.count(), 2)
        self.assertEqual(
            Notification.objects.filter(
                notification_type=Notification.Type.MATCH_KICKOFF_REMINDER
            ).count(),
            2,
        )

    @patch("notifications.services.match_reminders.send_push_to_user", return_value=1)
    def test_sends_in_app_and_push_to_subscribed_users(self, mock_push):
        result = send_match_kickoff_reminders()

        self.assertTrue(result["enabled"])
        self.assertTrue(result["push_enabled"])
        self.assertEqual(result["matches"], 1)
        self.assertEqual(result["eligible_users"], 2)
        self.assertEqual(result["in_app_created"], 2)
        self.assertEqual(result["push_sent"], 2)
        self.assertEqual(mock_push.call_count, 2)
        self.assertEqual(KickoffReminderSent.objects.count(), 2)
        self.assertEqual(
            Notification.objects.filter(
                notification_type=Notification.Type.MATCH_KICKOFF_REMINDER
            ).count(),
            2,
        )

    @patch("notifications.services.match_reminders.send_push_to_user", return_value=1)
    def test_dedup_skips_second_run(self, mock_push):
        send_match_kickoff_reminders()
        result = send_match_kickoff_reminders()

        self.assertEqual(result["eligible_users"], 0)
        self.assertEqual(result["in_app_created"], 0)
        self.assertEqual(result["push_sent"], 0)
        self.assertEqual(mock_push.call_count, 2)

    @patch("notifications.services.match_reminders.send_push_to_user", return_value=0)
    def test_in_app_without_push_subscription_still_notifies(self, mock_push):
        PushSubscription.objects.filter(user=self.other).delete()

        result = send_match_kickoff_reminders()

        self.assertEqual(result["eligible_users"], 2)
        self.assertEqual(result["in_app_created"], 2)
        self.assertEqual(mock_push.call_count, 1)
        self.assertEqual(KickoffReminderSent.objects.count(), 2)
        self.assertEqual(
            Notification.objects.filter(
                notification_type=Notification.Type.MATCH_KICKOFF_REMINDER
            ).count(),
            2,
        )

    @patch("notifications.services.match_reminders.send_push_to_user", return_value=0)
    def test_skips_users_not_subscribed_to_tournament(self, mock_push):
        TournamentSubscription.objects.filter(user=self.other).delete()

        result = send_match_kickoff_reminders()

        self.assertEqual(result["eligible_users"], 1)
        self.assertEqual(result["in_app_created"], 1)
        self.assertEqual(mock_push.call_count, 1)

    @patch("notifications.services.match_reminders.send_push_to_user", return_value=0)
    def test_catch_up_when_kickoff_sooner_than_one_hour(self, mock_push):
        self.match.kickoff_time = timezone.now() + timedelta(minutes=30)
        self.match.save(update_fields=["kickoff_time"])

        result = send_match_kickoff_reminders()

        self.assertEqual(result["matches"], 1)
        self.assertEqual(result["in_app_created"], 2)

    @patch("notifications.services.match_reminders.send_push_to_user", return_value=0)
    def test_ignores_matches_outside_window(self, mock_push):
        self.match.kickoff_time = timezone.now() + timedelta(hours=3)
        self.match.save(update_fields=["kickoff_time"])

        result = send_match_kickoff_reminders()

        self.assertEqual(result["matches"], 0)
        self.assertEqual(mock_push.call_count, 0)


class CronMatchRemindersEndpointTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    @patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"}, clear=False)
    def test_cron_endpoint_rejects_missing_secret(self):
        from rest_framework import status

        response = self.client.get("/api/cron/send-match-reminders")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"})
    @patch(
        "notifications.services.match_reminders.send_match_kickoff_reminders",
        return_value={"enabled": True, "matches": 0, "in_app_created": 0},
    )
    def test_cron_endpoint_accepts_bearer_secret(self, _mock_send):
        from rest_framework import status

        response = self.client.get(
            "/api/cron/send-match-reminders",
            HTTP_AUTHORIZATION="Bearer test-cron-secret",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("enabled", response.data)

    @patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"})
    @patch(
        "notifications.services.match_reminders.send_match_kickoff_reminders",
        return_value={"enabled": True, "matches": 0, "in_app_created": 0},
    )
    def test_cron_endpoint_accepts_header_secret(self, _mock_send):
        from rest_framework import status

        response = self.client.get(
            "/api/cron/send-match-reminders",
            HTTP_X_CRON_SECRET="test-cron-secret",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("enabled", response.data)
