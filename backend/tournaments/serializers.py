from rest_framework import serializers

from .models import CupGroup, CupGroupTeam, Match, Stage, Team, Tournament


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ("id", "name", "name_ar", "code", "flag_url")


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
        from predictions.services.scoring import recalculate_match_scores

        match = super().update(instance, validated_data)
        if (
            match.status == Match.Status.FINISHED
            and match.home_score is not None
            and match.away_score is not None
        ):
            recalculate_match_scores(match)
        return match


class TournamentListSerializer(serializers.ModelSerializer):
    stage_count = serializers.IntegerField(source="stages.count", read_only=True)
    match_count = serializers.IntegerField(source="matches.count", read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "name",
            "name_ar",
            "year",
            "start_date",
            "end_date",
            "standing_rules",
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

    class Meta:
        model = Tournament
        fields = (
            "id",
            "name",
            "name_ar",
            "year",
            "start_date",
            "end_date",
            "standing_rules",
            "qualifiers_per_group",
            "is_active",
            "is_archived",
            "live_score_provider",
            "live_score_config",
            "stages",
            "cup_groups",
        )


class TournamentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = (
            "id",
            "name",
            "name_ar",
            "year",
            "start_date",
            "end_date",
            "standing_rules",
            "qualifiers_per_group",
            "is_active",
            "is_archived",
            "live_score_provider",
            "live_score_config",
        )
        read_only_fields = ("id",)


class StageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ("tournament", "name", "name_ar", "order", "stage_type")


class TeamCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ("name", "name_ar", "code", "flag_url")


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
