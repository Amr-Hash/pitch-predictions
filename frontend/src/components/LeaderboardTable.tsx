"use client";

import { LeaderboardEntry } from "@/lib/api";
import { useT } from "@/lib/i18n";

function rowClass(rank: number, isYou: boolean) {
  if (isYou) return "bg-royal-50 ring-1 ring-inset ring-royal-200";
  if (rank === 1) return "leaderboard-row-gold";
  if (rank === 2) return "leaderboard-row-silver";
  if (rank === 3) return "leaderboard-row-bronze";
  return "";
}

function rankDisplay(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank;
}

interface Props {
  entries: LeaderboardEntry[];
  highlightUserId?: number;
}

export function LeaderboardTable({ entries, highlightUserId }: Props) {
  const t = useT();

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-night-900 text-xs font-bold uppercase tracking-wider text-white">
            <th className="px-4 py-3">{t("rank")}</th>
            <th className="px-4 py-3">{t("player")}</th>
            <th className="px-4 py-3">{t("points")}</th>
            <th className="px-4 py-3">{t("exact")}</th>
            <th className="px-4 py-3">{t("outcomes")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isYou = highlightUserId === entry.user_id;
            return (
              <tr
                key={`${entry.user_id}-${entry.rank}`}
                className={`border-b border-gray-100 last:border-0 ${rowClass(entry.rank, isYou)}`}
              >
                <td className="px-4 py-3 text-lg">{rankDisplay(entry.rank)}</td>
                <td className="px-4 py-3 font-bold text-night-900">
                  {entry.username}
                  {isYou && (
                    <span className="ml-2 rounded-full bg-royal-500 px-2 py-0.5 text-xs font-bold text-white">
                      {t("you")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-display text-lg font-extrabold text-gold-600">
                  {entry.total_points}
                </td>
                <td className="px-4 py-3">{entry.exact_predictions}</td>
                <td className="px-4 py-3">{entry.correct_outcomes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
