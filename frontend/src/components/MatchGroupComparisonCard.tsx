"use client";

import { GroupMatchPredictions, GroupMemberMatchPrediction } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel } from "@/lib/localize";
import { formatDateTime } from "@/lib/format";

export function formatGroupMemberPrediction(
  pred: GroupMemberMatchPrediction,
  locale: "en" | "ar",
  t: ReturnType<typeof useT>
) {
  if (pred.is_hidden || (pred.has_prediction && pred.predicted_home_score === null)) {
    return null;
  }
  if (pred.predicted_home_score === null || pred.predicted_away_score === null) {
    return t("noPrediction");
  }
  const score = `${pred.predicted_home_score}-${pred.predicted_away_score}`;
  if (pred.predicted_winner_team) {
    return `${score} (${teamLabel(pred.predicted_winner_team, locale)} ${t("advances")})`;
  }
  return score;
}

interface Props {
  item: GroupMatchPredictions;
  locale: "en" | "ar";
  showPoints: boolean;
  highlightUserId?: number;
  compact?: boolean;
}

export function MatchGroupComparisonCard({
  item,
  locale,
  showPoints,
  highlightUserId,
  compact = false,
}: Props) {
  const t = useT();
  const { match, predictions } = item;

  return (
    <div className="card overflow-x-auto border-l-4 border-l-royal-400 p-0">
      {!compact && (
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">
            {matchContextLabel(match, locale, t("group"))}
            {match.matchday ? ` · ${t("matchday", { day: match.matchday })}` : ""}
          </p>
          <p className="font-display font-extrabold text-night-900">
            {teamLabel(match.home_team, locale)} vs {teamLabel(match.away_team, locale)}
            {match.status === "finished" &&
              match.home_score !== null &&
              match.away_score !== null && (
                <span className="ml-2 text-pitch-700">
                  ({match.home_score}-{match.away_score})
                </span>
              )}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatDateTime(match.kickoff_time, locale, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">{t("player")}</th>
            <th className="px-3 py-2">{t("predictionColumn")}</th>
            {showPoints && <th className="px-3 py-2">{t("points")}</th>}
          </tr>
        </thead>
        <tbody>
          {predictions.map((pred) => {
            const text = formatGroupMemberPrediction(pred, locale, t);
            const isMystery =
              pred.is_hidden || (pred.has_prediction && pred.predicted_home_score === null);
            const isYou = highlightUserId !== undefined && pred.user_id === highlightUserId;

            return (
              <tr
                key={pred.user_id}
                className={`border-b border-gray-100 last:border-0 ${
                  isYou ? "bg-pitch-50/80" : ""
                }`}
              >
                <td className="px-3 py-2 font-semibold">
                  {pred.username}
                  {isYou && (
                    <span className="ml-1.5 text-xs font-bold text-pitch-700">({t("you")})</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isMystery ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-night-900/5 px-2.5 py-1 text-xs font-bold text-night-700">
                      <span aria-hidden>🔒</span>
                      {t("mysteryPrediction")}
                    </span>
                  ) : (
                    text
                  )}
                </td>
                {showPoints && (
                  <td className="px-3 py-2 font-bold text-gold-600">
                    {match.status === "finished" ? pred.points_awarded : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
