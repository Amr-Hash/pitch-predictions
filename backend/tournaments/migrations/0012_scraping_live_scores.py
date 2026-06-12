from django.db import migrations, models


def migrate_api_providers_to_scraping(apps, schema_editor):
    Tournament = apps.get_model("tournaments", "Tournament")
    Tournament.objects.filter(
        live_score_provider__in=["api_football", "sportmonks"]
    ).update(live_score_provider="scraping", live_score_config={})


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0011_team_geography_and_eligibility"),
    ]

    operations = [
        migrations.RunPython(migrate_api_providers_to_scraping, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="tournament",
            name="live_score_provider",
            field=models.CharField(
                choices=[
                    ("manual", "Manual (admin only)"),
                    ("scraping", "Web scraping"),
                ],
                default="manual",
                help_text="External feed used to update live scores for this tournament.",
                max_length=20,
            ),
        ),
    ]
