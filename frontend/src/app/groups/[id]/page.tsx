"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  Group,
  GroupMember,
  GroupPredictionsResponse,
  LeaderboardEntry,
  unwrapList,
} from "@/lib/api";
import { loginUrlWithNext } from "@/lib/authRedirect";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { RequireTournament } from "@/components/RequireTournament";
import { EmptyState } from "@/components/EmptyState";
import { GroupInviteShare } from "@/components/GroupInviteShare";
import { GroupPredictionsPanel } from "@/components/GroupPredictionsPanel";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { PageTabs } from "@/components/PageTabs";
import { useLocale, useT } from "@/lib/i18n";
import { tournamentLabel } from "@/lib/localize";

type Tab = "overview" | "predictions" | "members";

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
    if (!authLoading && !user) {
      router.push(loginUrlWithNext(`/groups/${groupId}`));
    }
  }, [authLoading, user, router, groupId]);

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
        <Link href="/groups" className="link-back mb-4">
          ← {t("backToGroups")}
        </Link>

        {loading ? (
          <p className="text-gray-500">{t("loading")}</p>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : group ? (
          <>
            <div className="league-hero mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl font-extrabold">{group.name}</h1>
                  {group.description && (
                    <p className="mt-1 text-white/90">{group.description}</p>
                  )}
                  <p className="mt-2 text-sm text-white/80">
                    {t("groupMembersCount", { count: members.length })}
                    {group.is_admin && (
                      <span className="ml-2 rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold text-night-900">
                        {t("groupAdmin")}
                      </span>
                    )}
                  </p>
                  {selectedTournament && (
                    <p className="mt-1 text-sm text-white/70">
                      {tournamentLabel(selectedTournament, locale)} {selectedTournament.year}
                    </p>
                  )}
                </div>
                <Link
                  href="/matches"
                  className="rounded-full bg-white px-5 py-2 text-sm font-bold text-royal-700 shadow transition hover:bg-gold-100"
                >
                  {t("makePredictions")}
                </Link>
              </div>
              <GroupInviteShare
                inviteCode={group.invite_code}
                variant="dark"
                className="mt-5 border-t border-white/20 pt-5"
              />
            </div>

            <PageTabs
              tabs={[
                { id: "overview" as const, label: t("groupOverviewTab") },
                { id: "predictions" as const, label: t("groupPredictionsTab") },
                { id: "members" as const, label: t("groupMembersTab") },
              ]}
              active={tab}
              onChange={setTab}
            />

            {tab === "overview" && (
              <>
                {myEntry && (
                  <div className="mb-6 grid gap-4 sm:grid-cols-3">
                    <div className="stat-card-fan">
                      <p className="text-sm font-bold uppercase tracking-wide text-fan-700">
                        {t("rank")}
                      </p>
                      <p className="font-display text-3xl font-extrabold">
                        {myEntry.rank === 1
                          ? "🥇"
                          : myEntry.rank === 2
                            ? "🥈"
                            : myEntry.rank === 3
                              ? "🥉"
                              : myEntry.rank}
                      </p>
                    </div>
                    <div className="stat-card-gold">
                      <p className="text-sm font-bold uppercase tracking-wide text-gold-700">
                        {t("points")}
                      </p>
                      <p className="font-display text-3xl font-extrabold text-gold-700">
                        {myEntry.total_points}
                      </p>
                    </div>
                    <div className="stat-card-pitch">
                      <p className="text-sm font-bold uppercase tracking-wide text-pitch-700">
                        {t("exact")}
                      </p>
                      <p className="font-display text-3xl font-extrabold">
                        {myEntry.exact_predictions}
                      </p>
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
                  <LeaderboardTable entries={leaderboard} highlightUserId={user.id} />
                )}
              </>
            )}

            {tab === "members" && (
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-night-900 text-xs font-bold uppercase tracking-wider text-white">
                      <th className="px-4 py-3">{t("username")}</th>
                      <th className="px-4 py-3">{t("role")}</th>
                      <th className="px-4 py-3">{t("joined")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 font-bold text-night-900">{member.username}</td>
                        <td className="px-4 py-3 capitalize">
                          {member.role === "admin" ? t("groupAdmin") : t("groupMember")}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
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
                  <GroupPredictionsPanel matches={predictionsData.matches} locale={locale} />
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
