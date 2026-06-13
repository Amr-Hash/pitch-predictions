"use client";

import Link from "next/link";
import { Match, Prediction } from "@/lib/api";
import { useLocale, useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel } from "@/lib/localize";
import { formatDateTime } from "@/lib/format";
import { isMatchLive } from "@/lib/matchStatus";
import { cupGroupAccent } from "@/lib/theme";

interface Props {
  match: Match;
  prediction?: Prediction | null;
  showPredictLink?: boolean;
  showResultLink?: boolean;
}

export function MatchCard({ match, prediction, showPredictLink, showResultLink }: Props) {
  const { locale } = useLocale();
  const t = useT();
  const kickoff = formatDateTime(match.kickoff_time, locale);
  const isFinished = match.status === "finished";
  const isLive = isMatchLive(match);
  const canEdit = showPredictLink && !match.is_locked && !isFinished;
  const hasScore = match.home_score !== null && match.away_score !== null;
  const context = matchContextLabel(match, locale, t("group"));
  const matchdaySuffix = match.matchday
    ? ` · ${t("matchday", { day: match.matchday })}`
    : "";
  const accent = cupGroupAccent(match.cup_group_name);

  const predictLabel = prediction
    ? canEdit
      ? t("editPrediction")
      : t("viewPrediction")
    : t("predict");

  return (
    <div className="card-match">
      <div className={`h-1.5 ${accent.bar}`} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-bold ${accent.pill}`}>
            {context}
            {matchdaySuffix}
          </span>
          {isLive && (
            <span className="live-badge-sm">
              <span className="live-dot" aria-hidden />
              {t("liveNow")}
            </span>
          )}
          {match.is_locked && !isFinished && !isLive && (
            <span
              className={`rounded-full px-2.5 py-0.5 font-bold ${
                match.is_matchday_locked
                  ? "bg-gold-100 text-gold-800"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {match.is_matchday_locked ? t("notYetOpen") : t("locked")}
            </span>
          )}
          {isFinished && (
            <span className="rounded-full bg-night-800/10 px-2.5 py-0.5 font-bold text-night-700">
              {t("matchFinished")}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 text-center">
            {match.home_team.flag_url && (
              <img
                src={match.home_team.flag_url}
                alt=""
                className="mx-auto mb-2 h-10 w-14 rounded object-cover shadow-sm ring-1 ring-black/5"
              />
            )}
            <p className="text-sm font-bold text-night-900">{teamLabel(match.home_team, locale)}</p>
          </div>
          <div className="text-center">
            {isFinished || (isLive && hasScore) ? (
              <p className="font-display text-3xl font-extrabold tabular-nums text-night-900">
                {match.home_score} - {match.away_score}
              </p>
            ) : isLive ? (
              <p className="font-display text-xl font-extrabold text-fan-600">{t("liveNow")}</p>
            ) : (
              <p className="font-display text-xl font-bold text-royal-300">{t("vs")}</p>
            )}
            <p className="mt-1 text-xs font-medium text-gray-500">{kickoff}</p>
          </div>
          <div className="flex-1 text-center">
            {match.away_team.flag_url && (
              <img
                src={match.away_team.flag_url}
                alt=""
                className="mx-auto mb-2 h-10 w-14 rounded object-cover shadow-sm ring-1 ring-black/5"
              />
            )}
            <p className="text-sm font-bold text-night-900">{teamLabel(match.away_team, locale)}</p>
          </div>
        </div>
        {prediction && (
          <div className="mt-4 rounded-xl bg-pitch-50/80 px-3 py-2.5 text-sm text-pitch-900">
            <p className="text-center font-medium text-pitch-800">{t("yourPrediction")}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
              <span className="font-bold">
                {prediction.predicted_home_score}-{prediction.predicted_away_score}
                {prediction.predicted_winner_team
                  ? ` (${teamLabel(prediction.predicted_winner_team, locale)} ${t("advances")})`
                  : match.is_knockout &&
                      prediction.predicted_home_score === prediction.predicted_away_score
                    ? ` (${t("noAdvancingPickSaved")})`
                    : ""}
              </span>
              {(prediction.points_awarded > 0 || isFinished) && (
                <span className="shrink-0 font-extrabold text-gold-600">
                  {prediction.points_awarded > 0 ? "+" : ""}
                  {prediction.points_awarded} {t("points")}
                </span>
              )}
            </div>
          </div>
        )}
        {match.lock_reason && !isFinished && match.is_locked && (
          <p className="mt-2 text-center text-xs font-medium text-fan-700">{match.lock_reason}</p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {isFinished ? (
            showResultLink && (
              <>
                <Link href={`/matches/${match.id}/results`} className="btn-primary text-sm">
                  {t("viewResults")}
                </Link>
                <Link href={`/matches/${match.id}/compare`} className="btn-secondary text-sm">
                  {t("compareWithGroup")}
                </Link>
              </>
            )
          ) : (
            showPredictLink &&
            (canEdit || prediction) && (
              <Link href={`/matches/${match.id}`} className="btn-primary text-sm">
                {predictLabel}
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
