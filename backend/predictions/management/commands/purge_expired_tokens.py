from django.core.management.base import BaseCommand
from django.utils import timezone

from rest_framework_simplejwt.token_blacklist.models import OutstandingToken


class Command(BaseCommand):
    help = "Delete expired JWT blacklist tokens."

    def handle(self, *args, **options):
        now = timezone.now()
        deleted, _ = OutstandingToken.objects.filter(expires_at__lt=now).delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {deleted} expired outstanding token(s).")
        )
