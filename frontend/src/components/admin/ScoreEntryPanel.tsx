"use client";

import { FormEvent, useState } from "react";
import { api, Match } from "@/lib/api";
import { bilingualAdminLabel } from "@/lib/adminDisplay";
import { useT } from "@/lib/i18n";

interface ScoreDraft {
  home_score: string;
  away_score: string;
  winner_team: string;
}

function toDraft(match: Match): ScoreDraft {
  return {
    home_score: match.home_score !== null ? String(match.home_score) : "",
    away_score: match.away_score !== null ? String(match.away_score) : "",
    winner_team: match.winner_team ? String(match.winner_team.id) : "",
  };
}

function needsWinner(match: Match, draft: ScoreDraft) {
  if (!match.is_knockout) return false;
  const h = draft.home_score === "" ? null : Number(draft.home_score);
  const a = draft.away_score === "" ? null : Number(draft.away_score);
  return h !== null && a !== null && h === a;
}

export function ScoreEntryPanel({
  match,
  token,
  onSaved,
  onCancel,
}: {
  match: Match;
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<ScoreDraft>(() => toDraft(match));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const home = draft.home_score === "" ? null : Number(draft.home_score);
    const away = draft.away_score === "" ? null : Number(draft.away_score);
    const tied = home !== null && away !== null && home === away;
    try {
      await api.adminUpdateMatch(token, match.id, {
        status: "finished",
        home_score: home,
        away_score: away,
        winner_team: tied && draft.winner_team ? Number(draft.winner_team) : null,
      });
      await api.adminRecalculateMatch(token, match.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score.");
    } finally {
      setSaving(false);
    }
  }

  const showWinner = needsWinner(match, draft);
  const homeLabel = bilingualAdminLabel(match.home_team);
  const awayLabel = bilingualAdminLabel(match.away_team);

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {match.home_team.code} — {homeLabel}
          </label>
          <input
            className="input w-16 text-center"
            type="number"
            min={0}
            value={draft.home_score}
            onChange={(e) => setDraft({ ...draft, home_score: e.target.value })}
            required
          />
        </div>
        <span className="pb-2 text-gray-400">–</span>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {match.away_team.code} — {awayLabel}
          </label>
          <input
            className="input w-16 text-center"
            type="number"
            min={0}
            value={draft.away_score}
            onChange={(e) => setDraft({ ...draft, away_score: e.target.value })}
            required
          />
        </div>
        {showWinner && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {t("adminAdvancingTeam")}
            </label>
            <select
              className="input min-w-[180px]"
              value={draft.winner_team}
              onChange={(e) => setDraft({ ...draft, winner_team: e.target.value })}
              required
            >
              <option value="">{t("pickWinner")}</option>
              <option value={match.home_team.id}>{homeLabel}</option>
              <option value={match.away_team.id}>{awayLabel}</option>
            </select>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">{t("scoreSaveHint")}</p>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={saving}>
          {saving ? t("adminSaving") : t("saveFinalScore")}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
