from django.db import migrations, models


def backfill_competition_type(apps, schema_editor):
    Tournament = apps.get_model("tournaments", "Tournament")
    StandingRuleSet = apps.get_model("tournaments", "StandingRuleSet")

    for tournament in Tournament.objects.all():
        if tournament.standing_rule_set_id:
            ruleset = StandingRuleSet.objects.filter(pk=tournament.standing_rule_set_id).first()
            if ruleset:
                tournament.competition_type = ruleset.competition_type
                tournament.save(update_fields=["competition_type"])
                continue
        if tournament.standing_rules == "fifa_world_cup":
            tournament.competition_type = "world_cup"
        elif tournament.standing_rules == "uefa_champions_league":
            tournament.competition_type = "champions_league"
        else:
            tournament.competition_type = "other"
        tournament.save(update_fields=["competition_type"])


def sync_world_cup_defaults(apps, schema_editor):
    from tournaments.services.standing_rule_sets import sync_world_cup_tournaments

    sync_world_cup_tournaments()


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0009_wc_48_team_standing_rules"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="competition_type",
            field=models.CharField(
                choices=[
                    ("world_cup", "FIFA World Cup"),
                    ("champions_league", "UEFA Champions League"),
                    ("other", "Other"),
                ],
                default="world_cup",
                help_text="Competition format (World Cup, Champions League, etc.).",
                max_length=32,
            ),
        ),
        migrations.RunPython(backfill_competition_type, migrations.RunPython.noop),
        migrations.RunPython(sync_world_cup_defaults, migrations.RunPython.noop),
    ]
