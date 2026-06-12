"""Map API-Football team names to internal FIFA-style team codes."""

from __future__ import annotations

from tournaments.wc2026_data import WC2026_TEAMS

# Our code → known API-Football name variants (lowercase).
API_NAME_ALIASES: dict[str, list[str]] = {
    "KOR": ["korea republic", "south korea", "republic of korea"],
    "IRN": ["ir iran", "iran"],
    "CIV": ["cote d'ivoire", "côte d'ivoire", "ivory coast"],
    "CPV": ["cabo verde", "cape verde"],
    "CUW": ["curacao", "curaçao"],
    "TUR": ["turkiye", "türkiye", "turkey"],
    "NED": ["netherlands", "holland"],
    "USA": ["usa", "united states", "united states of america"],
    "RSA": ["south africa"],
    "BIH": ["bosnia and herzegovina", "bosnia-herzegovina"],
    "KSA": ["saudi arabia"],
    "NZL": ["new zealand"],
    "COD": ["congo dr", "dr congo", "congo democratic republic", "democratic republic of the congo"],
    "URU": ["uruguay"],
    "PAR": ["paraguay"],
    "SCO": ["scotland"],
    "ENG": ["england"],
    "GER": ["germany"],
    "FRA": ["france"],
    "ESP": ["spain"],
    "POR": ["portugal"],
    "BRA": ["brazil"],
    "ARG": ["argentina"],
    "MEX": ["mexico"],
    "CAN": ["canada"],
    "EGY": ["egypt"],
    "MAR": ["morocco"],
    "SEN": ["senegal"],
    "GHA": ["ghana"],
    "TUN": ["tunisia"],
    "ALG": ["algeria"],
    "JPN": ["japan"],
    "AUS": ["australia"],
    "SUI": ["switzerland"],
    "BEL": ["belgium"],
    "CRO": ["croatia"],
    "AUT": ["austria"],
    "SWE": ["sweden"],
    "NOR": ["norway"],
    "CZE": ["czechia", "czech republic"],
    "QAT": ["qatar"],
    "HAI": ["haiti"],
    "IRQ": ["iraq"],
    "JOR": ["jordan"],
    "UZB": ["uzbekistan"],
    "COL": ["colombia"],
    "ECU": ["ecuador"],
    "PAN": ["panama"],
}


def _normalize_name(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("'", "'")
        .replace("–", "-")
    )


def build_code_lookup() -> dict[str, str]:
    """API-Football normalized team name → our Team.code."""
    lookup: dict[str, str] = {}
    for name, code, _flag in WC2026_TEAMS:
        lookup[_normalize_name(name)] = code
    for code, aliases in API_NAME_ALIASES.items():
        for alias in aliases:
            lookup[_normalize_name(alias)] = code
    return lookup


def api_team_name_to_code(name: str, lookup: dict[str, str]) -> str | None:
    return lookup.get(_normalize_name(name))
