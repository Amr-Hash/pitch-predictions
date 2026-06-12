"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  CupGroup,
  Match,
  Team,
  Tournament,
  unwrapList,
} from "@/lib/api";
import { bilingualAdminLabel, teamOptionLabel } from "@/lib/adminDisplay";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";
import { ScoreEntryPanel } from "./ScoreEntryPanel";

interface Stage {
  id: number;
  name: string;
  name_ar?: string;
  order: number;
  stage_type: string;
  tournament?: number;
}

type Tab = "matches" | "groups" | "setup";

const STATUS_KEYS: Record<string, MessageKey> = {
  scheduled: "statusScheduled",
  live: "statusLive",
  finished: "statusFinished",
};

function pickCurrentStage(stages: Stage[], matches: Match[]): number | null {
  if (!stages.length) return null;
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  for (const stage of sorted) {
    const stageMatches = matches.filter((m) => m.stage === stage.id);
    if (stageMatches.some((m) => m.status === "scheduled" || m.status === "live")) {
      return stage.id;
    }
  }
  return sorted[sorted.length - 1]?.id ?? null;
}

function pickCurrentMatchday(matches: Match[], stageId: number): number | null {
  const stageMatches = matches.filter((m) => m.stage === stageId && m.matchday);
  if (!stageMatches.length) return null;
  const days = Array.from(new Set(stageMatches.map((m) => m.matchday!))).sort((a, b) => a - b);
  for (const day of days) {
    const dayMatches = stageMatches.filter((m) => m.matchday === day);
    if (dayMatches.some((m) => m.status === "scheduled" || m.status === "live")) {
      return day;
    }
  }
  return days[days.length - 1] ?? null;
}

function stageLabel(stage: Stage): string {
  return bilingualAdminLabel(stage);
}

function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const colors: Record<string, string> = {
    scheduled: "bg-royal-100 text-royal-800",
    live: "bg-fan-100 text-fan-800",
    finished: "bg-pitch-100 text-pitch-800",
  };
  const labelKey = STATUS_KEYS[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {labelKey ? t(labelKey) : status}
    </span>
  );
}

