import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
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
                (
                    "notification_type",
                    models.CharField(
                        choices=[
                            ("match_result", "Match result"),
                            ("group_podium", "Group podium change"),
                        ],
                        max_length=32,
                    ),
                ),
                ("dedup_key", models.CharField(blank=True, default="", max_length=128)),
                ("payload", models.JSONField(default=dict)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "is_read", "-created_at"],
                        name="notificatio_user_id_8f0c0d_idx",
                    ),
                    models.Index(
                        fields=["user", "dedup_key"],
                        name="notificatio_user_id_6e8b2a_idx",
                    ),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                condition=models.Q(("dedup_key", ""), _negated=True),
                fields=("user", "dedup_key"),
                name="notifications_unique_user_dedup_key",
            ),
        ),
    ]
