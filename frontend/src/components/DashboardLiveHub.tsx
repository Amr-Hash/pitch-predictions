"use client";

import Link from "next/link";
import { Match, Prediction } from "@/lib/api";
import { useCountdown } from "@/hooks/useCountdown";
import { useLocale, useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel } from "@/lib/localize";
import { cupGroupAccent } from "@/lib/theme";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="countdown-digit">{value}</div>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
        {label}
      </span>
    </div>
  );
}

function CountdownSeparator() {
  return (
    <span className="mb-5 font-display text-2xl font-extrabold text-white/50" aria-hidden>
      :
    </span>
  );
}

function NextMatchCountdown({ match }: { match: Match }) {
  const { locale } = useLocale();
  const t = useT();
  const countdown = useCountdown(match.kickoff_time);
  const accent = cupGroupAccent(match.cup_group_name);
  const kickoffDate = new Date(match.kickoff_time).toLocaleString(
    locale === "ar" ? "ar-EG" : undefined,
    { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className="live-hub-countdown">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-300">
            {t("nextKickoff")}
          </p>
          <p className="mt-1 text-sm text-white/80">
            {matchContextLabel(match, locale, t("group"))}
            {match.matchday ? ` · ${t("matchday", { day: match.matchday })}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${accent.pill}`}>
          {kickoffDate}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-center gap-4">
        {match.home_team.flag_url && (
          <img
            src={match.home_team.flag_url}
            alt=""
            className="h-12 w-16 rounded object-cover shadow-lg ring-2 ring-white/30"
          />
        )}
        <div className="text-center">
          <p className="font-display text-lg font-extrabold text-white sm:text-xl">
            {teamLabel(match.home_team, locale)}
          </p>
          <p className="text-sm font-bold text-white/60">{t("vs")}</p>
          <p className="font-display text-lg font-extrabold text-white sm:text-xl">
            {teamLabel(match.away_team, locale)}
          </p>
        </div>
        {match.away_team.flag_url && (
          <img
            src={match.away_team.flag_url}
            alt=""
            className="h-12 w-16 rounded object-cover shadow-lg ring-2 ring-white/30"
          />
        )}
      </div>

      {countdown.expired ? (
        <p className="text-center font-display text-xl font-extrabold text-fan-200">
          {t("kickoffNow")}
        </p>
      ) : (
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {countdown.days > 0 && (
            <>
              <CountdownUnit value={pad(countdown.days)} label={t("countdownDays")} />
              <CountdownSeparator />
            </>
          )}
          <CountdownUnit value={pad(countdown.hours)} label={t("countdownHours")} />
          <CountdownSeparator />
          <CountdownUnit value={pad(countdown.minutes)} label={t("countdownMinutes")} />
          <CountdownSeparator />
          <CountdownUnit value={pad(countdown.seconds)} label={t("countdownSeconds")} />
        </div>
      )}

      <div className="mt-5 flex justify-center">
        <Link
          href={`/matches/${match.id}`}
          className="rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
        >
          {t("viewMatch")} →
        </Link>
      </div>
    </div>
  );
}

function LiveMatchTile({
  match,
  prediction,
}: {
  match: Match;
  prediction?: Prediction | null;
}) {
  const { locale } = useLocale();
  const t = useT();
  const hasScore = match.home_score !== null && match.away_score !== null;

  return (
    <Link href={`/matches/${match.id}`} className="live-match-tile block">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="live-badge">
          <span className="live-dot" aria-hidden />
          {t("liveNow")}
        </span>
        <span className="text-xs text-white/70">
          {matchContextLabel(match, locale, t("group"))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
          {teamLabel(match.home_team, locale)}
        </p>
        <p className="font-display text-xl font-extrabold tabular-nums text-white">
          {hasScore ? `${match.home_score} - ${match.away_score}` : t("vs")}
        </p>
        <p className="min-w-0 flex-1 truncate text-right text-sm font-bold text-white">
          {teamLabel(match.away_team, locale)}
        </p>
      </div>
      {prediction && (
        <p className="mt-2 text-center text-xs text-white/80">
          {t("yourPrediction")}: {prediction.predicted_home_score}-{prediction.predicted_away_score}
        </p>
      )}
    </Link>
  );
}

interface Props {
  nextMatch: Match | null;
  liveMatches: Match[];
  predictionsByMatch: Record<number, Prediction>;
}

export function DashboardLiveHub({ nextMatch, liveMatches, predictionsByMatch }: Props) {
  const t = useT();

  if (!nextMatch && liveMatches.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="live-hub">
        {liveMatches.length > 0 && (
          <div className={nextMatch ? "mb-6 border-b border-white/15 pb-6" : ""}>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold text-white">
              <span className="live-dot-lg" aria-hidden />
              {t("liveMatches")}
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm">{liveMatches.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {liveMatches.map((match) => (
                <LiveMatchTile
                  key={match.id}
                  match={match}
                  prediction={predictionsByMatch[match.id]}
                />
              ))}
            </div>
          </div>
        )}

        {nextMatch && <NextMatchCountdown match={nextMatch} />}
      </div>
    </section>
  );
}
