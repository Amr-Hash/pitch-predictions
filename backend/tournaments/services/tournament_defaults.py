from __future__ import annotations

from tournaments.models import StandingRuleSet, Tournament
from tournaments.services.standing_rule_sets import WC_RULESET_SLUG

UCL_RULESET_SLUG = "uefa-champions-league-standard"
SIMPLE_RULESET_SLUG = "simple-default"


def default_ruleset_for_competition_type(
    competition_type: str,
) -> StandingRuleSet | None:
    slug_by_type = {
        StandingRuleSet.CompetitionType.WORLD_CUP: WC_RULESET_SLUG,
        StandingRuleSet.CompetitionType.CHAMPIONS_LEAGUE: UCL_RULESET_SLUG,
        StandingRuleSet.CompetitionType.OTHER: SIMPLE_RULESET_SLUG,
    }
    slug = slug_by_type.get(competition_type)
    if not slug:
        return None
    return StandingRuleSet.objects.filter(slug=slug, is_active=True).first()


def default_live_score_for_competition_type(
    competition_type: str,
    *,
    year: int | None = None,
) -> tuple[str, dict]:
    if competition_type == StandingRuleSet.CompetitionType.WORLD_CUP:
        season = year or 2026
        return (
            Tournament.LiveScoreProvider.API_FOOTBALL,
            {"league_id": 1, "season": season},
        )
    return Tournament.LiveScoreProvider.MANUAL, {}


def apply_competition_type_defaults(
    attrs: dict,
    *,
    instance: Tournament | None = None,
) -> dict:
    """Fill standing rules and live-score defaults from competition_type when omitted."""
    competition_type = attrs.get("competition_type")
    if instance and competition_type is None:
        competition_type = instance.competition_type

    ruleset = attrs.get("standing_rule_set")
    if ruleset and not competition_type:
        attrs["competition_type"] = ruleset.competition_type
        competition_type = ruleset.competition_type

    year = attrs.get("year") or (instance.year if instance else None)

    if competition_type and not ruleset:
        default_ruleset = default_ruleset_for_competition_type(competition_type)
        if default_ruleset:
            attrs["standing_rule_set"] = default_ruleset

    if competition_type and "live_score_provider" not in attrs:
        provider, config = default_live_score_for_competition_type(
            competition_type, year=year
        )
        attrs["live_score_provider"] = provider
        if "live_score_config" not in attrs and config:
            attrs["live_score_config"] = config

    return attrs
