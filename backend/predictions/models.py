from django.conf import settings
from django.db import models


class Prediction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="predictions",
    )
    match = models.ForeignKey(
        "tournaments.Match",
        on_delete=models.CASCADE,
        related_name="predictions",
    )
    predicted_home_score = models.PositiveSmallIntegerField()
    predicted_away_score = models.PositiveSmallIntegerField()
    predicted_winner_team = models.ForeignKey(
        "tournaments.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="predicted_wins",
    )
    points_awarded = models.PositiveSmallIntegerField(default=0)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "match")
        indexes = [
            models.Index(fields=["user", "match"]),
            models.Index(fields=["match"]),
            models.Index(fields=["user", "points_awarded"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.match}"


class GlobalLeaderboardEntry(models.Model):
    tournament = models.ForeignKey(
        "tournaments.Tournament",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="global_leaderboard_entries",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="global_leaderboard_entries",
    )
    total_points = models.PositiveIntegerField(default=0)
    exact_predictions = models.PositiveIntegerField(default=0)
    correct_outcomes = models.PositiveIntegerField(default=0)
    rank = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("tournament", "user")
        indexes = [
            models.Index(fields=["tournament", "rank"]),
        ]


class GroupLeaderboardEntry(models.Model):
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="leaderboard_entries",
    )
    tournament = models.ForeignKey(
        "tournaments.Tournament",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="group_leaderboard_entries",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_leaderboard_entries",
    )
    total_points = models.PositiveIntegerField(default=0)
    exact_predictions = models.PositiveIntegerField(default=0)
    correct_outcomes = models.PositiveIntegerField(default=0)
    rank = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("group", "tournament", "user")
        indexes = [
            models.Index(fields=["group", "tournament", "rank"]),
        ]


class BackgroundJob(models.Model):
    class JobType(models.TextChoices):
        PROCESS_SCORING_NOTIFICATIONS = "process_scoring_notifications", "Process scoring notifications"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    job_type = models.CharField(max_length=64, choices=JobType.choices)
    payload = models.JSONField(default=dict)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.job_type} ({self.status})"
