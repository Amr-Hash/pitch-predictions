from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0004_alter_group_icon"),
    ]

    operations = [
        migrations.AlterField(
            model_name="group",
            name="icon",
            field=models.CharField(
                choices=[
                    ("friends", "Friends"),
                    ("family", "Family"),
                    ("coworkers", "Coworkers"),
                    ("neighbors", "Neighbors"),
                    ("university", "University"),
                    ("school", "School"),
                    ("club_friends", "Club friends"),
                    ("cafe_friends", "Café friends"),
                    ("best_friends", "Best friends"),
                    ("others", "Others"),
                ],
                default="club_friends",
                max_length=20,
            ),
        ),
    ]
