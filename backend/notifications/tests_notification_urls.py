from django.test import TestCase

from notifications.models import Notification
from notifications.services.notification_urls import notification_action_url


class NotificationActionUrlTests(TestCase):
    def test_match_kickoff_reminder_links_to_match(self):
        url = notification_action_url(
            Notification.Type.MATCH_KICKOFF_REMINDER,
            {"match_id": 42},
        )
        self.assertEqual(url, "/matches/42")

    def test_group_podium_links_to_group_leaderboard(self):
        url = notification_action_url(
            Notification.Type.GROUP_PODIUM,
            {"group_id": 7, "match_id": 42},
        )
        self.assertEqual(url, "/leaderboards?group=7")

    def test_match_result_with_global_rank_change_links_to_global_leaderboard(self):
        url = notification_action_url(
            Notification.Type.MATCH_RESULT,
            {
                "match_id": 42,
                "global_rank": 3,
                "previous_global_rank": 5,
                "groups": [],
            },
        )
        self.assertEqual(url, "/leaderboards")

    def test_match_result_with_new_global_rank_links_to_global_leaderboard(self):
        url = notification_action_url(
            Notification.Type.MATCH_RESULT,
            {
                "match_id": 42,
                "global_rank": 1,
                "previous_global_rank": None,
                "groups": [],
            },
        )
        self.assertEqual(url, "/leaderboards")

    def test_match_result_with_group_rank_change_links_to_group_leaderboard(self):
        url = notification_action_url(
            Notification.Type.MATCH_RESULT,
            {
                "match_id": 42,
                "global_rank": 2,
                "previous_global_rank": 2,
                "groups": [
                    {
                        "group_id": 9,
                        "group_name": "Friends",
                        "rank": 1,
                        "previous_rank": 2,
                    }
                ],
            },
        )
        self.assertEqual(url, "/leaderboards?group=9")

    def test_match_result_without_rank_change_links_to_match(self):
        url = notification_action_url(
            Notification.Type.MATCH_RESULT,
            {
                "match_id": 42,
                "global_rank": 2,
                "previous_global_rank": 2,
                "groups": [
                    {
                        "group_id": 9,
                        "group_name": "Friends",
                        "rank": 1,
                        "previous_rank": 1,
                    }
                ],
            },
        )
        self.assertEqual(url, "/matches/42")

    def test_global_rank_change_takes_priority_over_group_change(self):
        url = notification_action_url(
            Notification.Type.MATCH_RESULT,
            {
                "match_id": 42,
                "global_rank": 4,
                "previous_global_rank": 6,
                "groups": [
                    {
                        "group_id": 9,
                        "group_name": "Friends",
                        "rank": 1,
                        "previous_rank": 2,
                    }
                ],
            },
        )
        self.assertEqual(url, "/leaderboards")
