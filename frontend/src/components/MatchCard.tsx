import Link from "next/link";
import { Match } from "@/lib/api";

interface Props {
  match: Match;
  showPredictLink?: boolean;
  showResultLink?: boolean;
}

export function MatchCard({ match, showPredictLink, showResultLink }: Props) {
  const kickoff = new Date(match.kickoff_time).toLocaleString();
  const isFinished = match.status === "finished";
  const canPredict = showPredictLink && !match.is_locked && !isFinished;

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {match.cup_group_name ? `Group ${match.cup_group_name}` : match.stage_name}
          {match.matchday ? ` · MD${match.matchday}` : ""}
        </span>
        {match.is_locked && !isFinished && (
          <span
            className={`rounded px-2 py-0.5 ${
              match.is_matchday_locked
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-700"
            }`}
          >
            {match.is_matchday_locked ? "Not yet open" : "Locked"}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          {match.home_team.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="mx-auto mb-1 h-8 w-12 object-cover" />
          )}
          <p className="font-semibold">{match.home_team.name}</p>
        </div>
        <div className="text-center">
          {isFinished ? (
            <p className="text-2xl font-bold">
              {match.home_score} - {match.away_score}
            </p>
          ) : (
            <p className="text-lg text-gray-400">vs</p>
          )}
          <p className="text-xs text-gray-500">{kickoff}</p>
        </div>
        <div className="flex-1 text-center">
          {match.away_team.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="mx-auto mb-1 h-8 w-12 object-cover" />
          )}
          <p className="font-semibold">{match.away_team.name}</p>
        </div>
      </div>
      {match.lock_reason && !isFinished && match.is_locked && (
        <p className="mt-2 text-center text-xs text-amber-700">{match.lock_reason}</p>
      )}
      <div className="mt-3 flex justify-center gap-2">
        {canPredict && (
          <Link href={`/matches/${match.id}`} className="btn-primary text-sm">
            Predict
          </Link>
        )}
        {showResultLink && isFinished && (
          <Link href={`/matches/${match.id}/results`} className="btn-secondary text-sm">
            View Results
          </Link>
        )}
        <Link href={`/matches/${match.id}`} className="btn-secondary text-sm">
          Details
        </Link>
      </div>
    </div>
  );
}
