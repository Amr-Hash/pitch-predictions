"use client";

import { ScoringRulesSection } from "@/components/ScoringRulesSection";
import { useT } from "@/lib/i18n";

export default function ScoringPage() {
  const t = useT();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title mb-2">{t("howScoringWorks")}</h1>
      <p className="mb-8 font-medium text-night-700/70">{t("scoringPageDesc")}</p>
      <ScoringRulesSection centered={false} />
    </div>
  );
}
