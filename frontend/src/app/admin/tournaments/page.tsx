"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, StandingRuleSet, Tournament, unwrapList } from "@/lib/api";
import { bilingualAdminLabel } from "@/lib/adminDisplay";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";

const COMPETITION_TYPE_KEYS: Record<string, MessageKey> = {
  world_cup: "adminRuleTypeWorldCup",
  champions_league: "adminRuleTypeChampionsLeague",
  other: "adminRuleTypeOther",
};

const emptyForm = {
  name: "",
  name_ar: "",
  competition_type: "world_cup",
  year: new Date().getFullYear(),
  start_date: "",
  end_date: "",
  standing_rule_set_id: "",
  standing_rules: "fifa_world_cup",
  qualifiers_per_group: 2,
  is_active: true,
  is_archived: false,
  live_score_provider: "api_football",
  live_score_league_id: "1",
  live_score_season: String(new Date().getFullYear()),
};

function applyCompetitionTypeDefaults(
  type: string,
  year: number,
  ruleSets: StandingRuleSet[],
  current: typeof emptyForm
): typeof emptyForm {
  const ruleset = ruleSets.find((rules) => rules.competition_type === type);
  const isWorldCup = type === "world_cup";
  return {
    ...current,
    competition_type: type,
    standing_rule_set_id: ruleset ? String(ruleset.id) : "",
    standing_rules: ruleset?.engine ?? current.standing_rules,
    qualifiers_per_group: ruleset?.qualifiers_per_group ?? current.qualifiers_per_group,
    live_score_provider: isWorldCup ? "api_football" : "manual",
    live_score_league_id: isWorldCup ? "1" : "",
    live_score_season: isWorldCup ? String(year) : "",
  };
}

