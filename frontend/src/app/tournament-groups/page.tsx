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
      <h1 className="mb-2 text-3xl font-bold">{t("tournamentGroupsTitle")}</h1>
      <p className="mb-6 text-gray-600">
        {tournamentName} ({selectedTournament.year}) —{" "}
        {t("groupsConfigured", { count: cupGroups.length })}
      </p>

      {isTestCup ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>{t("demoTestCup")}</strong> — {t("demoTestCupGroupsDesc")}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-pitch-200 bg-pitch-50 p-4 text-sm text-pitch-900">
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
          {cupGroups.map((group) => (
            <div key={group.id} className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-pitch-700">
                  {t("group")} {localizedName(group, locale)}
                </h2>
                <Link
                  href={`/matches?cup_group=${group.name}`}
                  className="text-xs font-medium text-pitch-600 hover:underline"
                >
                  {t("viewMatchesLink")}
                </Link>
              </div>
              <ul className="space-y-2">
                {group.group_teams.map(({ team }) => (
                  <li key={team.id} className="flex items-center gap-3">
                    {team.flag_url ? (
                      <img
                        src={team.flag_url}
                        alt=""
                        className="h-5 w-7 object-cover"
                      />
                    ) : (
                      <span className="inline-block h-5 w-7 bg-gray-200" />
                    )}
                    <span className="font-medium">{teamLabel(team, locale)}</span>
                    <span className="text-xs text-gray-400">{team.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
