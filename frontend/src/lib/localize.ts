import type { Match, Team, Tournament } from "./api";
import type { Locale } from "./messages";

export interface NamedEntity {
  name: string;
  name_ar?: string;
}

export function localizedName(
  entity: NamedEntity | null | undefined,
  locale: Locale
): string {
  if (!entity) return "";
  if (locale === "ar" && entity.name_ar) return entity.name_ar;
  return entity.name;
}

export function tournamentLabel(tournament: Tournament, locale: Locale): string {
  return localizedName(tournament, locale);
}

export function teamLabel(team: Team, locale: Locale): string {
  return localizedName(team, locale);
}

export function matchContextLabel(
  match: Match,
  locale: Locale,
  groupLabel: string
): string {
  if (match.cup_group_name) {
    const groupName =
      locale === "ar" && match.cup_group_name_ar
        ? match.cup_group_name_ar
        : match.cup_group_name;
    return `${groupLabel} ${groupName}`;
  }
  return locale === "ar" && match.stage_name_ar
    ? match.stage_name_ar
    : match.stage_name;
}
