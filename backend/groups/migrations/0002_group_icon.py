from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="icon",
            field=models.CharField(
                choices=[
                    ("university", "University"),
                    ("school", "School"),
                    ("club_friends", "Club friends"),
                ],
                default="club_friends",
                max_length=20,
            ),
        ),
    ]
