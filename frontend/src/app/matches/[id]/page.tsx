"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, Match, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
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
      setError("Please enter both scores.");
      return;
    }
    setError("");
    setSuccess("");
    const payload = {
      match: match.id,
      predicted_home_score: Number(homeScore),
      predicted_away_score: Number(awayScore),
      ...(showWinnerSelect && winnerId ? { predicted_winner_team_id: Number(winnerId) } : {}),
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
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  if (authLoading || !user) return <div>Loading...</div>;
  if (!match) return <div>Match not found</div>;

  const isFinished = match.status === "finished";
  const canEdit = !match.is_locked && !isFinished;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/matches" className="mb-4 inline-flex items-center text-sm text-pitch-600 hover:underline">
        ← {t("backToMatches")}
      </Link>
      <h1 className="mb-2 text-3xl font-bold">Match Prediction</h1>
      <p className="mb-6 text-gray-600">
        {match.cup_group_name ? `Group ${match.cup_group_name}` : match.stage_name}
        {match.matchday ? ` · Matchday ${match.matchday}` : ""}
      </p>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            {match.home_team.flag_url && (
              <img src={match.home_team.flag_url} alt="" className="mx-auto mb-2 h-12 w-16 object-cover" />
            )}
            <p className="text-lg font-semibold">{match.home_team.name}</p>
          </div>
          <div className="text-center">
            {isFinished ? (
              <p className="text-3xl font-bold">
                {match.home_score} - {match.away_score}
              </p>
            ) : (
              <p className="text-gray-400">vs</p>
            )}
          </div>
          <div className="flex-1 text-center">
            {match.away_team.flag_url && (
              <img src={match.away_team.flag_url} alt="" className="mx-auto mb-2 h-12 w-16 object-cover" />
            )}
            <p className="text-lg font-semibold">{match.away_team.name}</p>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          Kickoff: {new Date(match.kickoff_time).toLocaleString()}
        </p>
        {isFinished && (
          <p className="mt-2 text-center text-sm font-medium text-gray-700">
            {t("matchFinished")} {t("predictionsLocked")}
          </p>
        )}
        {!isFinished && match.is_locked && (
          <p className={`mt-2 text-center text-sm font-medium ${match.is_matchday_locked ? "text-amber-700" : "text-red-600"}`}>
            {match.lock_reason || "Prediction window has closed for this match."}
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
                <label className="mb-1 block text-sm font-medium">{match.home_team.code} Score</label>
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
                <label className="mb-1 block text-sm font-medium">{match.away_team.code} Score</label>
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
                <label className="mb-1 block text-sm font-medium">
                  Team that advances (required for tied score)
                </label>
                <select
                  className="input"
                  value={winnerId}
                  onChange={(e) => setWinnerId(Number(e.target.value) || "")}
                  required
                >
                  <option value="">Select winner</option>
                  <option value={match.home_team.id}>{match.home_team.name}</option>
                  <option value={match.away_team.id}>{match.away_team.name}</option>
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
          <div className="text-sm">
            {prediction.predicted_home_score}-{prediction.predicted_away_score}
            {prediction.predicted_winner_team && ` (${prediction.predicted_winner_team.name} advances)`}
            {prediction.points_awarded > 0 && (
              <span className="ml-2 text-pitch-600">+{prediction.points_awarded} {t("points")}</span>
            )}
          </div>
        </div>
      )}

      {!prediction && isFinished && (
        <div className="card mt-6 text-sm text-gray-500">
          You did not submit a prediction for this match.
        </div>
      )}
    </div>
  );
}
