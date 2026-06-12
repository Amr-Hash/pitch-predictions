"use client";

import Link from "next/link";
import { APP_NAME, APP_NAME_LATIN, APP_TAGLINE, APP_TAGLINE_EN } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { TournamentPicker } from "@/components/TournamentPicker";
import { isStaff } from "@/lib/staff";
import { useTournament } from "@/lib/tournament";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export default function HomeContent() {
  const { user, loading } = useAuth();
  const { selectedTournament, loading: tournamentLoading } = useTournament();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const pickingTournament = searchParams.get("pick") === "1";

  useEffect(() => {
    if (!loading && user && isStaff(user)) {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (
      !loading &&
      !tournamentLoading &&
      user &&
      !isStaff(user) &&
      selectedTournament &&
      !pickingTournament
    ) {
      router.replace("/dashboard");
    }
  }, [loading, tournamentLoading, user, selectedTournament, pickingTournament, router]);

  const showPicker =
    !loading && user && !isStaff(user) && (pickingTournament || !selectedTournament);

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

      {loading || (user && !isStaff(user) && tournamentLoading) ? (
        <span className="text-gray-500">{t("loading")}</span>
      ) : showPicker ? (
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
          <ScoreRule points={5} title={t("exactScore")} description={t("exactScoreDesc")} />
          <ScoreRule points={3} title={t("correctOutcome")} description={t("correctOutcomeDesc")} />
          <ScoreRule points={1} title={t("correctGoalDiff")} description={t("correctGoalDiffDesc")} />
          <ScoreRule points={5} title={t("knockoutBonus")} description={t("knockoutBonusDesc")} />
        </div>
      </section>
    </div>
  );
}

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
    <div className="card">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pitch-100 text-lg font-bold text-pitch-700">
          {points}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
