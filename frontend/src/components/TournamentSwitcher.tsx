"use client";

import { useRouter } from "next/navigation";
import { useTournament } from "@/lib/tournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

export function TournamentSwitcher() {
  const router = useRouter();
  const { tournaments, selectedTournament, setSelectedTournamentId, clearSelectedTournament } =
    useTournament();
  const { locale } = useLocale();
  const t = useT();

  const active = tournaments.filter((item) => item.is_active !== false);

  if (!active.length) {
    return (
      <button
        type="button"
        className="text-sm font-medium text-pitch-600 hover:underline"
        onClick={() => {
          clearSelectedTournament();
          router.push("/?pick=1");
        }}
      >
        {t("chooseTournament")}
      </button>
    );
  }

  if (active.length === 1 && selectedTournament) {
    return (
      <span className="hidden rounded-full bg-pitch-50 px-2 py-0.5 text-xs font-medium text-pitch-800 sm:inline">
        {tournamentLabel(selectedTournament, locale)} {selectedTournament.year}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tournament-switcher" className="sr-only">
        {t("chooseTournament")}
      </label>
      <select
        id="tournament-switcher"
        className="input max-w-[11rem] py-1.5 text-sm"
        value={selectedTournament?.id ?? ""}
        onChange={(e) => {
          const id = Number(e.target.value);
          if (id) setSelectedTournamentId(id);
        }}
      >
        {!selectedTournament && <option value="">{t("chooseTournament")}</option>}
        {active.map((tournament) => (
          <option key={tournament.id} value={tournament.id}>
            {tournamentLabel(tournament, locale)} {tournament.year}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="hidden text-xs text-pitch-600 hover:underline sm:inline"
        onClick={() => {
          clearSelectedTournament();
          router.push("/?pick=1");
        }}
      >
        {t("allTournaments")}
      </button>
    </div>
  );
}
