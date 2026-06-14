from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = "Remove expired rows from the database cache table."

    def handle(self, *args, **options):
        call_command("createcachetable", verbosity=0)
        from django.core.cache import cache

        cache.cull()
        self.stdout.write(self.style.SUCCESS("Cache culled."))
