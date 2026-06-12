from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0004_name_ar_translations"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="qualifiers_per_group",
            field=models.PositiveSmallIntegerField(
                default=2,
                help_text="How many teams advance from each group (e.g. 2 for World Cup).",
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="standing_rules",
            field=models.CharField(
                choices=[
                    ("fifa_world_cup", "FIFA World Cup"),
                    ("uefa_champions_league", "UEFA Champions League"),
                    ("simple", "Simple (points → GD → GF)"),
                ],
                default="fifa_world_cup",
                max_length=32,
            ),
        ),
    ]
