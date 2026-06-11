from django.contrib import admin

from .models import Match, Stage, Team, Tournament


class StageInline(admin.TabularInline):
    model = Stage
    extra = 0


class MatchInline(admin.TabularInline):
    model = Match
    extra = 0
    raw_id_fields = ("home_team", "away_team", "winner_team")


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("name", "year", "start_date", "end_date", "is_archived")
    list_filter = ("year", "is_archived")
    inlines = [StageInline]


@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display = ("name", "tournament", "order", "stage_type")
    list_filter = ("stage_type", "tournament")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "flag_url")
    search_fields = ("name", "code")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "home_team",
        "away_team",
        "cup_group",
        "matchday",
        "stage",
        "kickoff_time",
        "status",
        "home_score",
        "away_score",
    )
    list_filter = ("status", "tournament", "stage", "matchday", "cup_group")
    raw_id_fields = ("home_team", "away_team", "winner_team")
    actions = ["recalculate_scores"]

    @admin.action(description="Recalculate prediction scores for selected matches")
    def recalculate_scores(self, request, queryset):
        from predictions.services.scoring import recalculate_match_scores

        count = 0
        for match in queryset.filter(status=Match.Status.FINISHED):
            recalculate_match_scores(match)
            count += 1
        self.message_user(request, f"Recalculated scores for {count} match(es).")
