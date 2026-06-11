"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Tournament, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const emptyForm = {
  name: "",
  year: new Date().getFullYear(),
  start_date: "",
  end_date: "",
  is_active: true,
  is_archived: false,
};

export default function AdminOverviewPage() {
  const { token } = useAuth();
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
        setError(err instanceof Error ? err.message : "Could not load tournaments.")
      );
  }, [token]);

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
      setSuccess("Tournament created.");
      setForm(emptyForm);
      setShowCreate(false);
      load();
      window.location.href = `/admin/tournaments/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament.");
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

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Tournaments</h1>
          <p className="text-gray-600">
            Pick a tournament to manage rounds, groups, matches, and scores in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/teams" className="btn-secondary text-sm">
            Manage teams
          </Link>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "+ New tournament"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-8 space-y-4">
          <h2 className="font-semibold">Create tournament</h2>
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (visible to users)
          </label>
          <button type="submit" className="btn-primary">
            Create & open
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments.map((t) => (
          <div key={t.id} className="card flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-semibold">{t.name}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {t.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t.year} · {t.start_date} → {t.end_date}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {t.stage_count ?? 0} rounds · {t.match_count ?? 0} matches
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/tournaments/${t.id}`} className="btn-primary text-sm">
                Manage tournament →
              </Link>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => toggleActive(t)}
              >
                {t.is_active ? "Deactivate" : "Activate"}
              </button>
              <Link href="/admin/tournaments" className="btn-secondary text-sm">
                Edit details
              </Link>
            </div>
          </div>
        ))}
      </div>

      {tournaments.length === 0 && (
        <div className="card py-12 text-center text-gray-500">
          No tournaments yet. Create one to get started.
        </div>
      )}
    </div>
  );
}
