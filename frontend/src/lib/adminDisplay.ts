import type { NamedEntity } from "./localize";

/** Show English and Arabic together in admin lists. */
export function bilingualAdminLabel(entity: NamedEntity | null | undefined): string {
  if (!entity) return "";
  if (entity.name_ar && entity.name_ar.trim() && entity.name_ar !== entity.name) {
    return `${entity.name} · ${entity.name_ar}`;
  }
  return entity.name;
}

export function teamOptionLabel(team: NamedEntity & { code: string }): string {
  const name = bilingualAdminLabel(team);
  return `${team.code} — ${name}`;
}
