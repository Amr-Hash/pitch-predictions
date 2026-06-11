from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0003_tournament_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="name_ar",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="stage",
            name="name_ar",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="team",
            name="name_ar",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="cupgroup",
            name="name_ar",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
    ]
