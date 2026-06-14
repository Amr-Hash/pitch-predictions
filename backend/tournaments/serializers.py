from rest_framework import serializers

import re

from tournaments.services.standing_rule_sets import apply_engine_defaults_to_ruleset
from tournaments.services.team_eligibility import validate_team_ids_for_tournament
from tournaments.services.team_geography import geography_for_team_code
from tournaments.services.tournament_defaults import apply_competition_type_defaults

from .models import CupGroup, CupGroupTeam, Match, Stage, StandingRuleSet, Team, Tournament


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = (
            "id",
            "name",
            "name_ar",
            "code",
            "flag_url",
            "team_type",
            "country_code",
            "continent",
            "division",
        )


class StageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ("id", "name", "name_ar", "order", "stage_type")


class CupGroupTeamSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)

    class Meta:
        model = CupGroupTeam
        fields = ("order", "team")


class CupGroupSerializer(serializers.ModelSerializer):
    group_teams = CupGroupTeamSerializer(many=True, read_only=True)

    class Meta:
        model = CupGroup
        fields = ("id", "tournament", "name", "name_ar", "group_teams")


class CupGroupCreateSerializer(serializers.ModelSerializer):
    team_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, default=list
    )

    class Meta:
        model = CupGroup
        fields = ("id", "tournament", "name", "name_ar", "team_ids")

    def _set_teams(self, cup_group, team_ids):
        cup_group.group_teams.all().delete()
        for order, team_id in enumerate(team_ids):
            CupGroupTeam.objects.create(
                cup_group=cup_group, team_id=team_id, order=order
            )

    def validate(self, attrs):
        tournament = attrs.get("tournament") or (
            self.instance.tournament if self.instance else None
        )
        team_ids = attrs.get("team_ids")
        if team_ids is None and self.initial_data:
            team_ids = self.initial_data.get("team_ids")
        if tournament is not None and team_ids:
            try:
                validate_team_ids_for_tournament(team_ids, tournament)
            except ValueError as exc:
                raise serializers.ValidationError({"team_ids": str(exc)}) from exc
        return super().validate(attrs)

    def create(self, validated_data):
        team_ids = validated_data.pop("team_ids", [])
        cup_group = CupGroup.objects.create(**validated_data)
        if team_ids:
            self._set_teams(cup_group, team_ids)
        return cup_group

    def update(self, instance, validated_data):
        team_ids = validated_data.pop("team_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if team_ids is not None:
            self._set_teams(instance, team_ids)
        return instance


class MatchSerializer(serializers.ModelSerializer):
    home_team = TeamSerializer(read_only=True)
    away_team = TeamSerializer(read_only=True)
    winner_team = TeamSerializer(read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True)
    stage_name_ar = serializers.CharField(source="stage.name_ar", read_only=True)
    cup_group_name = serializers.CharField(source="cup_group.name", read_only=True)
    cup_group_name_ar = serializers.CharField(source="cup_group.name_ar", read_only=True)
    is_knockout = serializers.BooleanField(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    is_matchday_locked = serializers.BooleanField(read_only=True)
    lock_reason = serializers.CharField(read_only=True)

    class Meta:
        model = Match
        fields = (
            "id",
            "tournament",
            "stage",
            "stage_name",
            "stage_name_ar",
            "cup_group",
            "cup_group_name",
            "cup_group_name_ar",
            "matchday",
            "home_team",
            "away_team",
            "kickoff_time",
            "status",
            "home_score",
            "away_score",
            "winner_team",
            "is_knockout",
            "is_locked",
            "is_matchday_locked",
            "lock_reason",
        )


def _validate_match_result(instance, attrs):
    home_score = attrs.get("home_score", instance.home_score)
    away_score = attrs.get("away_score", instance.away_score)
    winner_team = attrs.get("winner_team", instance.winner_team)
    status = attrs.get("status", instance.status)

    if status == Match.Status.FINISHED:
        if home_score is None or away_score is None:
            raise serializers.ValidationError(
                {"home_score": "Scores are required when marking a match as finished."}
            )

    if (
        instance.is_knockout
        and home_score == away_score
        and not winner_team
        and status == Match.Status.FINISHED
    ):
        raise serializers.ValidationError(
            {"winner_team": "Winner is required for tied knockout matches."}
        )

    # Clear penalty-winner when the match did not end in a draw.
    if (
        instance.is_knockout
        and home_score is not None
        and away_score is not None
        and home_score != away_score
    ):
        attrs["winner_team"] = None

    return attrs


class MatchResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ("home_score", "away_score", "winner_team", "status")

    def validate(self, attrs):
        _validate_match_result(self.instance, attrs)
        return attrs


class MatchAdminUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = (
            "tournament",
            "stage",
            "cup_group",
            "matchday",
            "home_team",
            "away_team",
            "kickoff_time",
            "status",
            "home_score",
            "away_score",
            "winner_team",
            "external_fixture_id",
        )

    def validate(self, attrs):
        status = attrs.get("status", self.instance.status if self.instance else None)
        allowed = {
            Match.Status.SCHEDULED,
            Match.Status.LIVE,
            Match.Status.FINISHED,
        }
        if status not in allowed:
            raise serializers.ValidationError({"status": "Invalid match status."})

        if status == Match.Status.LIVE:
            home = attrs.get("home_score", self.instance.home_score)
            away = attrs.get("away_score", self.instance.away_score)
            if home is None or away is None:
                raise serializers.ValidationError(
                    {"home_score": "Both scores are required for a live match."}
                )

        if status == Match.Status.FINISHED and "status" not in attrs and self.instance:
            attrs["status"] = Match.Status.FINISHED

        _validate_match_result(self.instance, attrs)
        return attrs

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class StandingRuleSetSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = StandingRuleSet
        fields = (
            "id",
            "slug",
            "name",
            "name_ar",
            "competition_type",
            "version",
            "engine",
            "qualifiers_per_group",
            "best_third_place_qualifiers",
            "is_active",
        )


class StandingRuleSetSerializer(serializers.ModelSerializer):
    tournament_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = StandingRuleSet
        fields = (
            "id",
            "slug",
            "name",
            "name_ar",
            "competition_type",
            "version",
            "engine",
            "qualifiers_per_group",
            "best_third_place_qualifiers",
            "tiebreakers_en",
            "tiebreakers_ar",
            "third_place_tiebreakers_en",
            "third_place_tiebreakers_ar",
            "is_active",
            "tournament_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "tournament_count")

    def validate_slug(self, value):
        qs = StandingRuleSet.objects.filter(slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A rule set with this slug already exists.")
        return value

    def create(self, validated_data):
        ruleset = StandingRuleSet(**validated_data)
        apply_engine_defaults_to_ruleset(ruleset)
        ruleset.save()
        return ruleset

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        apply_engine_defaults_to_ruleset(instance)
        instance.save()
        return instance


class TournamentRulesMixin:
    def _sync_rules_from_set(self, attrs):
        ruleset = attrs.get("standing_rule_set")
        if ruleset is None:
            return attrs
        if not ruleset.is_active:
            creating = self.instance is None
            changing = (
                self.instance is not None
                and self.instance.standing_rule_set_id != ruleset.id
            )
            if creating or changing:
                raise serializers.ValidationError(
                    {"standing_rule_set": "This rule set is inactive."}
                )
        attrs["standing_rules"] = ruleset.engine
        attrs["qualifiers_per_group"] = ruleset.qualifiers_per_group
        if not attrs.get("competition_type"):
            attrs["competition_type"] = ruleset.competition_type
        return attrs

    def validate(self, attrs):
        attrs = apply_competition_type_defaults(attrs, instance=self.instance)
        attrs = self._sync_rules_from_set(attrs)
        return super().validate(attrs)


class TournamentListSerializer(serializers.ModelSerializer):
    stage_count = serializers.IntegerField(source="stages.count", read_only=True)
    match_count = serializers.IntegerField(source="matches.count", read_only=True)
    standing_rule_set = StandingRuleSetSummarySerializer(read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "name",
            "name_ar",
            "competition_type",
            "allowed_team_type",
            "team_scope",
            "allowed_continent",
            "allowed_country_code",
            "allowed_division",
            "year",
            "start_date",
            "end_date",
            "standing_rules",
            "standing_rule_set",
            "qualifiers_per_group",
            "is_active",
            "is_archived",
            "live_score_provider",
            "live_score_config",
            "stage_count",
            "match_count",
        )


class TournamentDetailSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True, read_only=True)
    cup_groups = CupGroupSerializer(many=True, read_only=True)
    standing_rule_set = StandingRuleSetSummarySerializer(read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "name",
            "name_ar",
            "competition_type",
            "allowed_team_type",
            "team_scope",
            "allowed_continent",
            "allowed_country_code",
            "allowed_division",
            "year",
            "start_date",
            "end_date",
            "standing_rules",
            "standing_rule_set",
            "qualifiers_per_group",
            "is_active",
            "is_archived",
            "live_score_provider",
            "live_score_config",
            "stages",
            "cup_groups",
        )


class TournamentCreateSerializer(TournamentRulesMixin, serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = (
            "id",
            "name",
            "name_ar",
            "competition_type",
            "allowed_team_type",
            "team_scope",
            "allowed_continent",
            "allowed_country_code",
            "allowed_division",
            "year",
            "start_date",
            "end_date",
            "standing_rules",
            "standing_rule_set",
            "qualifiers_per_group",
            "is_active",
            "is_archived",
            "live_score_provider",
            "live_score_config",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs.get("standing_rule_set") and attrs.get("standing_rules"):
            attrs.pop("standing_rules", None)
        if attrs.get("standing_rule_set") and attrs.get("qualifiers_per_group"):
            attrs.pop("qualifiers_per_group", None)
        attrs = super().validate(attrs)
        scope = attrs.get("team_scope", getattr(self.instance, "team_scope", None))
        if scope == Tournament.TeamScope.CONTINENT and not attrs.get(
            "allowed_continent", getattr(self.instance, "allowed_continent", "")
        ):
            raise serializers.ValidationError(
                {"allowed_continent": "Select a continent for this tournament scope."}
            )
        if scope == Tournament.TeamScope.COUNTRY and not attrs.get(
            "allowed_country_code", getattr(self.instance, "allowed_country_code", "")
        ):
            raise serializers.ValidationError(
                {"allowed_country_code": "Enter a country code for this tournament scope."}
            )
        if scope == Tournament.TeamScope.DIVISION and not attrs.get(
            "allowed_division", getattr(self.instance, "allowed_division", "")
        ):
            raise serializers.ValidationError(
                {"allowed_division": "Enter a division/league for this tournament scope."}
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.standing_rule_set_id:
            data["standing_rule_set"] = StandingRuleSetSummarySerializer(
                instance.standing_rule_set
            ).data
        return data


class StageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ("tournament", "name", "name_ar", "order", "stage_type")


class TeamCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = (
            "name",
            "name_ar",
            "code",
            "flag_url",
            "team_type",
            "country_code",
            "continent",
            "division",
        )

    def validate(self, attrs):
        code = attrs.get("code", "")
        flag_url = attrs.get("flag_url", "")
        flag_iso = ""
        flag_match = re.search(r"/([a-z]{2}(?:-[a-z]+)?)\.png", flag_url, re.I)
        if flag_match:
            flag_iso = flag_match.group(1)

        geo = geography_for_team_code(code, flag_iso or None)
        attrs.setdefault("team_type", geo["team_type"])
        attrs.setdefault("country_code", geo["country_code"])
        attrs.setdefault("continent", geo["continent"])

        team_type = attrs.get("team_type", Team.TeamType.NATIONAL)
        if team_type == Team.TeamType.NATIONAL and not attrs.get("continent"):
            raise serializers.ValidationError(
                {"continent": "Continent is required for national teams."}
            )
        if team_type == Team.TeamType.CLUB and not attrs.get("country_code"):
            raise serializers.ValidationError(
                {"country_code": "Country is required for club teams."}
            )
        return super().validate(attrs)


class MatchCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = (
            "tournament",
            "stage",
            "cup_group",
            "matchday",
            "home_team",
            "away_team",
            "kickoff_time",
            "status",
        )

    def validate(self, attrs):
        tournament = attrs.get("tournament")
        if tournament:
            for field in ("home_team", "away_team"):
                team = attrs.get(field)
                if team:
                    try:
                        validate_team_ids_for_tournament([team.id], tournament)
                    except ValueError as exc:
                        raise serializers.ValidationError({field: str(exc)}) from exc
        return super().validate(attrs)
