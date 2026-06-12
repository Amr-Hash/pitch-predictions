"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  Group,
  GroupMatchPredictions,
  GroupMember,
  GroupPredictionsResponse,
  LeaderboardEntry,
  unwrapList,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { RequireTournament } from "@/components/RequireTournament";
import { EmptyState } from "@/components/EmptyState";
import { useLocale, useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel, tournamentLabel } from "@/lib/localize";

type Tab = "overview" | "predictions" | "members";

function formatPrediction(
  pred: GroupMatchPredictions["predictions"][0],
  locale: "en" | "ar",
  t: ReturnType<typeof useT>
) {
  if (pred.predicted_home_score === null || pred.predicted_away_score === null) {
    return t("noPrediction");
  }
  const score = `${pred.predicted_home_score}-${pred.predicted_away_score}`;
  if (pred.predicted_winner_team) {
    return `${score} (${teamLabel(pred.predicted_winner_team, locale)} ${t("advances")})`;
  }
  return score;
}

function GroupDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user, token, loading: authLoading } = useAuth();
  const { selectedTournament } = useTournament();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const groupId = Number(id);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [predictionsData, setPredictionsData] = useState<GroupPredictionsResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !groupId) return;
    setLoading(true);
    setError("");
    Promise.all([
      api.getGroups(token).then((data) => {
        const found = unwrapList(data).find((g) => g.id === groupId) || null;
        setGroup(found);
        if (!found) setError(t("groupNotFound"));
      }),
      api.getGroupMembers(token, groupId).then(setMembers).catch(() => {
        setError(t("groupAccessDenied"));
      }),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, groupId, t]);

  useEffect(() => {
    if (!token || !groupId || !selectedTournament) return;
    api
      .getGroupLeaderboard(token, groupId, selectedTournament.id)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
    api
      .getGroupPredictions(token, groupId, selectedTournament.id)
      .then(setPredictionsData)
      .catch(() => setPredictionsData(null));
  }, [token, groupId, selectedTournament]);

  if (authLoading || !user) return <div>{t("loading")}</div>;

  const myEntry = leaderboard.find((entry) => entry.user_id === user.id);

  return (
    <RequireTournament>
      <div>
        <Link href="/groups" className="mb-4 inline-flex text-sm text-pitch-600 hover:underline">
          ← {t("backToGroups")}
        </Link>

        {loading ? (
          <p className="text-gray-500">{t("loading")}</p>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
        ) : group ? (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="mb-1 text-3xl font-bold">{group.name}</h1>
                {group.description && <p className="mb-2 text-gray-600">{group.description}</p>}
                <p className="text-sm text-gray-500">
                  {t("groupMembersCount", { count: members.length })}
                  {group.is_admin && (
                    <span className="ml-2 rounded bg-gold-400/20 px-2 py-0.5 text-xs font-medium text-gold-600">
                      {t("groupAdmin")}
                    </span>
                  )}
                </p>
                {selectedTournament && (
                  <p className="mt-1 text-sm text-gray-500">
                    {tournamentLabel(selectedTournament, locale)} {selectedTournament.year}
                  </p>
                )}
              </div>
              <Link href="/matches" className="btn-primary text-sm">
                {t("makePredictions")}
              </Link>
            </div>

            <div className="mb-6 flex gap-2 border-b">
              {(["overview", "predictions", "members"] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  className={`border-b-2 px-4 py-2 text-sm font-medium ${
                    tab === tabKey
                      ? "border-pitch-600 text-pitch-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setTab(tabKey)}
                >
                  {tabKey === "overview"
                    ? t("groupOverviewTab")
                    : tabKey === "predictions"
                      ? t("groupPredictionsTab")
                      : t("groupMembersTab")}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <>
                {myEntry && (
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div className="card bg-pitch-50">
                      <p className="text-sm text-gray-600">{t("rank")}</p>
                      <p className="text-2xl font-bold">
                        {myEntry.rank === 1
                          ? "🥇"
                          : myEntry.rank === 2
                            ? "🥈"
                            : myEntry.rank === 3
                              ? "🥉"
                              : myEntry.rank}
                      </p>
                    </div>
                    <div className="card">
                      <p className="text-sm text-gray-600">{t("points")}</p>
                      <p className="text-2xl font-bold text-pitch-700">{myEntry.total_points}</p>
                    </div>
                    <div className="card">
                      <p className="text-sm text-gray-600">{t("exact")}</p>
                      <p className="text-2xl font-bold">{myEntry.exact_predictions}</p>
                    </div>
                  </div>
                )}

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
                          <th className="pb-3 pr-4">{t("player")}</th>
                          <th className="pb-3 pr-4">{t("points")}</th>
                          <th className="pb-3 pr-4">{t("exact")}</th>
                          <th className="pb-3">{t("outcomes")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry) => (
                          <tr
                            key={`${entry.user_id}-${entry.rank}`}
                            className={`border-b last:border-0 ${
                              entry.user_id === user.id ? "bg-pitch-50/60" : ""
                            }`}
                          >
                            <td className="py-3 pr-4">
                              {entry.rank === 1
                                ? "🥇"
                                : entry.rank === 2
                                  ? "🥈"
                                  : entry.rank === 3
                                    ? "🥉"
                                    : entry.rank}
                            </td>
                            <td className="py-3 pr-4 font-medium">
                              {entry.username}
                              {entry.user_id === user.id && (
                                <span className="ml-1 text-xs text-gray-500">({t("you")})</span>
                              )}
                            </td>
                            <td className="py-3 pr-4 font-bold text-pitch-600">{entry.total_points}</td>
                            <td className="py-3 pr-4">{entry.exact_predictions}</td>
                            <td className="py-3">{entry.correct_outcomes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === "members" && (
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="pb-3 pr-4">{t("username")}</th>
                      <th className="pb-3 pr-4">{t("role")}</th>
                      <th className="pb-3">{t("joined")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{member.username}</td>
                        <td className="py-3 pr-4 capitalize">
                          {member.role === "admin" ? t("groupAdmin") : t("groupMember")}
                        </td>
                        <td className="py-3 text-gray-500">
                          {new Date(member.joined_at).toLocaleDateString(
                            locale === "ar" ? "ar-EG" : undefined
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "predictions" && selectedTournament && (
              <>
                <p className="mb-4 text-sm text-gray-600">
                  {t("groupPredictionsFor", {
                    name: tournamentLabel(selectedTournament, locale),
                    year: selectedTournament.year,
                  })}
                </p>
                {!predictionsData || predictionsData.matches.length === 0 ? (
                  <EmptyState
                    icon="🎯"
                    title={t("noGroupPredictionsYet")}
                    description={t("noGroupPredictionsDesc")}
                    action={{ label: t("makePredictions"), href: "/matches" }}
                  />
                ) : (
                  <div className="space-y-4">
                    {predictionsData.matches.map(({ match, predictions }) => {
                      const hasAnyPrediction = predictions.some(
                        (p) => p.predicted_home_score !== null
                      );
                      if (!hasAnyPrediction) return null;
                      return (
                        <div key={match.id} className="card overflow-x-auto">
                          <div className="mb-3 border-b pb-3">
                            <p className="text-xs text-gray-500">
                              {matchContextLabel(match, locale, t("group"))}
                              {match.matchday ? ` · ${t("matchday", { day: match.matchday })}` : ""}
                            </p>
                            <p className="font-semibold">
                              {teamLabel(match.home_team, locale)} vs{" "}
                              {teamLabel(match.away_team, locale)}
                              {match.status === "finished" &&
                                match.home_score !== null &&
                                match.away_score !== null && (
                                  <span className="ml-2 text-pitch-700">
                                    ({match.home_score}-{match.away_score})
                                  </span>
                                )}
                            </p>
                          </div>
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b text-gray-500">
                                <th className="pb-2 pr-4">{t("player")}</th>
                                <th className="pb-2 pr-4">{t("yourPrediction")}</th>
                                <th className="pb-2">{t("points")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {predictions.map((pred) => (
                                <tr key={pred.user_id} className="border-b last:border-0">
                                  <td className="py-2 pr-4 font-medium">{pred.username}</td>
                                  <td className="py-2 pr-4">
                                    {formatPrediction(pred, locale, t)}
                                  </td>
                                  <td className="py-2 font-medium text-pitch-600">
                                    {match.status === "finished" ? pred.points_awarded : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
      </div>
    </RequireTournament>
  );
}

export default function GroupDetailPage() {
  return <GroupDetailContent />;
}
