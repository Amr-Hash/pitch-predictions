"use client";

import Link from "next/link";
import { DashboardPodiumEntry } from "@/lib/api";
import { OlympicPodium } from "@/components/OlympicPodium";
import { useT } from "@/lib/i18n";

interface Props {
  podium: DashboardPodiumEntry[];
  currentRank: number | null;
  totalPoints: number;
  leaderPoints: number;
}

export function GlobalRankPodium({ podium, currentRank, totalPoints, leaderPoints }: Props) {
  const t = useT();
  const gap = leaderPoints - totalPoints;
  const hasPodium = podium.length > 0;

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-heading-royal text-base normal-case tracking-normal">
          {t("globalLeaderboard")}
        </h2>
        <Link href="/leaderboards" className="btn-secondary text-sm">
          {t("viewGlobalLeaderboard")} →
        </Link>
      </div>

      <div className="card border-t-4 border-t-gold-500 bg-gradient-to-b from-gold-50/40 to-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500">{t("globalPodium")}</p>
            {!hasPodium && (
              <p className="mt-1 text-sm text-gray-600">{t("noRankingsDesc")}</p>
            )}
          </div>
          <div className="shrink-0 rounded-xl bg-night-900 px-3 py-1.5 text-center text-white shadow">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gold-400">
              {t("yourRank")}
            </p>
            <p className="font-display text-2xl font-extrabold leading-none">
              {currentRank != null ? (
                <>
                  {currentRank === 1
                    ? "🥇"
                    : currentRank === 2
                      ? "🥈"
                      : currentRank === 3
                        ? "🥉"
                        : `#${currentRank}`}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        {hasPodium && <OlympicPodium podium={podium} />}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-sm">
          <span className="font-display text-xl font-extrabold text-gold-600">
            {totalPoints}{" "}
            <span className="text-xs font-normal text-gray-500">{t("points")}</span>
          </span>
          {gap > 0 && currentRank !== 1 && (
            <span className="text-xs text-gray-500">{t("behindLeader", { points: gap })}</span>
          )}
          <Link href="/leaderboards" className="font-bold text-royal-600">
            {t("viewLeaderboard")}
          </Link>
        </div>
      </div>
    </section>
  );
}
