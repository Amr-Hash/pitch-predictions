const API_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000";

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  invite_code: string;
  invite_link: string;
  member_count: number;
  is_admin: boolean;
}

export interface Team {
  id: number;
  name: string;
  code: string;
  flag_url: string;
}

export interface Match {
  id: number;
  tournament: number;
  stage: number;
  stage_name: string;
  cup_group: number | null;
  cup_group_name: string | null;
  matchday: number | null;
  home_team: Team;
  away_team: Team;
  kickoff_time: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner_team: Team | null;
  is_knockout: boolean;
  is_locked: boolean;
  is_matchday_locked: boolean;
  lock_reason: string | null;
}

export interface CupGroupTeam {
  order: number;
  team: Team;
}

export interface CupGroup {
  id: number;
  name: string;
  group_teams: CupGroupTeam[];
}

export interface Prediction {
  id: number;
  group: number;
  match: number;
  match_detail: Match;
  predicted_home_score: number;
  predicted_away_score: number;
  predicted_winner_team: Team | null;
  points_awarded: number;
  is_locked: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  total_points: number;
  exact_predictions: number;
  correct_outcomes: number;
}

export interface Dashboard {
  groups: { id: number; name: string; invite_code: string }[];
  upcoming_matches: Match[];
  pending_predictions: Match[];
  recent_results: Match[];
  total_points: number;
  current_rank: number | null;
}

export interface Tournament {
  id: number;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  stage_count: number;
  match_count: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      body.detail ||
      body.non_field_errors?.[0] ||
      JSON.stringify(body) ||
      res.statusText;
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  register: (data: { username: string; email: string; password: string; password_confirm: string }) =>
    request("/api/auth/register/", { method: "POST", body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    request<AuthTokens>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refresh: string) =>
    request<{ access: string }>("/api/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }),

  logout: (refresh: string, token: string) =>
    request("/api/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }, token),

  me: (token: string) => request<User>("/api/auth/me/", {}, token),

  getGroups: (token: string) => request<Group[]>("/api/groups/", {}, token),

  createGroup: (token: string, data: { name: string; description?: string }) =>
    request<Group>("/api/groups/", { method: "POST", body: JSON.stringify(data) }, token),

  joinGroup: (token: string, invite_code: string) =>
    request<Group>("/api/groups/join/", {
      method: "POST",
      body: JSON.stringify({ invite_code }),
    }, token),

  getTournaments: (token: string) =>
    request<{ results?: Tournament[] } | Tournament[]>("/api/tournaments/", {}, token),

  getCupGroups: (token: string, tournamentId: number) =>
    request<CupGroup[]>(`/api/tournaments/${tournamentId}/cup-groups/`, {}, token),

  getMatches: (token: string, params?: {
    tournament?: number;
    stage?: number;
    matchday?: number;
    cup_group?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    if (params?.stage) qs.set("stage", String(params.stage));
    if (params?.matchday) qs.set("matchday", String(params.matchday));
    if (params?.cup_group) qs.set("cup_group", params.cup_group);
    const query = qs.toString() ? `?${qs}` : "";
    return request<{ results?: Match[] } | Match[]>(`/api/tournaments/matches/${query}`, {}, token);
  },

  getPredictions: (token: string, params?: { group?: number; tournament?: number; match?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group) qs.set("group", String(params.group));
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    if (params?.match) qs.set("match", String(params.match));
    const query = qs.toString() ? `?${qs}` : "";
    return request<{ results?: Prediction[] } | Prediction[]>(`/api/predictions/${query}`, {}, token);
  },

  createPrediction: (token: string, data: {
    group: number;
    match: number;
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_winner_team_id?: number;
  }) =>
    request<Prediction>("/api/predictions/", { method: "POST", body: JSON.stringify(data) }, token),

  updatePrediction: (token: string, id: number, data: Partial<{
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_winner_team_id: number | null;
  }>) =>
    request<Prediction>(`/api/predictions/${id}/`, { method: "PATCH", body: JSON.stringify(data) }, token),

  getGroupLeaderboard: (token: string, groupId: number, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<LeaderboardEntry[]>(`/api/leaderboards/group/${groupId}/${qs}`, {}, token);
  },

  getGlobalLeaderboard: (token: string, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<LeaderboardEntry[]>(`/api/leaderboards/global/${qs}`, {}, token);
  },

  getDashboard: (token: string, params?: { group?: number; tournament?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group) qs.set("group", String(params.group));
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    const query = qs.toString() ? `?${qs}` : "";
    return request<Dashboard>(`/api/dashboard/${query}`, {}, token);
  },
};

export function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.results || [];
}
