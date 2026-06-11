const API_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined"
      ? ""
      : process.env.BACKEND_URL || "http://localhost:8000";

export interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
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
  name_ar?: string;
  code: string;
  flag_url: string;
}

export interface Match {
  id: number;
  tournament: number;
  stage: number;
  stage_name: string;
  stage_name_ar?: string;
  cup_group: number | null;
  cup_group_name: string | null;
  cup_group_name_ar?: string | null;
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
  name_ar?: string;
  tournament?: number;
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
  name_ar?: string;
  year: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  is_archived?: boolean;
  stage_count?: number;
  match_count?: number;
  stages?: { id: number; name: string; name_ar?: string; order: number; stage_type: string }[];
  cup_groups?: CupGroup[];
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
      (Object.keys(body).length > 0 ? JSON.stringify(body) : null) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  register: (data: { username: string; email: string; password: string; password_confirm: string }) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    request<AuthTokens>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refresh: string) =>
    request<{ access: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }),

  logout: (refresh: string, token: string) =>
    request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }, token),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  getGroups: (token: string) => request<Group[]>("/api/groups", {}, token),

  createGroup: (token: string, data: { name: string; description?: string }) =>
    request<Group>("/api/groups", { method: "POST", body: JSON.stringify(data) }, token),

  joinGroup: (token: string, invite_code: string) =>
    request<Group>("/api/groups/join", {
      method: "POST",
      body: JSON.stringify({ invite_code }),
    }, token),

  getTournaments: (token: string) =>
    request<{ results?: Tournament[] } | Tournament[]>("/api/tournaments", {}, token),

  getCupGroups: (token: string, tournamentId: number) =>
    request<CupGroup[]>(`/api/tournaments/${tournamentId}/cup-groups`, {}, token),

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
    return request<{ results?: Match[] } | Match[]>(`/api/tournaments/matches${query}`, {}, token);
  },

  getPredictions: (token: string, params?: { group?: number; tournament?: number; match?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group) qs.set("group", String(params.group));
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    if (params?.match) qs.set("match", String(params.match));
    const query = qs.toString() ? `?${qs}` : "";
    return request<{ results?: Prediction[] } | Prediction[]>(`/api/predictions${query}`, {}, token);
  },

  createPrediction: (token: string, data: {
    group: number;
    match: number;
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_winner_team_id?: number;
  }) =>
    request<Prediction>("/api/predictions", { method: "POST", body: JSON.stringify(data) }, token),

  updatePrediction: (token: string, id: number, data: Partial<{
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_winner_team_id: number | null;
  }>) =>
    request<Prediction>(`/api/predictions/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  getGroupLeaderboard: (token: string, groupId: number, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<LeaderboardEntry[]>(`/api/leaderboards/group/${groupId}${qs}`, {}, token);
  },

  getGlobalLeaderboard: (token: string, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<LeaderboardEntry[]>(`/api/leaderboards/global${qs}`, {}, token);
  },

  getDashboard: (token: string, params?: { group?: number; tournament?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group) qs.set("group", String(params.group));
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    const query = qs.toString() ? `?${qs}` : "";
    return request<Dashboard>(`/api/dashboard${query}`, {}, token);
  },

  // Admin API (requires is_staff)
  adminGetTournaments: (token: string) =>
    request<{ results?: Tournament[] } | Tournament[]>(
      "/api/tournaments/admin/tournaments",
      {},
      token
    ),

  adminGetTournament: (token: string, id: number) =>
    request<Tournament>(`/api/tournaments/admin/tournaments/${id}`, {}, token),

  adminCreateTournament: (
    token: string,
    data: {
      name: string;
      year: number;
      start_date: string;
      end_date: string;
      is_active?: boolean;
      is_archived?: boolean;
    }
  ) =>
    request<Tournament>(
      "/api/tournaments/admin/tournaments",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  adminUpdateTournament: (
    token: string,
    id: number,
    data: Partial<{
      name: string;
      year: number;
      start_date: string;
      end_date: string;
      is_active: boolean;
      is_archived: boolean;
    }>
  ) =>
    request<Tournament>(
      `/api/tournaments/admin/tournaments/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token
    ),

  adminDeleteTournament: (token: string, id: number) =>
    request(`/api/tournaments/admin/tournaments/${id}`, { method: "DELETE" }, token),

  adminGetStages: (token: string, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<
      { results?: { id: number; name: string; order: number; stage_type: string; tournament: number }[] }
      | { id: number; name: string; order: number; stage_type: string; tournament: number }[]
    >(`/api/tournaments/admin/stages${qs}`, {}, token);
  },

  adminCreateStage: (
    token: string,
    data: { tournament: number; name: string; order: number; stage_type: string }
  ) =>
    request("/api/tournaments/admin/stages", { method: "POST", body: JSON.stringify(data) }, token),

  adminDeleteStage: (token: string, id: number) =>
    request(`/api/tournaments/admin/stages/${id}`, { method: "DELETE" }, token),

  adminGetTeams: (token: string) =>
    request<{ results?: Team[] } | Team[]>("/api/tournaments/teams", {}, token),

  adminCreateTeam: (token: string, data: { name: string; code: string; flag_url?: string }) =>
    request<Team>("/api/tournaments/teams", { method: "POST", body: JSON.stringify(data) }, token),

  adminUpdateTeam: (
    token: string,
    id: number,
    data: Partial<{ name: string; code: string; flag_url: string }>
  ) =>
    request<Team>(`/api/tournaments/teams/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  adminDeleteTeam: (token: string, id: number) =>
    request(`/api/tournaments/teams/${id}`, { method: "DELETE" }, token),

  adminGetCupGroups: (token: string, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<{ results?: CupGroup[] } | CupGroup[]>(
      `/api/tournaments/admin/cup-groups${qs}`,
      {},
      token
    );
  },

  adminCreateCupGroup: (
    token: string,
    data: { tournament: number; name: string; team_ids?: number[] }
  ) =>
    request<CupGroup>(
      "/api/tournaments/admin/cup-groups",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  adminUpdateCupGroup: (
    token: string,
    id: number,
    data: Partial<{ tournament: number; name: string; team_ids: number[] }>
  ) =>
    request<CupGroup>(
      `/api/tournaments/admin/cup-groups/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token
    ),

  adminDeleteCupGroup: (token: string, id: number) =>
    request(`/api/tournaments/admin/cup-groups/${id}`, { method: "DELETE" }, token),

  adminGetMatches: (
    token: string,
    params?: { tournament?: number; stage?: number; matchday?: number; cup_group?: string; status?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    if (params?.stage) qs.set("stage", String(params.stage));
    if (params?.matchday) qs.set("matchday", String(params.matchday));
    if (params?.cup_group) qs.set("cup_group", params.cup_group);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString() ? `?${qs}` : "";
    return request<{ results?: Match[] } | Match[]>(
      `/api/tournaments/admin/matches${query}`,
      {},
      token
    );
  },

  adminCreateMatch: (
    token: string,
    data: {
      tournament: number;
      stage: number;
      home_team: number;
      away_team: number;
      kickoff_time: string;
      cup_group?: number | null;
      matchday?: number | null;
      status?: string;
    }
  ) =>
    request<Match>(
      "/api/tournaments/admin/matches",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  adminUpdateMatch: (
    token: string,
    id: number,
    data: Partial<{
      tournament: number;
      stage: number;
      cup_group: number | null;
      matchday: number | null;
      home_team: number;
      away_team: number;
      kickoff_time: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
      winner_team: number | null;
    }>
  ) =>
    request<Match>(
      `/api/tournaments/admin/matches/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token
    ),

  adminDeleteMatch: (token: string, id: number) =>
    request(`/api/tournaments/admin/matches/${id}`, { method: "DELETE" }, token),

  adminRecalculateMatch: (token: string, id: number) =>
    request<{ detail: string }>(
      `/api/tournaments/admin/matches/${id}/recalculate`,
      { method: "POST" },
      token
    ),
};

export function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.results || [];
}
