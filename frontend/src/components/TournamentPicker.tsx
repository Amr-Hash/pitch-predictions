"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tournament } from "@/lib/api";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

export function TournamentPicker() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();
  const {
    tournaments,
    selectedTournament,
    setSelectedTournamentId,
    loading,
    error,
  } = useTournament();

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-gray-500">
        {t("loadingTournaments")}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title={t("couldNotLoadTournaments")}
        description={error}
        action={{ label: t("tryAgain"), href: "/" }}
      />
    );
  }

  const active = tournaments.filter((tournament) => tournament.is_active !== false);

  if (active.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title={t("noActiveTournaments")}
        description={t("noActiveTournamentsDesc")}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-2 text-center text-2xl font-bold text-pitch-900">
        {t("chooseTournament")}
      </h2>
      <p className="mb-8 text-center text-gray-600">{t("chooseTournamentDesc")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {active.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            selected={selectedTournament?.id === tournament.id}
            onSelect={() => {
              setSelectedTournamentId(tournament.id);
              router.push("/dashboard");
            }}
          />
        ))}
      </div>
      {selectedTournament && (
        <p className="mt-6 text-center text-sm text-gray-500">
          {t("currentlySelected")}{" "}
          <strong>
            {tournamentLabel(selectedTournament, locale)} ({selectedTournament.year})
          </strong>
          .{" "}
          <Link href="/dashboard" className="text-pitch-600 hover:underline">
            {t("openDashboard")}
          </Link>
        </p>
      )}
    </div>
  );
}

function TournamentCard({
  tournament,
  selected,
  onSelect,
}: {
  tournament: Tournament;
  selected: boolean;
  onSelect: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`card card-hover w-full border-t-4 border-t-pitch-500 text-left ${
        selected ? "ring-2 ring-royal-400 ring-offset-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-pitch-900">
            {tournamentLabel(tournament, locale)}
          </h3>
          <p className="text-sm text-gray-500">{tournament.year}</p>
        </div>
        <span className="text-2xl">🏆</span>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        {t("matchesCount", { count: tournament.match_count ?? 0 })}
        {tournament.stage_count
          ? ` · ${t("stagesCount", { count: tournament.stage_count })}`
          : ""}
      </p>
      <p className="mt-4 text-sm font-medium text-pitch-600">
        {selected ? t("selectedEnter") : t("selectTournament")}
      </p>
    </button>
  );
}
