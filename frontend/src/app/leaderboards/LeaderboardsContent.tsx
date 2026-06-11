"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Group, LeaderboardEntry, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
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
      <h1 className="mb-2 text-3xl font-bold">{t("leaderboards")}</h1>
      <p className="mb-6 text-gray-600">
        {selectedTournament
          ? t("rankingsFor", { name: tournamentName, year: selectedTournament.year })
          : ""}
      </p>

      <div className="mb-6">
        <select
          className="input max-w-xs"
          value={selectedGroup}
          onChange={(e) =>
            setSelectedGroup(e.target.value === "global" ? "global" : Number(e.target.value))
          }
        >
          <option value="global">{t("globalLeaderboard")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {leaderboard.length === 0 ? (
        <EmptyState
          icon="📊"
          title={t("noRankingsYet")}
          description={t("noRankingsDesc")}
          action={{ label: t("makePredictions"), href: "/matches" }}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-3 pr-4">{t("rank")}</th>
                <th className="pb-3 pr-4">{t("username")}</th>
                <th className="pb-3 pr-4">{t("points")}</th>
                <th className="pb-3 pr-4">{t("exact")}</th>
                <th className="pb-3">{t("outcomes")}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={`${entry.user_id}-${entry.rank}`} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                  </td>
                  <td className="py-3 pr-4 font-medium">{entry.username}</td>
                  <td className="py-3 pr-4 font-bold text-pitch-600">{entry.total_points}</td>
                  <td className="py-3 pr-4">{entry.exact_predictions}</td>
                  <td className="py-3">{entry.correct_outcomes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </RequireTournament>
  );
}
