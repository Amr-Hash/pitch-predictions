"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, CupGroup, TournamentStandings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { GroupStandingsTable } from "@/components/GroupStandingsTable";
import { RequireTournament } from "@/components/RequireTournament";
import { useLocale, useT } from "@/lib/i18n";
import { localizedName, tournamentLabel } from "@/lib/localize";
import { cupGroupAccent } from "@/lib/theme";

function TournamentGroupsContent() {
  const { token } = useAuth();
  const { selectedTournament } = useTournament();
  const { locale } = useLocale();
  const t = useT();
  const [cupGroups, setCupGroups] = useState<CupGroup[]>([]);
  const [standings, setStandings] = useState<TournamentStandings | null>(null);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    api.getCupGroups(token, selectedTournament.id).then(setCupGroups);
    api.getTournamentStandings(token, selectedTournament.id).then(setStandings);
  }, [token, selectedTournament]);

  const standingsByGroupId = useMemo(() => {
    const map = new Map<number, TournamentStandings["groups"][number]>();
    standings?.groups.forEach((group) => map.set(group.group_id, group));
    return map;
  }, [standings]);

  if (!selectedTournament) return null;

  const tournamentName = tournamentLabel(selectedTournament, locale);
  const isTestCup = selectedTournament.name === "Demo Test Cup";
  const rulesLabel =
    locale === "ar"
      ? standings?.standing_rules_label_ar
      : standings?.standing_rules_label_en;
  const tiebreakers =
    locale === "ar" ? standings?.tiebreakers_ar : standings?.tiebreakers_en;

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

      {standings && rulesLabel && (
        <div className="card mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-night-700">
            {t("standingRulesTitle")}
          </h2>
          <p className="mt-1 text-sm font-semibold text-royal-700">{rulesLabel}</p>
          <p className="mt-2 text-xs text-gray-600">
            {t("qualifiersPerGroup", { count: standings.qualifiers_per_group })}
          </p>
          {tiebreakers && tiebreakers.length > 0 && (
            <ol className="mt-3 list-decimal space-y-1 ps-5 text-xs text-gray-600">
              {tiebreakers.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {cupGroups.length === 0 ? (
        <EmptyState
          icon="🏟️"
          title={t("noGroupsConfigured")}
          description={t("noGroupsConfiguredDesc")}
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {cupGroups.map((group) => {
            const accent = cupGroupAccent(group.name);
            const groupStandings = standingsByGroupId.get(group.id);
            return (
              <div key={group.id} className="card overflow-hidden p-0">
                <div className={`h-2 ${accent.bar}`} />
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
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
                  {groupStandings ? (
                    <GroupStandingsTable
                      standings={groupStandings.standings}
                      locale={locale}
                    />
                  ) : null}
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
