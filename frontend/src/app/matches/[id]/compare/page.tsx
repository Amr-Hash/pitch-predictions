"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api, Group, GroupMatchPredictions, Match, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { MatchGroupComparisonCard } from "@/components/MatchGroupComparisonCard";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { teamLabel } from "@/lib/localize";

function CompareContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, token, loading: authLoading } = useAuth();
  const { selectedTournament } = useTournament();
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();

  const [match, setMatch] = useState<Match | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<GroupMatchPredictions | null>(null);
  const [loading, setLoading] = useState(true);

  const matchId = Number(id);
  const groupFromQuery = searchParams.get("group");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !matchId) return;
    api
      .getMatches(token)
      .then((data) => {
        const list = unwrapList(data);
        setMatch(list.find((m) => m.id === matchId) || null);
      })
      .catch(() => setMatch(null));
  }, [token, matchId]);

  useEffect(() => {
    if (!token) return;
    api
      .getGroups(token)
      .then((data) => {
        const list = unwrapList(data);
        setGroups(list);
        const queryId = groupFromQuery ? Number(groupFromQuery) : null;
        const initial =
          (queryId && list.some((g) => g.id === queryId) ? queryId : null) ??
          list[0]?.id ??
          null;
        setSelectedGroupId(initial);
      })
      .catch(() => {
        setGroups([]);
        setSelectedGroupId(null);
      })
      .finally(() => setLoading(false));
  }, [token, groupFromQuery]);

  useEffect(() => {
    if (!token || !selectedGroupId || !selectedTournament || !matchId) {
      setComparison(null);
      return;
    }
    api
      .getGroupPredictions(token, selectedGroupId, selectedTournament.id)
      .then((data) => {
        const item = data.matches.find((entry) => entry.match.id === matchId) ?? null;
        setComparison(item);
      })
      .catch(() => setComparison(null));
  }, [token, selectedGroupId, selectedTournament, matchId]);

  const sortedComparison = useMemo(() => {
    if (!comparison || !user) return comparison;
    const predictions = [...comparison.predictions].sort((a, b) => {
      if (comparison.match.status === "finished") {
        return b.points_awarded - a.points_awarded;
      }
      if (a.user_id === user.id) return -1;
      if (b.user_id === user.id) return 1;
      return a.username.localeCompare(b.username);
    });
    return { ...comparison, predictions };
  }, [comparison, user]);

  if (authLoading || !user) return <div>{t("loading")}</div>;
  if (!selectedTournament) return null;
  if (!match) return <div>{t("matchNotFound")}</div>;

  const showPoints = match.status === "finished";
  const hasScore = match.home_score !== null && match.away_score !== null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/matches/${id}/results`}
        className="mb-4 inline-block text-sm text-pitch-600 hover:underline"
      >
        ← {t("backToMatch")}
      </Link>

      <h1 className="page-title mb-2">{t("compareWithGroupTitle")}</h1>
      <p className="mb-6 text-gray-600">{t("compareWithGroupDesc")}</p>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">{teamLabel(match.home_team, locale)}</p>
          <p className="font-display text-3xl font-extrabold tabular-nums">
            {showPoints && hasScore ? `${match.home_score} - ${match.away_score}` : t("vs")}
          </p>
          <p className="font-semibold">{teamLabel(match.away_team, locale)}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">{t("loading")}</p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="👥"
          title={t("noGroupsForCompare")}
          description={t("compareWithGroupDesc")}
          action={{ label: t("myGroups"), href: "/groups" }}
        />
      ) : (
        <>
          {groups.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-gray-700">{t("selectGroupToCompare")}</p>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className={
                      selectedGroupId === group.id ? "filter-pill-active" : "filter-pill-inactive"
                    }
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sortedComparison ? (
            <MatchGroupComparisonCard
              item={sortedComparison}
              locale={locale}
              showPoints={showPoints}
              highlightUserId={user.id}
              compact
            />
          ) : (
            <EmptyState
              icon="📋"
              title={t("noPredictionsForMatch")}
              description={t("compareWithGroupDesc")}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function MatchComparePage() {
  const t = useT();
  return (
    <RequireTournament>
      <Suspense fallback={<div>{t("loading")}</div>}>
        <CompareContent />
      </Suspense>
    </RequireTournament>
  );
}
