"use client";

import Link from "next/link";
import { Match } from "@/lib/api";
import { useLocale, useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel } from "@/lib/localize";

interface Props {
  match: Match;
  showPredictLink?: boolean;
  showResultLink?: boolean;
}

export function MatchCard({ match, showPredictLink, showResultLink }: Props) {
  const { locale } = useLocale();
  const t = useT();
  const kickoff = new Date(match.kickoff_time).toLocaleString(
    locale === "ar" ? "ar-EG" : undefined
  );
  const isFinished = match.status === "finished";
  const canPredict = showPredictLink && !match.is_locked && !isFinished;
  const context = matchContextLabel(match, locale, t("group"));
  const matchdaySuffix = match.matchday
    ? ` · ${t("matchday", { day: match.matchday })}`
    : "";

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {context}
          {matchdaySuffix}
        </span>
        {match.is_locked && !isFinished && (
          <span
            className={`rounded px-2 py-0.5 ${
              match.is_matchday_locked
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-700"
            }`}
          >
            {match.is_matchday_locked ? t("notYetOpen") : t("locked")}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          {match.home_team.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="mx-auto mb-1 h-8 w-12 object-cover" />
          )}
          <p className="font-semibold">{teamLabel(match.home_team, locale)}</p>
        </div>
        <div className="text-center">
          {isFinished ? (
            <p className="text-2xl font-bold">
              {match.home_score} - {match.away_score}
            </p>
          ) : (
            <p className="text-lg text-gray-400">{t("vs")}</p>
          )}
          <p className="text-xs text-gray-500">{kickoff}</p>
        </div>
        <div className="flex-1 text-center">
          {match.away_team.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="mx-auto mb-1 h-8 w-12 object-cover" />
          )}
          <p className="font-semibold">{teamLabel(match.away_team, locale)}</p>
        </div>
      </div>
      {match.lock_reason && !isFinished && match.is_locked && (
        <p className="mt-2 text-center text-xs text-amber-700">{match.lock_reason}</p>
      )}
      <div className="mt-3 flex justify-center gap-2">
        {canPredict && (
          <Link href={`/matches/${match.id}`} className="btn-primary text-sm">
            {t("predict")}
          </Link>
        )}
        {showResultLink && isFinished && (
          <Link href={`/matches/${match.id}/results`} className="btn-secondary text-sm">
            {t("viewResults")}
          </Link>
        )}
        <Link href={`/matches/${match.id}`} className="btn-secondary text-sm">
          {t("details")}
        </Link>
      </div>
    </div>
  );
}
