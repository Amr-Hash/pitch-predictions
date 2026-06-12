"use client";

import { GroupMatchPredictions, GroupMemberMatchPrediction } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel } from "@/lib/localize";

function hasAnyPrediction(predictions: GroupMemberMatchPrediction[]) {
  return predictions.some((p) => p.has_prediction ?? p.predicted_home_score !== null);
}

function formatPrediction(
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

function MatchPredictionCard({
  item,
  locale,
  showPoints,
}: {
  item: GroupMatchPredictions;
  locale: "en" | "ar";
  showPoints: boolean;
}) {
  const t = useT();
  const { match, predictions } = item;

  return (
    <div className="card overflow-x-auto border-l-4 border-l-royal-400 p-0">
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
          {new Date(match.kickoff_time).toLocaleString(
            locale === "ar" ? "ar-EG" : undefined,
            { dateStyle: "medium", timeStyle: "short" }
          )}
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">{t("player")}</th>
            <th className="px-3 py-2">{t("yourPrediction")}</th>
            {showPoints && <th className="px-3 py-2">{t("points")}</th>}
          </tr>
        </thead>
        <tbody>
          {predictions.map((pred) => {
            const text = formatPrediction(pred, locale, t);
            const isMystery =
              pred.is_hidden || (pred.has_prediction && pred.predicted_home_score === null);

            return (
              <tr key={pred.user_id} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 font-semibold">{pred.username}</td>
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

function PredictionColumn({
  title,
  hint,
  items,
  locale,
  showPoints,
  emptyIcon,
  emptyTitle,
  emptyDesc,
}: {
  title: string;
  hint?: string;
  items: GroupMatchPredictions[];
  locale: "en" | "ar";
  showPoints: boolean;
  emptyIcon: string;
  emptyTitle: string;
  emptyDesc: string;
}) {
  return (
    <div>
      <h3 className="section-heading-royal mb-1 text-sm normal-case tracking-normal">{title}</h3>
      {hint && <p className="mb-3 text-xs text-gray-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center">
          <span className="mb-2 block text-2xl" aria-hidden>
            {emptyIcon}
          </span>
          <p className="text-sm font-bold text-night-900">{emptyTitle}</p>
          <p className="mt-1 text-xs text-gray-500">{emptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <MatchPredictionCard
              key={item.match.id}
              item={item}
              locale={locale}
              showPoints={showPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function splitMatches(matches: GroupMatchPredictions[]) {
  const withPredictions = matches.filter(({ predictions }) => hasAnyPrediction(predictions));

  const finished = withPredictions
    .filter(({ match }) => match.status === "finished")
    .sort(
      (a, b) =>
        new Date(b.match.kickoff_time).getTime() - new Date(a.match.kickoff_time).getTime()
    );

  const upcoming = withPredictions
    .filter(({ match }) => match.status !== "finished")
    .sort(
      (a, b) =>
        new Date(a.match.kickoff_time).getTime() - new Date(b.match.kickoff_time).getTime()
    );

  return { finished, upcoming };
}

interface Props {
  matches: GroupMatchPredictions[];
  locale: "en" | "ar";
}

export function GroupPredictionsPanel({ matches, locale }: Props) {
  const t = useT();
  const { finished, upcoming } = splitMatches(matches);

  if (finished.length === 0 && upcoming.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
      <PredictionColumn
        title={t("predictionsUpcoming")}
        hint={t("predictionsUpcomingHint")}
        items={upcoming}
        locale={locale}
        showPoints={false}
        emptyIcon="📅"
        emptyTitle={t("noUpcomingGroupPredictions")}
        emptyDesc={t("noUpcomingGroupPredictionsDesc")}
      />
      <PredictionColumn
        title={t("predictionsFinished")}
        hint={t("predictionsFinishedHint")}
        items={finished}
        locale={locale}
        showPoints
        emptyIcon="🏁"
        emptyTitle={t("noFinishedGroupPredictions")}
        emptyDesc={t("noFinishedGroupPredictionsDesc")}
      />
    </div>
  );
}
