from dataclasses import dataclass, field

from tournaments.models import CupGroup, Match, Stage, Tournament
from tournaments.services.standing_rules import get_rule_metadata


@dataclass
class TeamStandingStats:
    team_id: int
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    away_goals_for: int = 0
    points: int = 0

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against


def _empty_stats(team_ids):
    return {team_id: TeamStandingStats(team_id=team_id) for team_id in team_ids}


def _apply_match(stats: dict[int, TeamStandingStats], match: Match):
    home_id = match.home_team_id
    away_id = match.away_team_id
    home_goals = match.home_score or 0
    away_goals = match.away_score or 0

    home = stats[home_id]
    away = stats[away_id]

    home.played += 1
    away.played += 1
    home.goals_for += home_goals
    home.goals_against += away_goals
    away.goals_for += away_goals
    away.goals_against += home_goals
    away.away_goals_for += away_goals

    if home_goals > away_goals:
        home.won += 1
        away.lost += 1
        home.points += 3
    elif away_goals > home_goals:
        away.won += 1
        home.lost += 1
        away.points += 3
    else:
        home.drawn += 1
        away.drawn += 1
        home.points += 1
        away.points += 1


def _stats_for_teams(team_ids, matches):
    stats = _empty_stats(team_ids)
    for match in matches:
        if match.home_team_id in stats and match.away_team_id in stats:
            _apply_match(stats, match)
    return stats


def _teams_tied_on_points(team_id, all_stats):
    points = all_stats[team_id].points
    return [tid for tid, row in all_stats.items() if row.points == points]


def _h2h_matches(matches, team_ids):
    team_set = set(team_ids)
    return [
        match
        for match in matches
        if match.home_team_id in team_set and match.away_team_id in team_set
    ]


def _code_tiebreak(team_id, team_codes):
    """Prefer ascending team code when all sport tie-breakers are equal."""
    return tuple(-ord(char) for char in team_codes[team_id])


def _sort_key(team_id, all_stats, matches, rules_key, team_codes):
    stats = all_stats[team_id]
    tied_ids = _teams_tied_on_points(team_id, all_stats)
    h2h_stats = _stats_for_teams(tied_ids, _h2h_matches(matches, tied_ids))
    h2h = h2h_stats[team_id]
    use_h2h = len(tied_ids) > 1

    if rules_key == Tournament.StandingRules.UEFA_CHAMPIONS_LEAGUE:
        return (
            stats.points,
            h2h.points if use_h2h else stats.points,
            h2h.goal_difference if use_h2h else stats.goal_difference,
            h2h.goals_for if use_h2h else stats.goals_for,
            stats.goal_difference,
            stats.goals_for,
            stats.away_goals_for,
            stats.won,
            _code_tiebreak(team_id, team_codes),
        )

    if rules_key == Tournament.StandingRules.FIFA_WORLD_CUP:
        return (
            stats.points,
            stats.goal_difference,
            stats.goals_for,
            h2h.points if use_h2h else stats.points,
            h2h.goal_difference if use_h2h else stats.goal_difference,
            h2h.goals_for if use_h2h else stats.goals_for,
            _code_tiebreak(team_id, team_codes),
        )

    return (
        stats.points,
        stats.goal_difference,
        stats.goals_for,
        _code_tiebreak(team_id, team_codes),
    )


def _group_matches(cup_group: CupGroup):
    return list(
        Match.objects.filter(
            cup_group=cup_group,
            stage__stage_type=Stage.StageType.GROUP,
            status=Match.Status.FINISHED,
            home_score__isnull=False,
            away_score__isnull=False,
        ).select_related("home_team", "away_team")
    )


def build_cup_group_standings(cup_group: CupGroup, tournament: Tournament):
    team_rows = list(cup_group.group_teams.select_related("team").order_by("order"))
    team_ids = [row.team_id for row in team_rows]
    team_codes = {row.team_id: row.team.code for row in team_rows}
    teams_by_id = {row.team_id: row.team for row in team_rows}

    matches = _group_matches(cup_group)
    all_stats = _stats_for_teams(team_ids, matches)
    rules_key = tournament.standing_rules
    meta = get_rule_metadata(rules_key)
    qualifiers = tournament.qualifiers_per_group or meta["qualifiers_per_group"]

    ordered_ids = sorted(
        team_ids,
        key=lambda team_id: _sort_key(
            team_id, all_stats, matches, rules_key, team_codes
        ),
        reverse=True,
    )

    standings = []
    for index, team_id in enumerate(ordered_ids, start=1):
        row = all_stats[team_id]
        team = teams_by_id[team_id]
        standings.append(
            {
                "rank": index,
                "team": {
                    "id": team.id,
                    "name": team.name,
                    "name_ar": team.name_ar,
                    "code": team.code,
                    "flag_url": team.flag_url,
                },
                "played": row.played,
                "won": row.won,
                "drawn": row.drawn,
                "lost": row.lost,
                "goals_for": row.goals_for,
                "goals_against": row.goals_against,
                "goal_difference": row.goal_difference,
                "points": row.points,
                "qualifies": index <= qualifiers,
            }
        )

    return {
        "group_id": cup_group.id,
        "group_name": cup_group.name,
        "group_name_ar": cup_group.name_ar,
        "standings": standings,
    }


def build_tournament_standings(tournament: Tournament):
    meta = get_rule_metadata(tournament.standing_rules)
    groups = (
        CupGroup.objects.filter(tournament=tournament)
        .prefetch_related("group_teams__team")
        .order_by("name")
    )
    return {
        "tournament_id": tournament.id,
        "standing_rules": tournament.standing_rules,
        "standing_rules_label_en": meta["label_en"],
        "standing_rules_label_ar": meta["label_ar"],
        "tiebreakers_en": meta["steps_en"],
        "tiebreakers_ar": meta["steps_ar"],
        "qualifiers_per_group": tournament.qualifiers_per_group
        or meta["qualifiers_per_group"],
        "groups": [build_cup_group_standings(group, tournament) for group in groups],
    }
