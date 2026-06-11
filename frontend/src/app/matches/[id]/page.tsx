"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, Group, Match, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [groupId, setGroupId] = useState<number | "">("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
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
      api.getGroups(token).then((data) => setGroups(unwrapList(data))),
      api.getPredictions(token, { match: Number(id) }).then((data) =>
        setPredictions(unwrapList(data))
      ),
    ]).catch((e) => setError(e.message));
  }, [token, id]);

  const existing = predictions.find((p) => p.group === groupId);
  const showWinnerSelect =
    match?.is_knockout && homeScore === awayScore;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !match || !groupId) return;
    setError("");
    setSuccess("");
    const payload = {
      group: Number(groupId),
      match: match.id,
      predicted_home_score: homeScore,
      predicted_away_score: awayScore,
      ...(showWinnerSelect && winnerId ? { predicted_winner_team_id: Number(winnerId) } : {}),
    };
    try {
      if (existing) {
        await api.updatePrediction(token, existing.id, payload);
        setSuccess("Prediction updated!");
      } else {
        await api.createPrediction(token, payload);
        setSuccess("Prediction submitted!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  if (authLoading || !user) return <div>Loading...</div>;
  if (!match) return <div>Match not found</div>;

  const locked = match.is_locked || match.status === "finished";
  const canPredict = !locked;

  return (
    <div className="mx-auto max-w-2xl">
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
          <div className="text-center text-gray-400">vs</div>
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
        {locked && (
          <p className={`mt-2 text-center text-sm font-medium ${match.is_matchday_locked ? "text-amber-700" : "text-red-600"}`}>
            {match.lock_reason || "Prediction window has closed for this match."}
          </p>
        )}
      </div>

      {canPredict && (
        <div className="card">
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}
          {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-700">{success}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Group</label>
              <select
                className="input"
                value={groupId}
                onChange={(e) => setGroupId(Number(e.target.value) || "")}
                required
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">{match.home_team.code} Score</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={homeScore}
                  onChange={(e) => setHomeScore(Number(e.target.value))}
                  required
                />
              </div>
              <span className="pt-6 text-xl font-bold">-</span>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">{match.away_team.code} Score</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={awayScore}
                  onChange={(e) => setAwayScore(Number(e.target.value))}
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
              {existing ? "Update Prediction" : "Submit Prediction"}
            </button>
          </form>
        </div>
      )}

      {predictions.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-3 font-semibold">Your Predictions</h2>
          {predictions.map((p) => (
            <div key={p.id} className="border-t py-2 text-sm">
              Group #{p.group}: {p.predicted_home_score}-{p.predicted_away_score}
              {p.predicted_winner_team && ` (${p.predicted_winner_team.name} advances)`}
              {p.points_awarded > 0 && (
                <span className="ml-2 text-pitch-600">+{p.points_awarded} pts</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
