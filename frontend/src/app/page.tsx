"use client";

import Link from "next/link";
import { APP_NAME, APP_NAME_LATIN, APP_TAGLINE, APP_TAGLINE_EN } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { TournamentPicker } from "@/components/TournamentPicker";
import { isStaff } from "@/lib/staff";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!loading && user && isStaff(user)) {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-16">
      <div className="mb-6 text-6xl">⚽</div>
      <h1 className="mb-2 text-4xl font-bold text-pitch-900 sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mb-1 text-lg text-gray-500">{APP_NAME_LATIN}</p>
      <p className="mb-4 max-w-2xl text-lg text-gray-600">{APP_TAGLINE}</p>
      <p className="mb-10 max-w-2xl text-sm text-gray-500">
        {APP_TAGLINE_EN} {t("taglineExtra")}
      </p>

      {loading ? (
        <span className="text-gray-500">{t("loading")}</span>
      ) : user && !isStaff(user) ? (
        <TournamentPicker />
      ) : !user ? (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-primary px-8 py-3 text-lg">
              {t("getStarted")}
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-3 text-lg">
              {t("login")}
            </Link>
          </div>
        </div>
      ) : null}

      {!user && (
        <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          <div className="card text-left">
            <div className="mb-2 text-2xl">👥</div>
            <h3 className="font-semibold">{t("createGroups")}</h3>
            <p className="mt-1 text-sm text-gray-600">{t("createGroupsDesc")}</p>
          </div>
          <div className="card text-left">
            <div className="mb-2 text-2xl">🎯</div>
            <h3 className="font-semibold">{t("predictMatches")}</h3>
            <p className="mt-1 text-sm text-gray-600">{t("predictMatchesDesc")}</p>
          </div>
          <div className="card text-left">
            <div className="mb-2 text-2xl">📊</div>
            <h3 className="font-semibold">{t("trackRankings")}</h3>
            <p className="mt-1 text-sm text-gray-600">{t("trackRankingsDesc")}</p>
          </div>
        </div>
      )}

      <section className="mt-16 w-full max-w-4xl text-left">
        <h2 className="mb-2 text-center text-2xl font-bold text-pitch-900">
          {t("howScoringWorks")}
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">{t("scoringIntro")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreRule
            points={5}
            title={t("exactScore")}
            color="bg-gold-100 text-gold-800 border-gold-200"
            description={t("exactScoreDesc")}
            t={t}
          />
          <ScoreRule
            points={3}
            title={t("correctGoalDiff")}
            color="bg-pitch-100 text-pitch-800 border-pitch-200"
            description={t("correctGoalDiffDesc")}
            t={t}
          />
          <ScoreRule
            points={1}
            title={t("correctOutcome")}
            color="bg-blue-100 text-blue-800 border-blue-200"
            description={t("correctOutcomeDesc")}
            t={t}
          />
          <ScoreRule
            points={0}
            title={t("wrongOutcome")}
            color="bg-gray-100 text-gray-600 border-gray-200"
            description={t("wrongOutcomeDesc")}
            t={t}
          />
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <ScoreRule
            points={1}
            title={t("knockoutBonus")}
            color="bg-amber-100 text-amber-900 border-amber-300"
            description={t("knockoutBonusDesc")}
            t={t}
          />
        </div>
      </section>
    </div>
  );
}

function ScoreRule({
  points,
  title,
  description,
  color,
  t,
}: {
  points: number;
  title: string;
  description: string;
  color: string;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="card flex gap-4">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold ${color}`}
      >
        {points}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">
          {points} {points === 1 ? t("point") : t("pointsPlural")} — {title}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
