"use client";

import { useTournament } from "@/lib/tournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

export function TournamentSelect() {
  const { tournaments, selectedTournament, setSelectedTournamentId, loading } =
    useTournament();
  const { locale } = useLocale();
  const t = useT();

  if (loading || tournaments.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden font-medium text-gray-500 sm:inline">{t("tournament")}</span>
      <select
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm focus:border-pitch-500 focus:outline-none focus:ring-1 focus:ring-pitch-500"
        value={selectedTournament?.id ?? ""}
        onChange={(e) => setSelectedTournamentId(Number(e.target.value))}
        aria-label={t("selectTournament")}
      >
        {tournaments.map((tournament) => (
          <option key={tournament.id} value={tournament.id}>
            {tournamentLabel(tournament, locale)} ({tournament.year})
          </option>
        ))}
      </select>
    </label>
  );
}
