"use client";

import { useRouter } from "next/navigation";
import { useTournament } from "@/lib/tournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

export function TournamentSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const router = useRouter();
  const { tournaments, selectedTournament, setSelectedTournamentId, clearSelectedTournament } =
    useTournament();
  const { locale } = useLocale();
  const t = useT();
  const isDark = variant === "dark";

  const active = tournaments.filter((item) => item.is_active !== false);

  if (!active.length) {
    return (
      <button
        type="button"
        className={`text-sm font-semibold hover:underline ${
          isDark ? "text-gold-400" : "text-royal-600"
        }`}
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
      <span
        className={`hidden rounded-full px-2.5 py-0.5 text-xs font-bold sm:inline ${
          isDark ? "bg-pitch-600/40 text-pitch-100" : "bg-pitch-100 text-pitch-800"
        }`}
      >
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
        className={isDark ? "input-nav" : "input max-w-[11rem] py-1.5 text-sm"}
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
        className={`hidden text-xs font-semibold hover:underline sm:inline ${
          isDark ? "text-white/60 hover:text-white" : "text-royal-600"
        }`}
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
