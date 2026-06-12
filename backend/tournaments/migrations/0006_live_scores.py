from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0005_tournament_standing_rules"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="live_score_provider",
            field=models.CharField(
                choices=[
                    ("manual", "Manual (admin only)"),
                    ("api_football", "API-Football (api-sports.io)"),
                    ("sportmonks", "SportMonks"),
                ],
                default="manual",
                help_text="External feed used to update live scores for this tournament.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="live_score_config",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Provider settings such as league_id and season (API keys live in server env).",
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="external_fixture_id",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Fixture ID in the tournament live-score provider (for auto sync).",
                max_length=64,
            ),
        ),
    ]
