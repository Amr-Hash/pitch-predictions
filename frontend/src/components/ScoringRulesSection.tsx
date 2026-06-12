"use client";

import { useT } from "@/lib/i18n";

function ScoreRule({
  points,
  title,
  description,
  compact = false,
}: {
  points: number;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`card card-hover ${compact ? "p-4" : ""}`}>
      <div className={`flex items-center gap-3 ${compact ? "mb-1.5" : "mb-2"}`}>
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-fan-500 font-extrabold text-white shadow ${
            compact ? "h-9 w-9 text-base" : "h-11 w-11 text-lg"
          }`}
        >
          {points}
        </span>
        <h3 className={`font-bold text-night-900 ${compact ? "text-sm" : ""}`}>{title}</h3>
      </div>
      <p className={`text-gray-600 ${compact ? "text-xs leading-relaxed" : "text-sm"}`}>
        {description}
      </p>
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
        <ScoreRule points={3} title={t("correctGoalDiff")} description={t("correctGoalDiffDesc")} />
        <ScoreRule points={1} title={t("correctOutcome")} description={t("correctOutcomeDesc")} />
      </div>
      <div className="mt-6">
        <h3 className={`mb-3 text-sm font-bold uppercase tracking-wide text-royal-700 ${centered ? "text-center" : ""}`}>
          {t("knockoutDrawsHeading")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreRule
            compact
            points={5}
            title={t("knockoutDraw")}
            description={t("knockoutDrawCorrectDesc")}
          />
          <ScoreRule
            compact
            points={3}
            title={t("knockoutDraw")}
            description={t("knockoutDrawWrongDesc")}
          />
        </div>
      </div>
    </section>
  );
}
