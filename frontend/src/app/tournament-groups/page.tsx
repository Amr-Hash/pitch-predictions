"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, CupGroup } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { localizedName, teamLabel, tournamentLabel } from "@/lib/localize";
import { cupGroupAccent } from "@/lib/theme";

function TournamentGroupsContent() {
  const { token } = useAuth();
  const { selectedTournament } = useTournament();
  const { locale } = useLocale();
  const t = useT();
  const [cupGroups, setCupGroups] = useState<CupGroup[]>([]);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    api.getCupGroups(token, selectedTournament.id).then(setCupGroups);
  }, [token, selectedTournament]);

  if (!selectedTournament) return null;

  const tournamentName = tournamentLabel(selectedTournament, locale);
  const isTestCup = selectedTournament.name === "Demo Test Cup";

  return (
    <div>
      <h1 className="page-title mb-2">{t("tournamentGroupsTitle")}</h1>
      <p className="mb-6 font-medium text-night-700/70">
        {tournamentName} ({selectedTournament.year}) —{" "}
        {t("groupsConfigured", { count: cupGroups.length })}
      </p>

      {isTestCup ? (
        <div className="info-banner-fan">
          <strong>{t("demoTestCup")}</strong> — {t("demoTestCupGroupsDesc")}
        </div>
      ) : (
        <div className="info-banner-pitch">
          <strong>{t("predictionRules")}</strong> {t("predictionRulesDesc")}
        </div>
      )}

      {cupGroups.length === 0 ? (
        <EmptyState
          icon="🏟️"
          title={t("noGroupsConfigured")}
          description={t("noGroupsConfiguredDesc")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cupGroups.map((group) => {
            const accent = cupGroupAccent(group.name);
            return (
              <div key={group.id} className="card overflow-hidden p-0">
                <div className={`h-2 ${accent.bar}`} />
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-3 py-1 font-display text-lg font-extrabold ${accent.pill}`}
                    >
                      {t("group")} {localizedName(group, locale)}
                    </span>
                    <Link
                      href={`/matches?cup_group=${group.name}`}
                      className="text-xs font-bold text-royal-600 hover:underline"
                    >
                      {t("viewMatchesLink")} →
                    </Link>
                  </div>
                  <ul className="space-y-2">
                    {group.group_teams.map(({ team }) => (
                      <li key={team.id} className="flex items-center gap-3">
                        {team.flag_url ? (
                          <img
                            src={team.flag_url}
                            alt=""
                            className="h-5 w-7 rounded-sm object-cover shadow-sm"
                          />
                        ) : (
                          <span className="inline-block h-5 w-7 rounded-sm bg-gray-200" />
                        )}
                        <span className="font-semibold text-night-900">
                          {teamLabel(team, locale)}
                        </span>
                        <span className="text-xs font-medium text-gray-400">{team.code}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TournamentGroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <RequireTournament>
      <TournamentGroupsContent />
    </RequireTournament>
  );
}
