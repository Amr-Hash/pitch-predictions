"use client";

import Link from "next/link";
import { APP_NAME, APP_NAME_LATIN, APP_TAGLINE, APP_TAGLINE_EN } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { TournamentPicker } from "@/components/TournamentPicker";
import { isStaff } from "@/lib/staff";
import { useTournament } from "@/lib/tournament";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { ScoringRulesSection } from "@/components/ScoringRulesSection";
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
      <div className="mb-6 rounded-full shadow-xl ring-4 ring-white">
        <Logo variant="hero" size={96} priority className="rounded-full" />
      </div>
      <h1 className="mb-2 font-display text-4xl font-extrabold text-night-900 sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mb-1 text-lg font-semibold text-royal-600">{APP_NAME_LATIN}</p>
      <p className="mb-4 max-w-2xl text-lg text-gray-600">{APP_TAGLINE}</p>
      <p className="mb-10 max-w-2xl text-sm text-gray-500">
        {APP_TAGLINE_EN} {t("taglineExtra")}
      </p>

      {loading || (user && !isStaff(user) && tournamentLoading) ? (
        <span className="text-gray-500">{t("loading")}</span>
      ) : showPicker ? (
        <TournamentPicker />
      ) : !user ? (
        <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-gradient-to-r from-night-900 via-royal-800 to-pitch-700 p-8 text-white shadow-xl">
          <p className="mb-6 text-lg font-medium text-white/90">{t("createGroupsDesc")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-full bg-fan-500 px-8 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-fan-400">
              {t("getStarted")}
            </Link>
            <Link href="/login" className="rounded-full border-2 border-white/40 bg-white/10 px-8 py-3 text-lg font-bold text-white backdrop-blur transition hover:bg-white/20">
              {t("login")}
            </Link>
          </div>
        </div>
      ) : null}

      {!user && (
        <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          <div className="feature-card-fan">
            <div className="mb-2 text-3xl">👥</div>
            <h3 className="font-bold text-fan-700">{t("createGroups")}</h3>
            <p className="mt-1 text-sm text-gray-600">{t("createGroupsDesc")}</p>
          </div>
          <div className="feature-card-pitch">
            <div className="mb-2 text-3xl">🎯</div>
            <h3 className="font-bold text-pitch-700">{t("predictMatches")}</h3>
            <p className="mt-1 text-sm text-gray-600">{t("predictMatchesDesc")}</p>
          </div>
          <div className="feature-card-royal">
            <div className="mb-2 text-3xl">📊</div>
            <h3 className="font-bold text-royal-700">{t("trackRankings")}</h3>
            <p className="mt-1 text-sm text-gray-600">{t("trackRankingsDesc")}</p>
          </div>
        </div>
      )}

      <ScoringRulesSection className="mt-16 w-full max-w-4xl text-left" />
    </div>
  );
}