function AdminMatchCard({
  match,
  token,
  onSaved,
  onDelete,
}: {
  match: Match;
  token: string;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const hasScore = match.home_score !== null && match.away_score !== null;
  const homeLabel = bilingualAdminLabel(match.home_team);
  const awayLabel = bilingualAdminLabel(match.away_team);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await api.adminRecalculateMatch(token, match.id);
      onSaved();
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{homeLabel}</span>
            {hasScore ? (
              <span className="text-lg font-bold text-pitch-700">
                {match.home_score} – {match.away_score}
              </span>
            ) : (
              <span className="text-gray-400">{t("vs")}</span>
            )}
            <span className="font-semibold">{awayLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <StatusBadge status={match.status} />
            {match.cup_group_name && (
              <span>
                {t("adminGroupLabel", {
                  name:
                    match.cup_group_name_ar && match.cup_group_name_ar !== match.cup_group_name
                      ? `${match.cup_group_name} · ${match.cup_group_name_ar}`
                      : match.cup_group_name,
                })}
              </span>
            )}
            {match.matchday && <span>{t("matchday", { day: match.matchday })}</span>}
            <span>{new Date(match.kickoff_time).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {match.status === "finished" && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? t("adminRecalculating") : t("adminRecalculatePoints")}
            </button>
          )}
          <button
            type="button"
            className={hasScore ? "btn-secondary text-sm" : "btn-primary text-sm"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t("adminClose") : hasScore ? t("adminEditScore") : t("adminAddScore")}
          </button>
          <button
            type="button"
            className="text-sm text-red-600 hover:underline"
            onClick={onDelete}
          >
            {t("adminDelete")}
          </button>
        </div>
      </div>
      {expanded && (
        <ScoreEntryPanel
          match={match}
          token={token}
          onSaved={() => {
            setExpanded(false);
            onSaved();
          }}
          onCancel={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

export function TournamentHub({ tournamentId }: { tournamentId: number }) {
  const { token } = useAuth();
  const t = useT();
  const [tab, setTab] = useState<Tab>("matches");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [cupGroups, setCupGroups] = useState<CupGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stageId, setStageId] = useState<number | null>(null);
  const [matchday, setMatchday] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [createForm, setCreateForm] = useState({
    home_team: "",
    away_team: "",
    cup_group: "",
    kickoff_time: "",
    status: "scheduled",
  });

  const [groupName, setGroupName] = useState("");
  const [groupNameAr, setGroupNameAr] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [stageForm, setStageForm] = useState({
    name: "",
    name_ar: "",
    order: 1,
    stage_type: "group",
  });

  const loadAll = useCallback(async () => {
    if (!token) return;
    const [tData, stageData, matchData, groupData, teamData] = await Promise.all([
      api.adminGetTournament(token, tournamentId),
      api.adminGetStages(token, tournamentId),
      api.adminGetMatches(token, { tournament: tournamentId }),
      api.adminGetCupGroups(token, tournamentId),
      api.adminGetTeams(token),
    ]);
    setTournament(tData);
    const stageList = unwrapList(stageData);
    const matchList = unwrapList(matchData);
    setStages(stageList);
    setMatches(matchList);
    setCupGroups(unwrapList(groupData));
    setTeams(unwrapList(teamData));

    const currentStage = pickCurrentStage(stageList, matchList);
    setStageId((prev) => prev ?? currentStage);
    if (currentStage) {
      setMatchday((prev) => prev ?? pickCurrentMatchday(matchList, currentStage));
    }
  }, [token, tournamentId]);

  useEffect(() => {
    loadAll().catch((e) => setError(e.message));
  }, [loadAll]);

  const selectedStage = stages.find((s) => s.id === stageId) ?? null;

  const matchdaysInStage = useMemo(() => {
    if (!stageId) return [];
    const days = new Set<number>();
    for (const m of matches) {
      if (m.stage === stageId && m.matchday) days.add(m.matchday);
    }
    return Array.from(days).sort((a, b) => a - b);
  }, [matches, stageId]);

  const filteredMatches = useMemo(() => {
    let list = matches.filter((m) => m.stage === stageId);
    if (matchday !== null) list = list.filter((m) => m.matchday === matchday);
    return list.sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );
  }, [matches, stageId, matchday]);

  const stageStats = useMemo(() => {
    if (!stageId) return { total: 0, finished: 0, upcoming: 0 };
    const stageMatches = matches.filter((m) => m.stage === stageId);
    return {
      total: stageMatches.length,
      finished: stageMatches.filter((m) => m.status === "finished").length,
      upcoming: stageMatches.filter((m) => m.status === "scheduled" || m.status === "live").length,
    };
  }, [matches, stageId]);

  function resetGroupForm() {
    setGroupName("");
    setGroupNameAr("");
    setSelectedTeamIds([]);
    setEditingGroupId(null);
  }

  function resetStageForm() {
    setEditingStageId(null);
    setStageForm({ name: "", name_ar: "", order: stages.length + 1, stage_type: "group" });
  }

  async function handleCreateMatch(e: FormEvent) {
    e.preventDefault();
    if (!token || !stageId) return;
    setError("");
    setSuccess("");
    try {
      await api.adminCreateMatch(token, {
        tournament: tournamentId,
        stage: stageId,
        home_team: Number(createForm.home_team),
        away_team: Number(createForm.away_team),
        kickoff_time: new Date(createForm.kickoff_time).toISOString(),
        cup_group: createForm.cup_group ? Number(createForm.cup_group) : null,
        matchday: matchday ?? undefined,
        status: createForm.status,
      });
      setSuccess(t("matchAdded"));
      setShowAddMatch(false);
      setCreateForm({ home_team: "", away_team: "", cup_group: "", kickoff_time: "", status: "scheduled" });
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create match.");
    }
  }

  async function handleDeleteMatch(id: number) {
    if (!token || !confirm(t("adminDeleteConfirmMatch"))) return;
    try {
      await api.adminDeleteMatch(token, id);
      setSuccess(t("matchDeleted"));
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete match.");
    }
  }

  async function handleSaveGroup(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      const payload = {
        tournament: tournamentId,
        name: groupName.toUpperCase(),
        name_ar: groupNameAr.trim() || undefined,
        team_ids: selectedTeamIds,
      };
      if (editingGroupId) {
        await api.adminUpdateCupGroup(token, editingGroupId, payload);
      } else {
        await api.adminCreateCupGroup(token, payload);
      }
      setSuccess(t("groupSaved"));
      resetGroupForm();
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group.");
    }
  }

  async function handleSaveStage(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      if (editingStageId) {
        await api.adminUpdateStage(token, editingStageId, stageForm);
      } else {
        await api.adminCreateStage(token, {
          tournament: tournamentId,
          ...stageForm,
        });
      }
      setSuccess(t("stageSaved"));
      resetStageForm();
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stage.");
    }
  }

  if (!tournament) {
    return <div className="py-12 text-center text-gray-500">{t("loadingTournament")}</div>;
  }

  const tabs: { key: Tab; labelKey: MessageKey }[] = [
    { key: "matches", labelKey: "adminMatchesScores" },
    { key: "groups", labelKey: "adminGroupsTeamsTab" },
    { key: "setup", labelKey: "adminRoundsSetup" },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="link-back">
          ← {t("adminAllTournaments")}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="admin-page-title">{bilingualAdminLabel(tournament)}</h1>
            <p className="text-gray-600">
              {tournament.year} · {tournament.start_date} → {tournament.end_date}
              {tournament.is_active === false && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  {t("adminInactive")}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>{t("adminRoundsCount", { count: stages.length })}</span>
            <span>{t("adminMatchesCount", { count: matches.length })}</span>
            <span>{t("adminGroupsCount", { count: cupGroups.length })}</span>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={tab === key ? "admin-tab-active" : "admin-tab"}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        <div>
          {stages.length === 0 ? (
            <div className="admin-card text-center text-gray-500">
              <p className="mb-3">{t("adminNoRoundsYet")}</p>
              <button type="button" className="btn-primary text-sm" onClick={() => setTab("setup")}>
                {t("adminGoToSetup")}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">{t("adminCurrentRound")}</p>
                <div className="flex flex-wrap gap-2">
                  {[...stages]
                    .sort((a, b) => a.order - b.order)
                    .map((stage) => {
                      const stageMatches = matches.filter((m) => m.stage === stage.id);
                      const pending = stageMatches.filter(
                        (m) => m.status === "scheduled" || m.status === "live"
                      ).length;
                      const isCurrent = stage.id === pickCurrentStage(stages, matches);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => {
                            setStageId(stage.id);
                            setMatchday(pickCurrentMatchday(matches, stage.id));
                          }}
                          className={
                            stageId === stage.id ? "admin-round-pill-active" : "admin-round-pill"
                          }
                        >
                          {stageLabel(stage)}
                          {isCurrent && stageId !== stage.id && (
                            <span className="ml-1 text-xs opacity-75">●</span>
                          )}
                          {pending > 0 && (
                            <span className="ml-1 rounded-full bg-white/30 px-1.5 text-xs">
                              {pending}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {selectedStage && (
                <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm">
                  <strong>{stageLabel(selectedStage)}</strong> ({selectedStage.stage_type}) —{" "}
                  {t("adminRoundStats", {
                    finished: stageStats.finished,
                    total: stageStats.total,
                  })}
                  {stageStats.upcoming > 0 &&
                    ` · ${t("adminNeedScores", { count: stageStats.upcoming })}`}
                </div>
              )}

              {selectedStage?.stage_type === "group" && matchdaysInStage.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">{t("adminMatchdayFilter")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMatchday(null)}
                      className={`rounded-full px-3 py-1 text-sm ${
                        matchday === null
                          ? "bg-pitch-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {t("adminAll")}
                    </button>
                    {matchdaysInStage.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setMatchday(day)}
                        className={`rounded-full px-3 py-1 text-sm ${
                          matchday === day
                            ? "bg-pitch-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {t("matchday", { day })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6 flex justify-end">
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => setShowAddMatch((v) => !v)}
                >
                  {showAddMatch ? t("cancel") : `+ ${t("adminAddMatchRound")}`}
                </button>
              </div>

              {showAddMatch && stageId && (
                <form onSubmit={handleCreateMatch} className="admin-card mb-6 space-y-4">
                  <h3 className="font-semibold">
                    {t("adminAddMatchTo", { name: selectedStage ? stageLabel(selectedStage) : "" })}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("adminHomeTeam")}</label>
                      <select
                        className="input"
                        value={createForm.home_team}
                        onChange={(e) => setCreateForm({ ...createForm, home_team: e.target.value })}
                        required
                      >
                        <option value="">{t("adminSelect")}</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamOptionLabel(team)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("adminAwayTeam")}</label>
                      <select
                        className="input"
                        value={createForm.away_team}
                        onChange={(e) => setCreateForm({ ...createForm, away_team: e.target.value })}
                        required
                      >
                        <option value="">{t("adminSelect")}</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamOptionLabel(team)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {cupGroups.length > 0 && (
                      <div>
                        <label className="mb-1 block text-sm font-medium">{t("adminCupGroup")}</label>
                        <select
                          className="input"
                          value={createForm.cup_group}
                          onChange={(e) => setCreateForm({ ...createForm, cup_group: e.target.value })}
                        >
                          <option value="">{t("adminNone")}</option>
                          {cupGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {t("adminGroupLabel", { name: bilingualAdminLabel(g) })}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("adminKickoff")}</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={createForm.kickoff_time}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, kickoff_time: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  {matchday && (
                    <p className="text-sm text-gray-500">
                      {t("adminWillMatchday", { day: matchday })}
                    </p>
                  )}
                  <button type="submit" className="btn-primary text-sm">
                    {t("adminAddMatch")}
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {filteredMatches.length === 0 ? (
                  <div className="admin-card py-8 text-center text-gray-500">
                    {t("adminNoMatchesRound")}
                  </div>
                ) : (
                  filteredMatches.map((match) => (
                    <AdminMatchCard
                      key={match.id}
                      match={match}
                      token={token!}
                      onSaved={loadAll}
                      onDelete={() => handleDeleteMatch(match.id)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "groups" && (
        <div>
          <form onSubmit={handleSaveGroup} className="admin-card mb-6 space-y-4">
            <h3 className="font-semibold">
              {editingGroupId ? t("adminEditGroup") : t("adminAddGroup")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("adminGroupLetter")}</label>
                <input
                  className="input max-w-xs uppercase"
                  maxLength={1}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="A"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("nameAr")}</label>
                <input
                  className="input"
                  dir="rtl"
                  value={groupNameAr}
                  onChange={(e) => setGroupNameAr(e.target.value)}
                  placeholder="المجموعة أ"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{t("adminTeamsInGroup")}</label>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={() =>
                        setSelectedTeamIds((prev) =>
                          prev.includes(team.id)
                            ? prev.filter((x) => x !== team.id)
                            : [...prev, team.id]
                        )
                      }
                    />
                    {teamOptionLabel(team)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm">
                {editingGroupId ? t("adminUpdateGroup") : t("adminCreateGroup")}
              </button>
              {editingGroupId && (
                <button type="button" className="btn-secondary text-sm" onClick={resetGroupForm}>
                  {t("cancel")}
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cupGroups.map((group) => (
              <div key={group.id} className="admin-card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t("adminGroupLabel", { name: bilingualAdminLabel(group) })}
                  </h3>
                  <div className="flex gap-2 text-sm">
                    <button
                      type="button"
                      className="text-amber-700 hover:underline"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setGroupName(group.name);
                        setGroupNameAr(group.name_ar || "");
                        setSelectedTeamIds(group.group_teams.map((gt) => gt.team.id));
                      }}
                    >
                      {t("adminEdit")}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!token || !confirm(t("adminDeleteConfirmGroup"))) return;
                        await api.adminDeleteCupGroup(token, group.id);
                        loadAll();
                      }}
                    >
                      {t("adminDelete")}
                    </button>
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-gray-600">
                  {group.group_teams.map((gt) => (
                    <li key={gt.team.id}>{teamOptionLabel(gt.team)}</li>
                  ))}
                  {group.group_teams.length === 0 && (
                    <li className="text-gray-400">{t("adminNoTeamsAssigned")}</li>
                  )}
                </ul>
              </div>
            ))}
            {cupGroups.length === 0 && (
              <p className="col-span-full text-center text-gray-500">{t("adminNoGroupsYet")}</p>
            )}
          </div>
        </div>
      )}

      {tab === "setup" && (
        <div>
          <form onSubmit={handleSaveStage} className="admin-card mb-6 space-y-4">
            <h3 className="font-semibold">
              {editingStageId ? t("adminEditRoundStage") : t("adminAddRoundStage")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("fieldName")}</label>
                <input
                  className="input"
                  value={stageForm.name}
                  onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                  placeholder="Group Stage"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("nameAr")}</label>
                <input
                  className="input"
                  dir="rtl"
                  value={stageForm.name_ar}
                  onChange={(e) => setStageForm({ ...stageForm, name_ar: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("adminOrder")}</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={stageForm.order}
                  onChange={(e) => setStageForm({ ...stageForm, order: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("adminType")}</label>
                <select
                  className="input"
                  value={stageForm.stage_type}
                  onChange={(e) => setStageForm({ ...stageForm, stage_type: e.target.value })}
                >
                  <option value="group">{t("adminGroupStage")}</option>
                  <option value="knockout">{t("adminKnockout")}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm">
                {editingStageId ? t("adminUpdateRound") : t("adminCreateRound")}
              </button>
              {editingStageId && (
                <button type="button" className="btn-secondary text-sm" onClick={resetStageForm}>
                  {t("cancel")}
                </button>
              )}
            </div>
          </form>

          <div className="admin-card">
            <h3 className="mb-4 font-semibold">{t("adminRoundsInTournament")}</h3>
            {stages.length === 0 ? (
              <p className="text-gray-500">{t("adminNoRounds")}</p>
            ) : (
              <ul className="divide-y">
                {[...stages]
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => {
                    const stageMatches = matches.filter((m) => m.stage === stage.id);
                    const matchdays =
                      stage.stage_type === "group"
                        ? Array.from(
                            new Set(
                              stageMatches
                                .map((m) => m.matchday)
                                .filter((day): day is number => day != null)
                            )
                          ).sort((a, b) => a - b)
                        : [];
                    return (
                      <li key={stage.id} className="flex items-center justify-between py-3">
                        <div>
                          <span className="font-medium">{stageLabel(stage)}</span>
                          <span className="ml-2 text-sm capitalize text-gray-500">
                            {stage.stage_type === "group"
                              ? t("adminGroupStage")
                              : t("adminKnockout")}
                          </span>
                          <span className="ml-2 text-sm text-gray-400">
                            {stageMatches.length} {t("matches").toLowerCase()}
                            {matchdays.length > 0 &&
                              ` · ${matchdays.map((d) => t("matchday", { day: d })).join(", ")}`}
                          </span>
                        </div>
                        <div className="flex gap-3 text-sm">
                          <button
                            type="button"
                            className="text-amber-700 hover:underline"
                            onClick={() => {
                              setEditingStageId(stage.id);
                              setStageForm({
                                name: stage.name,
                                name_ar: stage.name_ar || "",
                                order: stage.order,
                                stage_type: stage.stage_type,
                              });
                            }}
                          >
                            {t("adminEdit")}
                          </button>
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={async () => {
                              if (!token || !confirm(t("adminDeleteConfirmRound"))) return;
                              await api.adminDeleteStage(token, stage.id);
                              if (editingStageId === stage.id) resetStageForm();
                              loadAll();
                            }}
                          >
                            {t("adminDelete")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
