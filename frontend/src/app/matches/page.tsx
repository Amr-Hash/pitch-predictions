"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Match, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState } from "@/components/EmptyState";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";
import { MATCHDAY_SECTION_CLASS } from "@/lib/theme";

function MatchesContent() {
  const { user, token, loading: authLoading } = useAuth();
  const { selectedTournament } = useTournament();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cupGroupFilter = searchParams.get("cup_group") || "";
  const matchdayFilter = searchParams.get("matchday") || "";

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<number, Prediction>>({});

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    const params: { cup_group?: string; matchday?: number; tournament: number } = {
      tournament: selectedTournament.id,
    };
    if (cupGroupFilter) params.cup_group = cupGroupFilter;
    if (matchdayFilter) params.matchday = Number(matchdayFilter);
    Promise.all([
      api.getMatches(token, params).then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setMatches(list);
      }),
      api.getPredictions(token, { tournament: selectedTournament.id }).then((data) => {
        const map: Record<number, Prediction> = {};
        for (const prediction of unwrapList(data)) {
          map[prediction.match] = prediction;
        }
        setPredictionsByMatch(map);
      }),
    ]);
  }, [token, cupGroupFilter, matchdayFilter, selectedTournament]);

  const grouped = useMemo(() => {
    const byDay: Record<number, Match[]> = { 1: [], 2: [], 3: [] };
    for (const m of matches) {
      const day = m.matchday || 0;
      if (day >= 1 && day <= 3) byDay[day].push(m);
    }
    return byDay;
  }, [matches]);

  if (authLoading || !user) return <div>{t("loading")}</div>;
  if (!selectedTournament) return null;

  const isTestCup = selectedTournament.name === "Demo Test Cup";
  const tournamentName = tournamentLabel(selectedTournament, locale);
  const showGrouped = !matchdayFilter && matches.some((m) => m.matchday);
  const tournamentQuery = `tournament=${selectedTournament.id}`;
  const baseQuery = [tournamentQuery, cupGroupFilter ? `cup_group=${cupGroupFilter}` : ""]
    .filter(Boolean)
    .join("&");

  return (
    <div>
      <h1 className="page-title mb-2">{t("matches")}</h1>
      <p className="mb-4 text-gray-600">
        {tournamentName} ({selectedTournament.year}) — {t("fixtures", { count: matches.length })}
      </p>

      {isTestCup && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>{t("demoTestCup")}</strong> — {t("demoTestCupMatchesDesc")}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterLink
          href={baseQuery ? `/matches?${baseQuery}` : "/matches"}
          active={!matchdayFilter}
        >
          {t("allMatchdays")}
        </FilterLink>
        {[1, 2, 3].map((day) => {
          const parts = [tournamentQuery, `matchday=${day}`, cupGroupFilter ? `cup_group=${cupGroupFilter}` : ""]
            .filter(Boolean)
            .join("&");
          return (
            <FilterLink
              key={day}
              href={`/matches?${parts}`}
              active={matchdayFilter === String(day)}
            >
              {t("filterMatchday", { day })}
            </FilterLink>
          );
        })}
        {cupGroupFilter && (
          <span className="rounded-full bg-pitch-100 px-3 py-1 text-sm text-pitch-800">
            {t("group")} {cupGroupFilter}
          </span>
        )}
      </div>

      {matches.length === 0 ? (
        <EmptyState
          icon="📅"
          title={t("noMatchesForTournament")}
          description={t("noMatchesDesc")}
        />
      ) : showGrouped ? (
        [1, 2, 3].map((day) =>
          grouped[day].length > 0 ? (
            <section key={day} className="mb-10">
              <h2 className={`mb-4 text-lg ${MATCHDAY_SECTION_CLASS[day] ?? "section-heading"}`}>
                {t("filterMatchday", { day })}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[day].map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predictionsByMatch[m.id]}
                    showPredictLink
                    showResultLink
                  />
                ))}
              </div>
            </section>
          ) : null
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              prediction={predictionsByMatch[m.id]}
              showPredictLink
              showResultLink
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={active ? "filter-pill-active" : "filter-pill-inactive"}
    >
      {children}
    </Link>
  );
}

export default function MatchesPage() {
  const t = useT();
  return (
    <RequireTournament>
      <Suspense fallback={<div>{t("loading")}</div>}>
        <MatchesContent />
      </Suspense>
    </RequireTournament>
  );
}
