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
import { useAuth } from "@/lib/auth";
import { ScoreEntryPanel } from "./ScoreEntryPanel";

interface Stage {
  id: number;
  name: string;
  order: number;
  stage_type: string;
  tournament?: number;
}

type Tab = "matches" | "groups" | "setup";

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: "bg-royal-100 text-royal-800",
    live: "bg-fan-100 text-fan-800",
    finished: "bg-pitch-100 text-pitch-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
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
  const [expanded, setExpanded] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const hasScore = match.home_score !== null && match.away_score !== null;

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
            <span className="font-semibold">{match.home_team.name}</span>
            {hasScore ? (
              <span className="text-lg font-bold text-pitch-700">
                {match.home_score} – {match.away_score}
              </span>
            ) : (
              <span className="text-gray-400">vs</span>
            )}
            <span className="font-semibold">{match.away_team.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <StatusBadge status={match.status} />
            {match.cup_group_name && <span>Group {match.cup_group_name}</span>}
            {match.matchday && <span>Matchday {match.matchday}</span>}
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
              {recalculating ? "Recalculating…" : "Recalculate points"}
            </button>
          )}
          <button
            type="button"
            className={hasScore ? "btn-secondary text-sm" : "btn-primary text-sm"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Close" : hasScore ? "Edit score" : "Add score"}
          </button>
          <button
            type="button"
            className="text-sm text-red-600 hover:underline"
            onClick={onDelete}
          >
            Delete
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
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  const [stageForm, setStageForm] = useState({ name: "", name_ar: "", order: 1, stage_type: "group" });

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
      setSuccess("Match added to this round.");
      setShowAddMatch(false);
      setCreateForm({ home_team: "", away_team: "", cup_group: "", kickoff_time: "", status: "scheduled" });
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create match.");
    }
  }

  async function handleDeleteMatch(id: number) {
    if (!token || !confirm("Delete this match?")) return;
    try {
      await api.adminDeleteMatch(token, id);
      setSuccess("Match deleted.");
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
        team_ids: selectedTeamIds,
      };
      if (editingGroupId) {
        await api.adminUpdateCupGroup(token, editingGroupId, payload);
        setSuccess("Group updated.");
      } else {
        await api.adminCreateCupGroup(token, payload);
        setSuccess("Group created.");
      }
      setGroupName("");
      setSelectedTeamIds([]);
      setEditingGroupId(null);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group.");
    }
  }

  async function handleCreateStage(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      await api.adminCreateStage(token, {
        tournament: tournamentId,
        ...stageForm,
      });
      setSuccess("Stage / round created.");
      setStageForm({ name: "", name_ar: "", order: stages.length + 1, stage_type: "group" });
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stage.");
    }
  }

  if (!tournament) {
    return <div className="py-12 text-center text-gray-500">Loading tournament…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="link-back">
          ← All tournaments
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="admin-page-title">{tournament.name}</h1>
            <p className="text-gray-600">
              {tournament.year} · {tournament.start_date} → {tournament.end_date}
              {tournament.is_active === false && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  Inactive
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>{stages.length} rounds</span>
            <span>{matches.length} matches</span>
            <span>{cupGroups.length} groups</span>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["matches", "Matches & Scores"],
            ["groups", "Groups & Teams"],
            ["setup", "Rounds / Setup"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={tab === key ? "admin-tab-active" : "admin-tab"}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        <div>
          {stages.length === 0 ? (
            <div className="admin-card text-center text-gray-500">
              <p className="mb-3">No rounds yet. Add a stage first under Rounds / Setup.</p>
              <button type="button" className="btn-primary text-sm" onClick={() => setTab("setup")}>
                Go to Setup
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Current round</p>
                <div className="flex flex-wrap gap-2">
                  {[...stages]
                    .sort((a, b) => a.order - b.order)
                    .map((stage) => {
                      const stageMatches = matches.filter((m) => m.stage === stage.id);
                      const pending = stageMatches.filter(
                        (m) => m.status === "scheduled" || m.status === "live"
                      ).length;
                      const isCurrent =
                        stage.id === pickCurrentStage(stages, matches);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => {
                            setStageId(stage.id);
                            setMatchday(pickCurrentMatchday(matches, stage.id));
                          }}
                          className={
                            stageId === stage.id
                              ? "admin-round-pill-active"
                              : "admin-round-pill"
                          }
                        >
                          {stage.name}
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
                  <strong>{selectedStage.name}</strong> ({selectedStage.stage_type}) —{" "}
                  {stageStats.finished}/{stageStats.total} finished
                  {stageStats.upcoming > 0 && ` · ${stageStats.upcoming} need scores`}
                </div>
              )}

              {selectedStage?.stage_type === "group" && matchdaysInStage.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">Matchday filter</p>
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
                      All
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
                        MD{day}
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
                  {showAddMatch ? "Cancel" : "+ Add match to this round"}
                </button>
              </div>

              {showAddMatch && stageId && (
                <form onSubmit={handleCreateMatch} className="admin-card mb-6 space-y-4">
                  <h3 className="font-semibold">Add match to {selectedStage?.name}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Home team</label>
                      <select
                        className="input"
                        value={createForm.home_team}
                        onChange={(e) => setCreateForm({ ...createForm, home_team: e.target.value })}
                        required
                      >
                        <option value="">Select</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} — {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Away team</label>
                      <select
                        className="input"
                        value={createForm.away_team}
                        onChange={(e) => setCreateForm({ ...createForm, away_team: e.target.value })}
                        required
                      >
                        <option value="">Select</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} — {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {cupGroups.length > 0 && (
                      <div>
                        <label className="mb-1 block text-sm font-medium">Cup group</label>
                        <select
                          className="input"
                          value={createForm.cup_group}
                          onChange={(e) => setCreateForm({ ...createForm, cup_group: e.target.value })}
                        >
                          <option value="">None</option>
                          {cupGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              Group {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-sm font-medium">Kickoff</label>
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
                    <p className="text-sm text-gray-500">Will be added to Matchday {matchday}</p>
                  )}
                  <button type="submit" className="btn-primary text-sm">
                    Add match
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {filteredMatches.length === 0 ? (
                  <div className="admin-card py-8 text-center text-gray-500">
                    No matches in this round yet. Add one above.
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
            <h3 className="font-semibold">{editingGroupId ? "Edit group" : "Add group"}</h3>
            <div>
              <label className="mb-1 block text-sm font-medium">Group letter</label>
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
              <label className="mb-2 block text-sm font-medium">Teams in this group</label>
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
                    {team.code} — {team.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm">
                {editingGroupId ? "Update group" : "Create group"}
              </button>
              {editingGroupId && (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    setEditingGroupId(null);
                    setGroupName("");
                    setSelectedTeamIds([]);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cupGroups.map((group) => (
              <div key={group.id} className="admin-card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Group {group.name}</h3>
                  <div className="flex gap-2 text-sm">
                    <button
                      type="button"
                      className="text-amber-700 hover:underline"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setGroupName(group.name);
                        setSelectedTeamIds(group.group_teams.map((gt) => gt.team.id));
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!token || !confirm("Delete this group?")) return;
                        await api.adminDeleteCupGroup(token, group.id);
                        loadAll();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-gray-600">
                  {group.group_teams.map((gt) => (
                    <li key={gt.team.id}>
                      {gt.team.code} — {gt.team.name}
                    </li>
                  ))}
                  {group.group_teams.length === 0 && (
                    <li className="text-gray-400">No teams assigned</li>
                  )}
                </ul>
              </div>
            ))}
            {cupGroups.length === 0 && (
              <p className="col-span-full text-center text-gray-500">
                No groups yet. Create groups A, B, C… and assign teams.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "setup" && (
        <div>
          <form onSubmit={handleCreateStage} className="admin-card mb-6 space-y-4">
            <h3 className="font-semibold">Add round / stage</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  className="input"
                  value={stageForm.name}
                  onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                  placeholder="Group Stage"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Arabic name</label>
                <input
                  className="input"
                  dir="rtl"
                  value={stageForm.name_ar}
                  onChange={(e) => setStageForm({ ...stageForm, name_ar: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Order</label>
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
                <label className="mb-1 block text-sm font-medium">Type</label>
                <select
                  className="input"
                  value={stageForm.stage_type}
                  onChange={(e) => setStageForm({ ...stageForm, stage_type: e.target.value })}
                >
                  <option value="group">Group Stage</option>
                  <option value="knockout">Knockout</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary text-sm">
              Create round
            </button>
          </form>

          <div className="admin-card">
            <h3 className="mb-4 font-semibold">Rounds in this tournament</h3>
            {stages.length === 0 ? (
              <p className="text-gray-500">No rounds yet.</p>
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
                          <span className="font-medium">{stage.name}</span>
                          <span className="ml-2 text-sm capitalize text-gray-500">
                            {stage.stage_type}
                          </span>
                          <span className="ml-2 text-sm text-gray-400">
                            {stageMatches.length} matches
                            {matchdays.length > 0 &&
                              ` · MD${matchdays.join(", MD")}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:underline"
                          onClick={async () => {
                            if (!token || !confirm("Delete this round?")) return;
                            await api.adminDeleteStage(token, stage.id);
                            loadAll();
                          }}
                        >
                          Delete
                        </button>
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
