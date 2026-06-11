"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Match, Team, Tournament, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminTeamsPage() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "", name_ar: "", code: "", flag_url: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api.adminGetTeams(token).then((data) => setTeams(unwrapList(data)));
  }, [token]);

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
        setSuccess("Team updated.");
        setEditingId(null);
      } else {
        await api.adminCreateTeam(token, form);
        setSuccess("Team created.");
      }
      setForm({ name: "", name_ar: "", code: "", flag_url: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save team.");
    }
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setForm({ name: team.name, name_ar: team.name_ar || "", code: team.code, flag_url: team.flag_url || "" });
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Delete this team?")) return;
    try {
      await api.adminDeleteTeam(token, id);
      setSuccess("Team deleted.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team.");
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Teams</h1>
      <p className="mb-6 text-gray-600">Add and edit teams used in tournaments and matches.</p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
        <h2 className="font-semibold">{editingId ? "Edit Team" : "Add Team"}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Arabic name</label>
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
            <label className="mb-1 block text-sm font-medium">Flag URL</label>
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
            {editingId ? "Update" : "Create"}
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
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2 pr-4">Flag</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Code</th>
              <th className="py-2">Actions</th>
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
                <td className="py-2 pr-4">{team.code}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button type="button" className="text-pitch-600 hover:underline" onClick={() => startEdit(team)}>
                      Edit
                    </button>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => handleDelete(team.id)}>
                      Delete
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
