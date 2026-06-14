"use client";

import { FormEvent, useState } from "react";
import { api, Match } from "@/lib/api";
import { adminLabel } from "@/lib/adminDisplay";
import { useLocale, useT } from "@/lib/i18n";

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
  const { locale } = useLocale();
  const t = useT();
  const [draft, setDraft] = useState<ScoreDraft>(() => toDraft(match));
  const [saving, setSaving] = useState<"live" | "final" | null>(null);
  const [error, setError] = useState("");

  function parseScores() {
    const home = draft.home_score === "" ? null : Number(draft.home_score);
    const away = draft.away_score === "" ? null : Number(draft.away_score);
    const tied = home !== null && away !== null && home === away;
    return { home, away, tied };
  }

  async function saveLive(e: FormEvent) {
    e.preventDefault();
    const { home, away } = parseScores();
    if (home === null || away === null) {
      setError(t("enterBothScores"));
      return;
    }
    setSaving("live");
    setError("");
    try {
      await api.adminUpdateMatch(token, match.id, {
        status: "live",
        home_score: home,
        away_score: away,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save live score.");
    } finally {
      setSaving(null);
    }
  }

  async function saveFinal(e: FormEvent) {
    e.preventDefault();
    const { home, away, tied } = parseScores();
    if (home === null || away === null) {
      setError(t("enterBothScores"));
      return;
    }
    if (tied && match.is_knockout && !draft.winner_team) {
      setError(t("selectAdvancingTeamRequired"));
      return;
    }
    setSaving("final");
    setError("");
    try {
      await api.adminUpdateMatch(token, match.id, {
        status: "finished",
        home_score: home,
        away_score: away,
        winner_team:
          tied && match.is_knockout && draft.winner_team
            ? Number(draft.winner_team)
            : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score.");
    } finally {
      setSaving(null);
    }
  }

  const showWinner = needsWinner(match, draft);
  const homeLabel = adminLabel(match.home_team, locale);
  const awayLabel = adminLabel(match.away_team, locale);
  const busy = saving !== null;

  return (
    <form className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
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
            >
              <option value="">{t("pickWinner")}</option>
              <option value={match.home_team.id}>{homeLabel}</option>
              <option value={match.away_team.id}>{awayLabel}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">{t("knockoutWinnerFinalHint")}</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">{t("liveScoreHint")}</p>
      <p className="mt-1 text-xs text-gray-500">{t("scoreSaveHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy}
          onClick={saveLive}
        >
          {saving === "live" ? t("adminSaving") : t("saveLiveScore")}
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy}
          onClick={saveFinal}
        >
          {saving === "final" ? t("adminSaving") : t("saveFinalScore")}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={onCancel} disabled={busy}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
