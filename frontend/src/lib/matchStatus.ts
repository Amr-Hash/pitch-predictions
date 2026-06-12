import { Match } from "./api";

/** Kickoff has passed but the match is not finished yet. */
export function isMatchLive(match: Match): boolean {
  if (match.status === "finished") return false;
  if (match.status === "live") return true;
  return new Date(match.kickoff_time).getTime() <= Date.now();
}

export function isMatchUpcoming(match: Match): boolean {
  if (match.status === "finished") return false;
  return new Date(match.kickoff_time).getTime() > Date.now();
}
