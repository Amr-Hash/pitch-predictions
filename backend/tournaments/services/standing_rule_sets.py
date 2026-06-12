from __future__ import annotations

from tournaments.models import StandingRuleSet, Tournament
from tournaments.services.standing_rules import ENGINE_RULE_METADATA, get_rule_metadata

WC_RULESET_SLUG = "fifa-world-cup-48-teams"
LEGACY_WC_RULESET_SLUG = "fifa-world-cup-2026"


def engine_defaults(engine: str) -> dict:
    return ENGINE_RULE_METADATA.get(engine, ENGINE_RULE_METADATA[Tournament.StandingRules.SIMPLE])


def apply_engine_defaults_to_ruleset(ruleset: StandingRuleSet) -> StandingRuleSet:
    defaults = engine_defaults(ruleset.engine)
    if not ruleset.tiebreakers_en:
        ruleset.tiebreakers_en = defaults.get("steps_en", [])
    if not ruleset.tiebreakers_ar:
        ruleset.tiebreakers_ar = defaults.get("steps_ar", [])
    if not ruleset.third_place_tiebreakers_en:
        ruleset.third_place_tiebreakers_en = defaults.get("third_place_steps_en", [])
    if not ruleset.third_place_tiebreakers_ar:
        ruleset.third_place_tiebreakers_ar = defaults.get("third_place_steps_ar", [])
    if ruleset.qualifiers_per_group == 2 and "qualifiers_per_group" in defaults:
        pass  # keep explicit value
    if ruleset.best_third_place_qualifiers == 0 and defaults.get("best_third_place_qualifiers"):
        ruleset.best_third_place_qualifiers = defaults["best_third_place_qualifiers"]
    return ruleset


def sync_tournament_from_ruleset(tournament: Tournament) -> None:
    if not tournament.standing_rule_set_id:
        return
    ruleset = tournament.standing_rule_set
    tournament.standing_rules = ruleset.engine
    tournament.qualifiers_per_group = ruleset.qualifiers_per_group


def get_tournament_engine(tournament: Tournament) -> str:
    if tournament.standing_rule_set_id:
        return tournament.standing_rule_set.engine
    return tournament.standing_rules


def get_tournament_rule_metadata(tournament: Tournament) -> dict:
    if tournament.standing_rule_set_id:
        ruleset = tournament.standing_rule_set
        return {
            "label_en": ruleset.name,
            "label_ar": ruleset.name_ar or ruleset.name,
            "qualifiers_per_group": ruleset.qualifiers_per_group,
            "best_third_place_qualifiers": ruleset.best_third_place_qualifiers,
            "steps_en": ruleset.tiebreakers_en or engine_defaults(ruleset.engine).get("steps_en", []),
            "steps_ar": ruleset.tiebreakers_ar or engine_defaults(ruleset.engine).get("steps_ar", []),
            "third_place_steps_en": ruleset.third_place_tiebreakers_en
            or engine_defaults(ruleset.engine).get("third_place_steps_en", []),
            "third_place_steps_ar": ruleset.third_place_tiebreakers_ar
            or engine_defaults(ruleset.engine).get("third_place_steps_ar", []),
            "engine": ruleset.engine,
            "rule_set_id": ruleset.id,
            "rule_set_slug": ruleset.slug,
            "version": ruleset.version,
            "competition_type": ruleset.competition_type,
        }
    meta = get_rule_metadata(tournament.standing_rules)
    return {
        **meta,
        "engine": tournament.standing_rules,
        "rule_set_id": None,
        "rule_set_slug": None,
        "version": None,
        "competition_type": None,
    }


