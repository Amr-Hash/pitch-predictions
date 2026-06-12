import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def subscribe_existing_users_to_world_cup(apps, schema_editor):
    Tournament = apps.get_model("tournaments", "Tournament")
    TournamentSubscription = apps.get_model("tournaments", "TournamentSubscription")
    User = apps.get_model(settings.AUTH_USER_MODEL)

    tournament = (
        Tournament.objects.filter(
            is_active=True,
            is_archived=False,
            standing_rule_set__competition_type="world_cup",
        )
        .order_by("-year", "-id")
        .first()
    )
    if not tournament:
        tournament = (
            Tournament.objects.filter(is_active=True, is_archived=False)
            .order_by("-year", "-id")
            .first()
        )
    if not tournament:
        return

    for user in User.objects.filter(is_active=True, is_staff=False):
        TournamentSubscription.objects.get_or_create(user_id=user.id, tournament_id=tournament.id)


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0007_standing_rule_sets"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TournamentSubscription",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "tournament",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tournament_subscriptions",
                        to="tournaments.tournament",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tournament_subscriptions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["user", "-created_at"],
                        name="tournaments__user_id_91a4c2_idx",
                    ),
                    models.Index(
                        fields=["tournament", "user"],
                        name="tournaments__tournam_4b8e11_idx",
                    ),
                ],
                "unique_together": {("user", "tournament")},
            },
        ),
        migrations.RunPython(
            subscribe_existing_users_to_world_cup,
            migrations.RunPython.noop,
        ),
    ]
