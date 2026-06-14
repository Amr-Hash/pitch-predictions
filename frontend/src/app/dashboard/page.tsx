"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Dashboard, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loginUrlWithNext } from "@/lib/authRedirect";
import { useTournament } from "@/lib/tournament";
import { DashboardGroupsSlider } from "@/components/DashboardGroupsSlider";
import { GlobalRankPodium } from "@/components/GlobalRankPodium";
import { DashboardLiveHub } from "@/components/DashboardLiveHub";
import { EmptyState } from "@/components/EmptyState";
import { MatchCard } from "@/components/MatchCard";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentTitle } from "@/lib/localize";

function DashboardContent() {
  const { user, token } = useAuth();
  const { selectedTournament } = useTournament();
  const { locale } = useLocale();
  const t = useT();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<number, Prediction>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    setLoading(true);
    setError("");
    setDashboard(null);
    Promise.all([
      api.getDashboard(token, { tournament: selectedTournament.id }),
      api.getPredictions(token, { tournament: selectedTournament.id }),
    ])
      .then(([dashboardData, predictionsData]) => {
        setDashboard(dashboardData);
        const map: Record<number, Prediction> = {};
        for (const prediction of unwrapList(predictionsData)) {
          map[prediction.match] = prediction;
        }
        setPredictionsByMatch(map);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, selectedTournament]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon="⚠️"
          title={t("couldNotLoadDashboard")}
          description={error || t("tryAgain")}
          action={{ label: t("backToHome"), href: "/" }}
        />
      </div>
    );
  }

  if (loading || !dashboard) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        {t("loadingDashboard")}
      </div>
    );
  }

  const pendingCount = dashboard.pending_count ?? dashboard.pending_predictions.length;
  const hasGroups = dashboard.groups.length > 0;
  const hasPending = pendingCount > 0;
  const hasUpcoming = dashboard.upcoming_matches.length > 0;
  const hasResults = dashboard.recent_results.length > 0;
  const tournamentName = tournamentTitle(selectedTournament!, locale);

  return (
    <div>
      <h1 className="page-title mb-2">
        {t("welcomeBack", { name: user!.username })}
      </h1>
      <p className="mb-6 font-medium text-night-700/70">
        {t("overviewFor", { tournament: tournamentName })}
      </p>

      {!hasGroups && <DashboardGroupsSlider groups={dashboard.groups} />}

      <DashboardLiveHub
        nextMatch={dashboard.next_match ?? null}
        liveMatches={dashboard.live_matches ?? []}
        predictionsByMatch={predictionsByMatch}
      />

      <GlobalRankPodium
        podium={dashboard.global_podium ?? []}
        currentRank={dashboard.current_rank}
        totalPoints={dashboard.total_points}
        leaderPoints={dashboard.global_leader_points ?? 0}
      />

      {hasGroups && <DashboardGroupsSlider groups={dashboard.groups} />}

      <div className="mb-8">
        <div className="stat-card-gold">
          <p className="text-sm font-bold uppercase tracking-wide text-gold-700">{t("totalPoints")}</p>
          <p className="font-display text-4xl font-extrabold text-gold-600">{dashboard.total_points}</p>
          {dashboard.total_points === 0 && (
            <p className="mt-1 text-xs text-gray-500">{t("earnPointsHint")}</p>
          )}
        </div>
      </div>

      {hasPending && (
        <section className="mb-8">
          <div className="hero-pending">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold">
                  {t("pendingCountHero", { count: pendingCount })}
                </h2>
                <p className="mt-1 text-sm text-white/90">{t("pendingPredictions")}</p>
              </div>
              <Link
                href="/matches"
                className="rounded-xl bg-white px-5 py-2.5 font-bold text-fan-600 shadow-lg transition hover:bg-gold-50"
              >
                {t("predictNow")}
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.pending_predictions.map((m) => (
                <MatchCard key={m.id} match={m} prediction={predictionsByMatch[m.id]} showPredictLink />
              ))}
            </div>
          </div>
        </section>
      )}

      {!hasPending && (
        <section className="mb-8">
          <EmptyState
            icon="✅"
            title={t("allCaughtUp")}
            description={hasGroups ? t("allCaughtUpWithGroups") : t("allCaughtUpNoGroups")}
            action={
              hasGroups
                ? { label: t("browseMatches"), href: "/matches" }
                : { label: t("joinGroup"), href: "/groups" }
            }
          />
        </section>
      )}

      <section className="mb-8">
        <h2 className="section-heading-pitch mb-4 text-base normal-case tracking-normal">{t("recentResults")}</h2>
        {hasResults ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboard.recent_results.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predictionsByMatch[m.id]}
                showResultLink
              />
            ))}
          </div>
        ) : (
          <EmptyState icon="🏁" title={t("noResultsYet")} description={t("noResultsDesc")} />
        )}
      </section>

      <section className="mb-8">
        <h2 className="section-heading-fan mb-4 text-base normal-case tracking-normal">{t("upcomingMatches")}</h2>
        {hasUpcoming ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.upcoming_matches.map((m) => (
              <MatchCard key={m.id} match={m} prediction={predictionsByMatch[m.id]} showPredictLink />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📅"
            title={t("noUpcomingMatches")}
            description={t("noUpcomingMatchesDesc")}
            action={{ label: t("viewMatches"), href: "/matches" }}
          />
        )}
      </section>

      <section>
        <Link
          href="/scoring"
          className="card card-hover flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-gold-500 bg-gradient-to-r from-gold-50/80 to-white p-5"
        >
          <div>
            <h2 className="font-display text-lg font-extrabold text-night-900">{t("howScoringWorks")}</h2>
            <p className="mt-1 text-sm text-gray-600">{t("scoringIntro")}</p>
          </div>
          <span className="font-bold text-royal-600">{t("learnMore")} →</span>
        </Link>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!authLoading && !user) router.push(loginUrlWithNext("/dashboard"));
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <RequireTournament>
      <DashboardContent />
    </RequireTournament>
  );
}