def default_rule_sets() -> list[dict]:
    """Built-in rule sets seeded on migration and deploy sync."""
    wc = engine_defaults(Tournament.StandingRules.FIFA_WORLD_CUP)
    ucl = engine_defaults(Tournament.StandingRules.UEFA_CHAMPIONS_LEAGUE)
    simple = engine_defaults(Tournament.StandingRules.SIMPLE)
    return [
        {
            "slug": WC_RULESET_SLUG,
            "name": "FIFA World Cup",
            "name_ar": "كأس العالم",
            "competition_type": StandingRuleSet.CompetitionType.WORLD_CUP,
            "version": "48 teams",
            "engine": Tournament.StandingRules.FIFA_WORLD_CUP,
            "qualifiers_per_group": wc["qualifiers_per_group"],
            "best_third_place_qualifiers": wc.get("best_third_place_qualifiers", 0),
            "tiebreakers_en": wc["steps_en"],
            "tiebreakers_ar": wc["steps_ar"],
            "third_place_tiebreakers_en": wc.get("third_place_steps_en", []),
            "third_place_tiebreakers_ar": wc.get("third_place_steps_ar", []),
        },
        {
            "slug": "uefa-champions-league-standard",
            "name": "UEFA Champions League (standard)",
            "name_ar": "دوري أبطال أوروبا (قياسي)",
            "competition_type": StandingRuleSet.CompetitionType.CHAMPIONS_LEAGUE,
            "version": "standard",
            "engine": Tournament.StandingRules.UEFA_CHAMPIONS_LEAGUE,
            "qualifiers_per_group": ucl["qualifiers_per_group"],
            "best_third_place_qualifiers": 0,
            "tiebreakers_en": ucl["steps_en"],
            "tiebreakers_ar": ucl["steps_ar"],
            "third_place_tiebreakers_en": [],
            "third_place_tiebreakers_ar": [],
        },
        {
            "slug": "simple-default",
            "name": "Simple standings",
            "name_ar": "ترتيب بسيط",
            "competition_type": StandingRuleSet.CompetitionType.OTHER,
            "version": "1",
            "engine": Tournament.StandingRules.SIMPLE,
            "qualifiers_per_group": simple["qualifiers_per_group"],
            "best_third_place_qualifiers": 0,
            "tiebreakers_en": simple["steps_en"],
            "tiebreakers_ar": simple["steps_ar"],
            "third_place_tiebreakers_en": [],
            "third_place_tiebreakers_ar": [],
        },
    ]


def sync_builtin_rule_sets() -> int:
    """Upsert built-in standing rule sets; migrate legacy World Cup slug."""
    for row in default_rule_sets():
        ruleset, _created = StandingRuleSet.objects.update_or_create(
            slug=row["slug"],
            defaults={key: value for key, value in row.items() if key != "slug"}
            | {"is_active": True},
        )
        apply_engine_defaults_to_ruleset(ruleset)
        ruleset.save()

    new_ruleset = StandingRuleSet.objects.filter(slug=WC_RULESET_SLUG).first()
    old_ruleset = StandingRuleSet.objects.filter(slug=LEGACY_WC_RULESET_SLUG).first()
    if new_ruleset and old_ruleset and new_ruleset.id != old_ruleset.id:
        Tournament.objects.filter(standing_rule_set_id=old_ruleset.id).update(
            standing_rule_set_id=new_ruleset.id,
            standing_rules=new_ruleset.engine,
            qualifiers_per_group=new_ruleset.qualifiers_per_group,
        )
        if not Tournament.objects.filter(standing_rule_set_id=old_ruleset.id).exists():
            old_ruleset.delete()

    return StandingRuleSet.objects.filter(slug__in=[r["slug"] for r in default_rule_sets()]).count()


def sync_world_cup_tournaments() -> int:
    """Ensure FIFA World Cup tournaments use 48-team rules and API-Football live scores."""
    from tournaments.wc2026_data import WC2026_TOURNAMENT

    ruleset = StandingRuleSet.objects.filter(slug=WC_RULESET_SLUG).first()
    if not ruleset:
        sync_builtin_rule_sets()
        ruleset = StandingRuleSet.objects.filter(slug=WC_RULESET_SLUG).first()
    if not ruleset:
        return 0

    live_config = {"league_id": 1, "season": 2026}
    updated = 0
    for tournament in Tournament.objects.filter(
        name=WC2026_TOURNAMENT["name"],
        year=WC2026_TOURNAMENT["year"],
    ):
        save_fields: list[str] = []
        if tournament.competition_type != StandingRuleSet.CompetitionType.WORLD_CUP:
            tournament.competition_type = StandingRuleSet.CompetitionType.WORLD_CUP
            save_fields.append("competition_type")
        if tournament.standing_rule_set_id != ruleset.id:
            tournament.standing_rule_set = ruleset
            tournament.standing_rules = ruleset.engine
            tournament.qualifiers_per_group = ruleset.qualifiers_per_group
            save_fields.extend(
                ["standing_rule_set", "standing_rules", "qualifiers_per_group"]
            )
        if tournament.live_score_provider != Tournament.LiveScoreProvider.API_FOOTBALL:
            tournament.live_score_provider = Tournament.LiveScoreProvider.API_FOOTBALL
            save_fields.append("live_score_provider")
        if tournament.live_score_config != live_config:
            tournament.live_score_config = live_config
            save_fields.append("live_score_config")
        if save_fields:
            tournament.save(update_fields=save_fields)
            updated += 1
    return updated
