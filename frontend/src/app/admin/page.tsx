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
  is_active: true,
  is_archived: false,
};

export default function AdminOverviewPage() {
  const { token } = useAuth();
  const t = useT();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      const created = await api.adminCreateTournament(token, form);
      setSuccess(t("tournamentCreated"));
      setForm(emptyForm);
      setShowCreate(false);
      load();
      window.location.href = `/admin/tournaments/${created.id}`;
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

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="admin-page-title mb-2">{t("adminTournaments")}</h1>
          <p className="text-night-700/70">{t("adminOverviewDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/teams" className="btn-secondary text-sm">
            {t("adminManageTeams")}
          </Link>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? t("cancel") : `+ ${t("adminNewTournament")}`}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} className="admin-card mb-8 space-y-4">
          <h2 className="font-semibold">{t("adminAddTournament")}</h2>
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
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            {t("adminActiveVisible")}
          </label>
          <button type="submit" className="btn-primary">
            {t("adminCreateOpen")}
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="admin-card flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-semibold">{bilingualAdminLabel(tournament)}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    tournament.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {tournament.is_active ? t("adminActive") : t("adminInactive")}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {tournament.year} · {tournament.start_date} → {tournament.end_date}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {t("adminRoundsCount", { count: tournament.stage_count ?? 0 })} ·{" "}
                {t("adminMatchesCount", { count: tournament.match_count ?? 0 })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/tournaments/${tournament.id}`} className="btn-primary text-sm">
                {t("adminManageTournament")} →
              </Link>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => toggleActive(tournament)}
              >
                {tournament.is_active ? t("adminDeactivate") : t("adminActivate")}
              </button>
              <Link href="/admin/tournaments" className="btn-secondary text-sm">
                {t("adminEditDetails")}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {tournaments.length === 0 && (
        <div className="admin-card py-12 text-center text-gray-500">{t("adminNoTournamentsYet")}</div>
      )}
    </div>
  );
}
