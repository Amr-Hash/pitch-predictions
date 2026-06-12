from django.db import models


class Tournament(models.Model):
    class StandingRules(models.TextChoices):
        FIFA_WORLD_CUP = "fifa_world_cup", "FIFA World Cup"
        UEFA_CHAMPIONS_LEAGUE = "uefa_champions_league", "UEFA Champions League"
        SIMPLE = "simple", "Simple (points → GD → GF)"

    class LiveScoreProvider(models.TextChoices):
        MANUAL = "manual", "Manual (admin only)"
        API_FOOTBALL = "api_football", "API-Football (api-sports.io)"
        SPORTMONKS = "sportmonks", "SportMonks"

    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True, default="")
    year = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    standing_rules = models.CharField(
        max_length=32,
        choices=StandingRules.choices,
        default=StandingRules.FIFA_WORLD_CUP,
    )
    qualifiers_per_group = models.PositiveSmallIntegerField(
        default=2,
        help_text="How many teams advance from each group (e.g. 2 for World Cup).",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive tournaments are hidden from users (still manageable in admin).",
    )
    is_archived = models.BooleanField(default=False)
    live_score_provider = models.CharField(
        max_length=20,
        choices=LiveScoreProvider.choices,
        default=LiveScoreProvider.MANUAL,
        help_text="External feed used to update live scores for this tournament.",
    )
    live_score_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Provider settings such as league_id and season (API keys live in server env).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "name"]
        indexes = [
            models.Index(fields=["year"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_archived"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.year})"


class Stage(models.Model):
    class StageType(models.TextChoices):
        GROUP = "group", "Group Stage"
        KNOCKOUT = "knockout", "Knockout Stage"

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="stages"
    )
    name = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100, blank=True, default="")
    order = models.PositiveIntegerField()
    stage_type = models.CharField(
        max_length=10, choices=StageType.choices, default=StageType.GROUP
    )

    class Meta:
        ordering = ["order"]
        unique_together = ("tournament", "order")
        indexes = [
            models.Index(fields=["tournament", "order"]),
        ]

    def __str__(self):
        return f"{self.tournament.name} - {self.name}"


class Team(models.Model):
    name = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100, blank=True, default="")
    code = models.CharField(max_length=3, unique=True)
    flag_url = models.URLField(blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["code"]),
        ]

    def __str__(self):
        return self.name


class CupGroup(models.Model):
    """Tournament group (e.g. Group A) within a competition."""

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="cup_groups"
    )
    name = models.CharField(max_length=1)
    name_ar = models.CharField(max_length=50, blank=True, default="")
    teams = models.ManyToManyField(
        Team, through="CupGroupTeam", related_name="cup_groups"
    )

    class Meta:
        ordering = ["name"]
        unique_together = ("tournament", "name")
        indexes = [
            models.Index(fields=["tournament", "name"]),
        ]

    def __str__(self):
        return f"Group {self.name}"


class CupGroupTeam(models.Model):
    cup_group = models.ForeignKey(
        CupGroup, on_delete=models.CASCADE, related_name="group_teams"
    )
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        unique_together = ("cup_group", "team")

    def __str__(self):
        return f"{self.cup_group.name}: {self.team.code}"


class Match(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        LIVE = "live", "Live"
        FINISHED = "finished", "Finished"

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="matches"
    )
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name="matches")
    cup_group = models.ForeignKey(
        CupGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches",
    )
    matchday = models.PositiveSmallIntegerField(null=True, blank=True)
    home_team = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="home_matches"
    )
    away_team = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="away_matches"
    )
    kickoff_time = models.DateTimeField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.SCHEDULED
    )
    home_score = models.PositiveSmallIntegerField(null=True, blank=True)
    away_score = models.PositiveSmallIntegerField(null=True, blank=True)
    winner_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="won_matches",
    )
    external_fixture_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Fixture ID in the tournament live-score provider (for auto sync).",
    )

    class Meta:
        ordering = ["kickoff_time"]
        indexes = [
            models.Index(fields=["tournament", "stage"]),
            models.Index(fields=["tournament", "matchday"]),
            models.Index(fields=["kickoff_time"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.home_team.code} vs {self.away_team.code}"

    @property
    def is_knockout(self):
        return self.stage.stage_type == Stage.StageType.KNOCKOUT

    @property
    def is_kickoff_locked(self):
        from django.utils import timezone
        from django.conf import settings

        lock_time = self.kickoff_time - timezone.timedelta(
            hours=settings.PREDICTION_LOCK_HOURS
        )
        return timezone.now() >= lock_time

    def _matchday_lock_info(self):
        if not self.matchday or self.matchday <= 1:
            return False, None
        if self.stage.stage_type != Stage.StageType.GROUP:
            return False, None

        prev_matchday = self.matchday - 1
        incomplete = (
            Match.objects.filter(
                tournament=self.tournament,
                matchday=prev_matchday,
                stage__stage_type=Stage.StageType.GROUP,
            )
            .exclude(status=self.Status.FINISHED)
            .exists()
        )
        if incomplete:
            return (
                True,
                f"Predictions open after all Matchday {prev_matchday} games finish.",
            )
        return False, None

    def _stage_completion_lock_info(self):
        if self.stage.stage_type != Stage.StageType.KNOCKOUT:
            return False, None

        incomplete = (
            Match.objects.filter(
                tournament=self.tournament,
                stage__order__lt=self.stage.order,
            )
            .exclude(status=self.Status.FINISHED)
            .exists()
        )
        if incomplete:
            return (
                True,
                "Predictions open after all previous round games finish.",
            )
        return False, None

    @property
    def is_matchday_locked(self):
        locked, _ = self._matchday_lock_info()
        return locked

    @property
    def is_stage_locked(self):
        locked, _ = self._stage_completion_lock_info()
        return locked

    @property
    def lock_reason(self):
        matchday_locked, matchday_msg = self._matchday_lock_info()
        if matchday_locked:
            return matchday_msg
        stage_locked, stage_msg = self._stage_completion_lock_info()
        if stage_locked:
            return stage_msg
        if self.is_kickoff_locked:
            return "Prediction window has closed for this match."
        return None

    @property
    def is_locked(self):
        return (
            self.is_kickoff_locked
            or self.is_matchday_locked
            or self.is_stage_locked
        )
