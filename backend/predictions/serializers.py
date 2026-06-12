from rest_framework import serializers

from tournaments.models import Team
from tournaments.serializers import MatchSerializer, TeamSerializer

from .models import Prediction


class PredictionSerializer(serializers.ModelSerializer):
    match_detail = MatchSerializer(source="match", read_only=True)
    predicted_winner_team = TeamSerializer(read_only=True)
    is_locked = serializers.BooleanField(source="match.is_locked", read_only=True)

    class Meta:
        model = Prediction
        fields = (
            "id",
            "user",
            "match",
            "match_detail",
            "predicted_home_score",
            "predicted_away_score",
            "predicted_winner_team",
            "points_awarded",
            "is_locked",
            "submitted_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user",
            "points_awarded",
            "submitted_at",
            "updated_at",
        )

    def validate(self, attrs):
        from .services.validators import (
            validate_knockout_winner,
            validate_prediction_lock,
        )

        request = self.context["request"]
        match = attrs.get("match") or (self.instance.match if self.instance else None)
        pred_home = attrs.get(
            "predicted_home_score",
            self.instance.predicted_home_score if self.instance else None,
        )
        pred_away = attrs.get(
            "predicted_away_score",
            self.instance.predicted_away_score if self.instance else None,
        )
        pred_winner = attrs.get(
            "predicted_winner_team",
            self.instance.predicted_winner_team if self.instance else None,
        )

        validate_prediction_lock(match)
        validate_knockout_winner(match, pred_home, pred_away, pred_winner)
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PredictionCreateUpdateSerializer(serializers.ModelSerializer):
    predicted_winner_team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        source="predicted_winner_team",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Prediction
        fields = (
            "match",
            "predicted_home_score",
            "predicted_away_score",
            "predicted_winner_team_id",
        )

    def validate(self, attrs):
        from .services.validators import (
            validate_knockout_winner,
            validate_prediction_lock,
        )

        request = self.context["request"]
        match = attrs.get("match") or (self.instance.match if self.instance else None)
        pred_home = attrs.get(
            "predicted_home_score",
            self.instance.predicted_home_score if self.instance else None,
        )
        pred_away = attrs.get(
            "predicted_away_score",
            self.instance.predicted_away_score if self.instance else None,
        )
        pred_winner = attrs.get(
            "predicted_winner_team",
            self.instance.predicted_winner_team if self.instance else None,
        )

        validate_prediction_lock(match)
        validate_knockout_winner(match, pred_home, pred_away, pred_winner)

        if (
            match
            and match.is_knockout
            and pred_home is not None
            and pred_away is not None
            and pred_home != pred_away
        ):
            attrs["predicted_winner_team"] = None

        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
