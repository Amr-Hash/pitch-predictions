from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    table = "app_cache"
    existing = schema_editor.connection.introspection.table_names()
    if table in existing:
        return
    call_command("createcachetable", verbosity=0)


class Migration(migrations.Migration):

    dependencies = [
        ("predictions", "0003_scaling_leaderboards_and_jobs"),
    ]

    operations = [
        migrations.RunPython(create_cache_table, migrations.RunPython.noop),
    ]