export default function AdminTournamentsPage() {
  const { token } = useAuth();
  const t = useT();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [ruleSets, setRuleSets] = useState<StandingRuleSet[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setError("");
    Promise.all([
      api.adminGetTournaments(token),
      api.adminGetStandingRuleSets(token, { active: true }),
    ])
      .then(([tournamentData, ruleSetData]) => {
        setTournaments(unwrapList(tournamentData));
        setRuleSets(unwrapList(ruleSetData));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("failedLoadTournaments"))
      );
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  function tournamentPayload() {
    const config: Record<string, number> = {};
    if (form.live_score_league_id) {
      config.league_id = Number(form.live_score_league_id);
    }
    if (form.live_score_season) {
      config.season = Number(form.live_score_season);
    }
    const selectedRuleSet = ruleSets.find(
      (rules) => String(rules.id) === String(form.standing_rule_set_id)
    );
    return {
      name: form.name,
      name_ar: form.name_ar,
      competition_type: form.competition_type,
      year: form.year,
      start_date: form.start_date,
      end_date: form.end_date,
      standing_rule_set: form.standing_rule_set_id
        ? Number(form.standing_rule_set_id)
        : undefined,
      standing_rules: selectedRuleSet?.engine ?? form.standing_rules,
      qualifiers_per_group:
        selectedRuleSet?.qualifiers_per_group ?? form.qualifiers_per_group,
      is_active: form.is_active,
      is_archived: form.is_archived,
      live_score_provider: form.live_score_provider,
      live_score_config: config,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      const payload = tournamentPayload();
      if (editingId) {
        await api.adminUpdateTournament(token, editingId, payload);
        setSuccess(t("tournamentUpdated"));
        setEditingId(null);
      } else {
        await api.adminCreateTournament(token, payload);
        setSuccess(t("tournamentCreated"));
      }
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTournament"));
    }
  }

  async function syncLiveScores(tournamentId: number) {
    if (!token) return;
    setError("");
    try {
      await api.adminSyncLiveScores(token, tournamentId);
      setSuccess(t("adminLiveScoresSynced"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTournament"));
    }
  }

  async function toggleActive(tournament: Tournament) {
    if (!token) return;
    try {
      await api.adminUpdateTournament(token, tournament.id, {
        is_active: !tournament.is_active,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTournament"));
    }
  }

  function resolveRuleSetId(tournament: Tournament): string {
    if (tournament.standing_rule_set?.id) {
      return String(tournament.standing_rule_set.id);
    }
    const matched = ruleSets.find((rules) => rules.engine === tournament.standing_rules);
    return matched ? String(matched.id) : "";
  }

  function startEdit(tournament: Tournament) {
    setEditingId(tournament.id);
    setForm({
      name: tournament.name,
      name_ar: tournament.name_ar || "",
      competition_type: tournament.competition_type || "world_cup",
      year: tournament.year,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      standing_rule_set_id: resolveRuleSetId(tournament),
      standing_rules: tournament.standing_rules || "fifa_world_cup",
      qualifiers_per_group: tournament.qualifiers_per_group ?? 2,
      is_active: tournament.is_active ?? true,
      is_archived: tournament.is_archived ?? false,
      live_score_provider: tournament.live_score_provider || "manual",
      live_score_league_id: tournament.live_score_config?.league_id
        ? String(tournament.live_score_config.league_id)
        : "",
      live_score_season: tournament.live_score_config?.season
        ? String(tournament.live_score_config.season)
        : "",
    });
  }

  async function handleDelete(id: number) {
    if (!token || !confirm(t("adminDeleteConfirmTournament"))) return;
    try {
      await api.adminDeleteTournament(token, id);
      setSuccess(t("tournamentDeleted"));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTournament"));
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{t("adminTournaments")}</h1>
      <p className="mb-6 text-gray-600">{t("adminTournamentsDesc")}</p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
        <h2 className="font-semibold">
          {editingId ? t("adminEditTournament") : t("adminAddTournament")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("adminTournamentType")}</label>
            <select
              className="input"
              value={form.competition_type}
              onChange={(e) =>
                setForm(applyCompetitionTypeDefaults(e.target.value, form.year, ruleSets, form))
              }
              required
            >
              {Object.entries(COMPETITION_TYPE_KEYS).map(([value, labelKey]) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{t("adminTournamentTypeHint")}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fieldName")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("nameAr")}</label>
            <input
              className="input"
              dir="rtl"
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fieldYear")}</label>
            <input
              className="input"
              type="number"
              value={form.year}
              onChange={(e) => {
                const year = Number(e.target.value);
                setForm(
                  form.competition_type === "world_cup"
                    ? { ...form, year, live_score_season: String(year) }
                    : { ...form, year }
                );
              }}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fieldStartDate")}</label>
            <input
              className="input"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fieldEndDate")}</label>
            <input
              className="input"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("adminStandingRuleSet")}</label>
            <select
              className="input"
              value={form.standing_rule_set_id}
              onChange={(e) => {
                const selected = ruleSets.find((rules) => String(rules.id) === e.target.value);
                setForm({
                  ...form,
                  standing_rule_set_id: e.target.value,
                  standing_rules: selected?.engine ?? form.standing_rules,
                  qualifiers_per_group:
                    selected?.qualifiers_per_group ?? form.qualifiers_per_group,
                });
              }}
              required
            >
              <option value="">{t("adminSelectStandingRuleSet")}</option>
              {ruleSets
                .filter((rules) => rules.competition_type === form.competition_type)
                .map((rules) => (
                  <option key={rules.id} value={rules.id}>
                    {rules.name} ({rules.version})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {t("adminStandingRuleSetHint")}{" "}
              <a href="/admin/standing-rules" className="text-pitch-700 underline">
                {t("adminStandingRuleSets")}
              </a>
            </p>
          </div>
          {form.standing_rule_set_id ? (
            <div className="sm:col-span-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              {t("adminQualifiersPerGroup")}: {form.qualifiers_per_group}
              {ruleSets.find((r) => String(r.id) === form.standing_rule_set_id)
                ?.best_third_place_qualifiers
                ? ` · ${t("adminBestThirdPlaceQualifiers")}: ${
                    ruleSets.find((r) => String(r.id) === form.standing_rule_set_id)
                      ?.best_third_place_qualifiers
                  }`
                : ""}
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("adminLiveScoreProvider")}</label>
            <select
              className="input"
              value={form.live_score_provider}
              onChange={(e) => setForm({ ...form, live_score_provider: e.target.value })}
            >
              <option value="manual">{t("adminLiveScoreManual")}</option>
              <option value="api_football">{t("adminLiveScoreApiFootball")}</option>
              <option value="sportmonks">{t("adminLiveScoreSportmonks")}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">{t("adminLiveScoreConfigHint")}</p>
          </div>
          {form.live_score_provider !== "manual" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("adminLiveScoreLeagueId")}</label>
                <input
                  className="input"
                  type="number"
                  value={form.live_score_league_id}
                  onChange={(e) => setForm({ ...form, live_score_league_id: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("adminLiveScoreSeason")}</label>
                <input
                  className="input"
                  type="number"
                  value={form.live_score_season}
                  onChange={(e) => setForm({ ...form, live_score_season: e.target.value })}
                  placeholder="2026"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            {t("adminActiveVisible")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_archived}
              onChange={(e) => setForm({ ...form, is_archived: e.target.checked })}
            />
            {t("adminArchived")}
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            {editingId ? t("update") : t("create")}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              {t("cancel")}
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                {bilingualAdminLabel(tournament)}{" "}
                <span className="text-gray-400">({tournament.year})</span>
              </h3>
              <p className="text-sm text-gray-500">
                {tournament.competition_type &&
                  COMPETITION_TYPE_KEYS[tournament.competition_type] && (
                    <>
                      {t(COMPETITION_TYPE_KEYS[tournament.competition_type])} ·{" "}
                    </>
                  )}
                {tournament.start_date} → {tournament.end_date} · {tournament.match_count ?? 0}{" "}
                {t("matches").toLowerCase()}
                {tournament.standing_rule_set && (
                  <> · {tournament.standing_rule_set.name}</>
                )}
                {tournament.live_score_provider && tournament.live_score_provider !== "manual" && (
                  <> · {tournament.live_score_provider}</>
                )}
              </p>
              <div className="mt-1 flex gap-2">
                <StatusBadge
                  active={tournament.is_active ?? true}
                  activeLabel={t("adminActive")}
                  inactiveLabel={t("adminInactive")}
                />
                {(tournament.is_archived ?? false) && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {t("adminArchived")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/tournaments/${tournament.id}`} className="btn-primary text-sm">
                {t("adminManage")} →
              </Link>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => toggleActive(tournament)}
              >
                {tournament.is_active ? t("adminDeactivate") : t("adminActivate")}
              </button>
              {tournament.live_score_provider && tournament.live_score_provider !== "manual" && (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => syncLiveScores(tournament.id)}
                >
                  {t("adminSyncLiveScores")}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => startEdit(tournament)}
              >
                {t("adminEditDetails")}
              </button>
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => handleDelete(tournament.id)}
              >
                {t("adminDelete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
