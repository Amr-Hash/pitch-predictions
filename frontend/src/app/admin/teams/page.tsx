"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Team, unwrapList } from "@/lib/api";
import { bilingualAdminLabel } from "@/lib/adminDisplay";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export default function AdminTeamsPage() {
  const { token } = useAuth();
  const t = useT();
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "", name_ar: "", code: "", flag_url: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError("");
    api
      .adminGetTeams(token)
      .then((data) => setTeams(unwrapList(data)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("failedLoadTeams"))
      );
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      if (editingId) {
        await api.adminUpdateTeam(token, editingId, form);
        setSuccess(t("teamUpdated"));
        setEditingId(null);
      } else {
        await api.adminCreateTeam(token, form);
        setSuccess(t("teamCreated"));
      }
      setForm({ name: "", name_ar: "", code: "", flag_url: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTeam"));
    }
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setForm({
      name: team.name,
      name_ar: team.name_ar || "",
      code: team.code,
      flag_url: team.flag_url || "",
    });
  }

  async function handleDelete(id: number) {
    if (!token || !confirm(t("adminDeleteConfirmTeam"))) return;
    try {
      await api.adminDeleteTeam(token, id);
      setSuccess(t("teamDeleted"));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTeam"));
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{t("adminTeams")}</h1>
      <p className="mb-6 text-gray-600">{t("adminTeamsDesc")}</p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
        <h2 className="font-semibold">
          {editingId ? t("adminEditTeam") : t("adminAddTeam")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
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
            <label className="mb-1 block text-sm font-medium">Code (3 letters)</label>
            <input
              className="input uppercase"
              maxLength={3}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("adminFlag")}</label>
            <input
              className="input"
              type="url"
              value={form.flag_url}
              onChange={(e) => setForm({ ...form, flag_url: e.target.value })}
              placeholder="https://flagcdn.com/w80/eg.png"
            />
          </div>
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
                setForm({ name: "", name_ar: "", code: "", flag_url: "" });
              }}
            >
              {t("cancel")}
            </button>
          )}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2 pr-4">{t("adminFlag")}</th>
              <th className="py-2 pr-4">{t("fieldName")}</th>
              <th className="py-2 pr-4">{t("nameAr")}</th>
              <th className="py-2 pr-4">Code</th>
              <th className="py-2">{t("adminActions")}</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">
                  {team.flag_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.flag_url} alt="" className="h-5 w-7 object-cover" />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4 font-medium">{team.name}</td>
                <td className="py-2 pr-4" dir="rtl">
                  {team.name_ar || "—"}
                </td>
                <td className="py-2 pr-4">{team.code}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-pitch-600 hover:underline"
                      onClick={() => startEdit(team)}
                    >
                      {t("adminEdit")}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => handleDelete(team.id)}
                    >
                      {t("adminDelete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
