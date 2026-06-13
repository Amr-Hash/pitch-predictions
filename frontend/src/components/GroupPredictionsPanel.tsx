"use client";

import { GroupMatchPredictions } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { MatchGroupComparisonCard } from "@/components/MatchGroupComparisonCard";

function hasAnyPrediction(predictions: GroupMatchPredictions["predictions"]) {
  return predictions.some((p) => p.has_prediction ?? p.predicted_home_score !== null);
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
            <MatchGroupComparisonCard
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
