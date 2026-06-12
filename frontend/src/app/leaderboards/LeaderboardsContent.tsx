"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Group, LeaderboardEntry, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

export default function LeaderboardsContent() {
  const { user, token, loading: authLoading } = useAuth();
  const { selectedTournament } = useTournament();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | "global">(
    searchParams.get("group") ? Number(searchParams.get("group")) : "global"
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.getGroups(token).then((data) => setGroups(unwrapList(data)));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    const tournamentId = selectedTournament.id;
    if (selectedGroup === "global") {
      api.getGlobalLeaderboard(token, tournamentId).then(setLeaderboard);
    } else {
      api.getGroupLeaderboard(token, selectedGroup, tournamentId).then(setLeaderboard);
    }
  }, [token, selectedGroup, selectedTournament]);

  if (authLoading || !user) return <div>{t("loading")}</div>;

  const tournamentName = selectedTournament
    ? tournamentLabel(selectedTournament, locale)
    : "";

  return (
    <RequireTournament>
      <div>
        <h1 className="page-title mb-2">{t("leaderboards")}</h1>
        <p className="mb-6 font-medium text-night-700/70">
          {selectedTournament
            ? t("rankingsFor", { name: tournamentName, year: selectedTournament.year })
            : ""}
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedGroup("global")}
            className={selectedGroup === "global" ? "filter-pill-active" : "filter-pill-inactive"}
          >
            {t("globalLeaderboard")}
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroup(g.id)}
              className={selectedGroup === g.id ? "filter-pill-active" : "filter-pill-inactive"}
            >
              {g.name}
            </button>
          ))}
        </div>

        {leaderboard.length === 0 ? (
          <EmptyState
            icon="📊"
            title={t("noRankingsYet")}
            description={t("noRankingsDesc")}
            action={{ label: t("makePredictions"), href: "/matches" }}
          />
        ) : (
          <LeaderboardTable entries={leaderboard} highlightUserId={user.id} />
        )}
      </div>
    </RequireTournament>
  );
}
