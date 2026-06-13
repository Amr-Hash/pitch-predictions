"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, Match, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";
import { matchContextLabel, teamLabel } from "@/lib/localize";
import { formatDateTime } from "@/lib/format";

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();
  const [match, setMatch] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [winnerId, setWinnerId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      api.getMatches(token).then((data) => {
        const list = unwrapList(data);
        setMatch(list.find((m) => m.id === Number(id)) || null);
      }),
      api.getPredictions(token, { match: Number(id) }).then((data) => {
        const existing = unwrapList(data)[0] ?? null;
        setPrediction(existing);
        if (existing) {
          setHomeScore(String(existing.predicted_home_score));
          setAwayScore(String(existing.predicted_away_score));
          if (existing.predicted_winner_team) {
            setWinnerId(existing.predicted_winner_team.id);
          }
        }
      }),
    ]).catch((e) => setError(e.message));
  }, [token, id]);

  const homeScoreNum = homeScore === "" ? null : Number(homeScore);
  const awayScoreNum = awayScore === "" ? null : Number(awayScore);
  const showWinnerSelect =
    match?.is_knockout &&
    homeScoreNum !== null &&
    awayScoreNum !== null &&
    homeScoreNum === awayScoreNum;

  const handleScoreChange = (setter: (value: string) => void, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setter(value);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !match) return;
    if (homeScore === "" || awayScore === "") {
      setError(t("enterBothScores"));
      return;
    }
    if (showWinnerSelect && !winnerId) {
      setError(t("selectAdvancingTeamRequired"));
      return;
    }
    setError("");
    setSuccess("");
    const payload = {
      match: match.id,
      predicted_home_score: Number(homeScore),
      predicted_away_score: Number(awayScore),
      predicted_winner_team_id: showWinnerSelect ? Number(winnerId) : null,
    };
    try {
      if (prediction) {
        await api.updatePrediction(token, prediction.id, payload);
        router.push("/matches");
      } else {
        await api.createPrediction(token, payload);
        router.push("/matches");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tryAgain"));
    }
  };

  if (authLoading || !user) return <div>{t("loading")}</div>;
  if (!match) return <div>{t("matchNotFound")}</div>;

  const isFinished = match.status === "finished";
  const canEdit = !match.is_locked && !isFinished;
  const kickoff = formatDateTime(match.kickoff_time, locale);
  const context = matchContextLabel(match, locale, t("group"));
  const matchdaySuffix = match.matchday ? ` · ${t("matchday", { day: match.matchday })}` : "";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/matches" className="mb-4 inline-flex items-center text-sm text-pitch-600 hover:underline">
        ← {t("backToMatches")}
      </Link>
      <h1 className="mb-2 text-3xl font-bold">{t("matchPrediction")}</h1>
      <p className="mb-6 text-gray-600">
        {context}
        {matchdaySuffix}
      </p>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            {match.home_team.flag_url && (
              <img src={match.home_team.flag_url} alt="" className="mx-auto mb-2 h-12 w-16 object-cover" />
            )}
            <p className="text-lg font-semibold">{teamLabel(match.home_team, locale)}</p>
          </div>
          <div className="text-center">
            {isFinished ? (
              <p className="text-3xl font-bold">
                {match.home_score} - {match.away_score}
              </p>
            ) : (
              <p className="text-gray-400">{t("vs")}</p>
            )}
          </div>
          <div className="flex-1 text-center">
            {match.away_team.flag_url && (
              <img src={match.away_team.flag_url} alt="" className="mx-auto mb-2 h-12 w-16 object-cover" />
            )}
            <p className="text-lg font-semibold">{teamLabel(match.away_team, locale)}</p>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          {t("kickoffLabel")}: {kickoff}
        </p>
        {isFinished && (
          <p className="mt-2 text-center text-sm font-medium text-gray-700">
            {t("matchFinished")} {t("predictionsLocked")}
          </p>
        )}
        {!isFinished && match.is_locked && (
          <p
            className={`mt-2 text-center text-sm font-medium ${match.is_matchday_locked ? "text-amber-700" : "text-red-600"}`}
          >
            {match.lock_reason || t("predictionWindowClosed")}
          </p>
        )}
      </div>

      {canEdit && (
        <div className="card">
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}
          {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-700">{success}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">
                  {t("teamScoreLabel", { code: match.home_team.code })}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="input text-center text-2xl"
                  value={homeScore}
                  onChange={(e) => handleScoreChange(setHomeScore, e.target.value)}
                  required
                />
              </div>
              <span className="pt-6 text-xl font-bold">-</span>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">
                  {t("teamScoreLabel", { code: match.away_team.code })}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="input text-center text-2xl"
                  value={awayScore}
                  onChange={(e) => handleScoreChange(setAwayScore, e.target.value)}
                  required
                />
              </div>
            </div>
            {showWinnerSelect && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t("selectAdvancingTeam")}</label>
                <select
                  className="input"
                  value={winnerId}
                  onChange={(e) => setWinnerId(Number(e.target.value) || "")}
                  required
                >
                  <option value="">{t("pickWinner")}</option>
                  <option value={match.home_team.id}>{teamLabel(match.home_team, locale)}</option>
                  <option value={match.away_team.id}>{teamLabel(match.away_team, locale)}</option>
                </select>
              </div>
            )}
            <button type="submit" className="btn-primary w-full">
              {prediction ? t("editPrediction") : t("predict")}
            </button>
          </form>
        </div>
      )}

      {prediction && (
        <div className="card mt-6">
          <h2 className="mb-3 font-semibold">{t("yourPrediction")}</h2>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span>
              {prediction.predicted_home_score}-{prediction.predicted_away_score}
              {prediction.predicted_winner_team
                ? ` (${teamLabel(prediction.predicted_winner_team, locale)} ${t("advances")})`
                : match.is_knockout &&
                  prediction.predicted_home_score === prediction.predicted_away_score &&
                  ` (${t("noAdvancingPickSaved")})`}
            </span>
            {isFinished && (
              <span className="shrink-0 font-semibold text-pitch-600">
                {prediction.points_awarded > 0 ? "+" : ""}
                {prediction.points_awarded} {t("points")}
              </span>
            )}
          </div>
        </div>
      )}

      {!prediction && isFinished && (
        <div className="card mt-6 text-sm text-gray-500">{t("noPredictionSubmitted")}</div>
      )}
    </div>
  );
}
