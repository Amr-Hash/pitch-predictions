"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Tournament, unwrapList } from "@/lib/api";
import { bilingualAdminLabel } from "@/lib/adminDisplay";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

const emptyForm = {
  name: "",
  name_ar: "",
  year: new Date().getFullYear(),
  start_date: "",
  end_date: "",
  standing_rules: "fifa",
  qualifiers_per_group: 2,
  is_active: true,
  is_archived: false,
  live_score_provider: "manual",
  live_score_league_id: "",
  live_score_season: "",
};

export default function AdminTournamentsPage() {
  const { token } = useAuth();
  const t = useT();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setError("");
    api
      .adminGetTournaments(token)
      .then((data) => setTournaments(unwrapList(data)))
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
    return {
      name: form.name,
      name_ar: form.name_ar,
      year: form.year,
      start_date: form.start_date,
      end_date: form.end_date,
      standing_rules: form.standing_rules,
      qualifiers_per_group: form.qualifiers_per_group,
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

  function startEdit(tournament: Tournament) {
    setEditingId(tournament.id);
    setForm({
      name: tournament.name,
      name_ar: tournament.name_ar || "",
      year: tournament.year,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      standing_rules: tournament.standing_rules || "fifa",
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
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
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
          <div>
            <label className="mb-1 block text-sm font-medium">{t("adminStandingRules")}</label>
            <select
              className="input"
              value={form.standing_rules}
              onChange={(e) => setForm({ ...form, standing_rules: e.target.value })}
            >
              <option value="fifa">{t("adminStandingRulesFifa")}</option>
              <option value="uefa">{t("adminStandingRulesUefa")}</option>
              <option value="simple">{t("adminStandingRulesSimple")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("adminQualifiersPerGroup")}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={4}
              value={form.qualifiers_per_group}
              onChange={(e) =>
                setForm({ ...form, qualifiers_per_group: Number(e.target.value) })
              }
            />
          </div>
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
                {tournament.start_date} → {tournament.end_date} · {tournament.match_count ?? 0}{" "}
                {t("matches").toLowerCase()}
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
