"use client";

import { useT } from "@/lib/i18n";

function ScoreRule({
  points,
  title,
  description,
}: {
  points: number;
  title: string;
  description: string;
}) {
  return (
    <div className="card card-hover">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-fan-500 text-lg font-extrabold text-white shadow">
          {points}
        </span>
        <h3 className="font-bold text-night-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

interface Props {
  className?: string;
  centered?: boolean;
}

export function ScoringRulesSection({ className = "", centered = true }: Props) {
  const t = useT();

  return (
    <section className={className}>
      <h2
        className={`mb-2 font-display text-2xl font-extrabold text-night-900 ${
          centered ? "text-center" : ""
        }`}
      >
        {t("howScoringWorks")}
      </h2>
      <p className={`mb-6 text-sm text-gray-500 ${centered ? "text-center" : ""}`}>
        {t("scoringIntro")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreRule points={5} title={t("exactScore")} description={t("exactScoreDesc")} />
        <ScoreRule points={3} title={t("correctOutcome")} description={t("correctOutcomeDesc")} />
        <ScoreRule points={1} title={t("correctGoalDiff")} description={t("correctGoalDiffDesc")} />
        <ScoreRule points={5} title={t("knockoutBonus")} description={t("knockoutBonusDesc")} />
      </div>
    </section>
  );
}
