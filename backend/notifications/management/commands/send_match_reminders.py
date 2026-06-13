from django.core.management.base import BaseCommand

from notifications.services.match_reminders import send_match_kickoff_reminders


class Command(BaseCommand):
    help = "Send tournament kickoff reminders about one hour before matches start."

    def handle(self, *args, **options):
        result = send_match_kickoff_reminders()
        self.stdout.write(str(result))
