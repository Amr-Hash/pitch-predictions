"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Tournament, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const emptyForm = {
  name: "",
  name_ar: "",
  year: new Date().getFullYear(),
  start_date: "",
  end_date: "",
  is_active: true,
  is_archived: false,
};

export default function AdminTournamentsPage() {
  const { token } = useAuth();
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
        setError(err instanceof Error ? err.message : "Could not load tournaments.")
      );
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
        await api.adminUpdateTournament(token, editingId, form);
        setSuccess("Tournament updated.");
        setEditingId(null);
      } else {
        await api.adminCreateTournament(token, form);
        setSuccess("Tournament created.");
      }
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tournament.");
    }
  }

  async function toggleActive(t: Tournament) {
    if (!token) return;
    try {
      await api.adminUpdateTournament(token, t.id, { is_active: !t.is_active });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tournament.");
    }
  }

  function startEdit(t: Tournament) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      name_ar: t.name_ar || "",
      year: t.year,
      start_date: t.start_date,
      end_date: t.end_date,
      is_active: t.is_active ?? true,
      is_archived: t.is_archived ?? false,
    });
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Delete this tournament and all its data?")) return;
    try {
      await api.adminDeleteTournament(token, id);
      setSuccess("Tournament deleted.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tournament.");
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Tournaments</h1>
      <p className="mb-6 text-gray-600">
        Create competitions and control whether users can see them.
      </p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
        <h2 className="font-semibold">{editingId ? "Edit Tournament" : "Add Tournament"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="mb-1 block text-sm font-medium">Year</label>
            <input
              className="input"
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Start date</label>
            <input
              className="input"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">End date</label>
            <input
              className="input"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (visible to users)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_archived}
              onChange={(e) => setForm({ ...form, is_archived: e.target.checked })}
            />
            Archived
          </label>
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
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {tournaments.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                {t.name}{" "}
                <span className="text-gray-400">({t.year})</span>
              </h3>
              <p className="text-sm text-gray-500">
                {t.start_date} → {t.end_date} · {t.match_count ?? 0} matches
              </p>
              <div className="mt-1 flex gap-2">
                <StatusBadge active={t.is_active ?? true} label="Active" />
                {(t.is_archived ?? false) && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Archived</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/tournaments/${t.id}`} className="btn-primary text-sm">
                Manage →
              </Link>
              <button type="button" className="btn-secondary text-sm" onClick={() => toggleActive(t)}>
                {t.is_active ? "Deactivate" : "Activate"}
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => startEdit(t)}>
                Edit details
              </button>
              <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => handleDelete(t.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {active ? label : "Inactive"}
    </span>
  );
}
