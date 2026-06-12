"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Dashboard, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { MatchCard } from "@/components/MatchCard";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

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
  const tournamentName = tournamentLabel(selectedTournament!, locale);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">
        {t("welcomeBack", { name: user!.username })}
      </h1>
      <p className="mb-6 text-gray-600">
        {t("overviewFor", { name: tournamentName, year: selectedTournament!.year })}
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card bg-pitch-50">
          <p className="text-sm text-gray-600">{t("totalPoints")}</p>
          <p className="text-3xl font-bold text-pitch-700">{dashboard.total_points}</p>
          {dashboard.total_points === 0 && (
            <p className="mt-1 text-xs text-gray-500">{t("earnPointsHint")}</p>
          )}
        </div>
        <Link href="/leaderboards" className="card transition hover:border-pitch-300 hover:shadow-md">
          <p className="text-sm text-gray-600">{t("globalRank")}</p>
          <p className="text-3xl font-bold">{dashboard.current_rank ?? "—"}</p>
          <p className="mt-1 text-xs text-pitch-600">{t("viewGlobalLeaderboard")} →</p>
        </Link>
        <div className="card">
          <p className="text-sm text-gray-600">{t("yourGroups")}</p>
          <p className="text-3xl font-bold">{dashboard.groups.length}</p>
          {!hasGroups && (
            <p className="mt-1 text-xs text-gray-500">{t("joinGroupHint")}</p>
          )}
        </div>
      </div>

      {hasPending && (
        <section className="mb-8">
          <div className="card border-pitch-200 bg-gradient-to-br from-pitch-50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-pitch-900">
                  {t("pendingCountHero", { count: pendingCount })}
                </h2>
                <p className="mt-1 text-sm text-gray-600">{t("pendingPredictions")}</p>
              </div>
              <Link href="/matches" className="btn-primary">
                {t("predictNow")}
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {dashboard.pending_predictions.map((m) => (
                <MatchCard key={m.id} match={m} prediction={predictionsByMatch[m.id]} showPredictLink />
              ))}
            </div>
            {pendingCount > dashboard.pending_predictions.length && (
              <p className="mt-3 text-center text-sm text-gray-500">
                <Link href="/matches" className="text-pitch-600 hover:underline">
                  {t("browseMatches")} →
                </Link>
              </p>
            )}
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("yourGroups")}</h2>
          <Link href="/groups" className="btn-secondary text-sm">
            {t("manageGroups")}
          </Link>
        </div>
        {hasGroups ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.groups.map((g) => {
              const gap = g.leader_points - g.total_points;
              return (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="card block transition hover:border-pitch-300 hover:shadow-md"
                >
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {g.rank != null
                      ? t("groupRank", { rank: g.rank, count: g.member_count })
                      : t("groupMembersCount", { count: g.member_count })}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-pitch-700">
                    {g.total_points} <span className="text-sm font-normal text-gray-500">{t("points")}</span>
                  </p>
                  {gap > 0 && g.rank !== 1 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {t("behindLeader", { points: gap })}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-medium text-pitch-600">{t("openGroup")} →</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="👥"
            title={t("noGroupsYet")}
            description={t("noGroupsDesc")}
            action={{ label: t("createOrJoinGroup"), href: "/groups" }}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">{t("recentResults")}</h2>
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

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("upcomingMatches")}</h2>
        {hasUpcoming ? (
          <div className="grid gap-4 sm:grid-cols-2">
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
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
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
