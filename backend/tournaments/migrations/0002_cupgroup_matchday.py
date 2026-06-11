import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CupGroup",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=1)),
                (
                    "tournament",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cup_groups",
                        to="tournaments.tournament",
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="CupGroupTeam",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("order", models.PositiveSmallIntegerField(default=0)),
                (
                    "cup_group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="group_teams",
                        to="tournaments.cupgroup",
                    ),
                ),
                (
                    "team",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="tournaments.team",
                    ),
                ),
            ],
            options={
                "ordering": ["order"],
            },
        ),
        migrations.AddField(
            model_name="cupgroup",
            name="teams",
            field=models.ManyToManyField(
                related_name="cup_groups",
                through="tournaments.CupGroupTeam",
                to="tournaments.team",
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="cup_group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="matches",
                to="tournaments.cupgroup",
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="matchday",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="cupgroup",
            index=models.Index(
                fields=["tournament", "name"], name="tournaments__tournam_8a0f6d_idx"
            ),
        ),
        migrations.AlterUniqueTogether(
            name="cupgroup",
            unique_together={("tournament", "name")},
        ),
        migrations.AlterUniqueTogether(
            name="cupgroupteam",
            unique_together={("cup_group", "team")},
        ),
        migrations.AddIndex(
            model_name="match",
            index=models.Index(
                fields=["tournament", "matchday"], name="tournaments__tournam_4b2c1a_idx"
            ),
        ),
    ]
