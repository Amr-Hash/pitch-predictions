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

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  group_count: number;
  created_at: string;
}

export interface AdminGroup {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_by_username: string;
  invite_code: string;
  member_count: number;
  created_at: string;
  members?: GroupMember[];
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_by_username?: string;
  invite_code: string;
  invite_link: string;
  member_count: number;
  is_admin: boolean;
}

export interface GroupMember {
  id: number;
  user: number;
  username: string;
  email: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface GroupMemberMatchPrediction {
  user_id: number;
  username: string;
  has_prediction?: boolean;
  is_hidden?: boolean;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_winner_team: Team | null;
  points_awarded: number;
}

export interface GroupMatchPredictions {
  match: Match;
  predictions: GroupMemberMatchPrediction[];
}

export interface GroupPredictionsResponse {
  group: Group;
  members: GroupMember[];
  matches: GroupMatchPredictions[];
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

export interface GroupStandingRow {
  rank: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  qualifies: boolean;
}

export interface CupGroupStandings {
  group_id: number;
  group_name: string;
  group_name_ar?: string;
  standings: GroupStandingRow[];
}

export interface TournamentStandings {
  tournament_id: number;
  standing_rules: string;
  standing_rules_label_en: string;
  standing_rules_label_ar: string;
  tiebreakers_en: string[];
  tiebreakers_ar: string[];
  qualifiers_per_group: number;
  groups: CupGroupStandings[];
}

export interface Prediction {
  id: number;
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

export interface DashboardPodiumEntry {
  rank: number;
  user_id: number;
  username: string;
  total_points: number;
  is_you: boolean;
}

export interface DashboardGroupSummary {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  rank: number | null;
  total_points: number;
  leader_points: number;
  podium: DashboardPodiumEntry[];
}

export interface Dashboard {
  groups: DashboardGroupSummary[];
  global_podium: DashboardPodiumEntry[];
  global_leader_points: number;
  upcoming_matches: Match[];
  live_matches: Match[];
  next_match: Match | null;
  pending_predictions: Match[];
  pending_count: number;
  recent_results: Match[];
  total_points: number;
  current_rank: number | null;
}

export interface NotificationGroupRank {
  group_id: number;
  group_name: string;
  rank: number | null;
  previous_rank: number | null;
}

export interface NotificationPodiumEntry {
  rank: number;
  user_id: number;
  username: string;
  total_points: number;
}

export interface MatchResultNotificationPayload {
  match_id: number;
  tournament_id: number;
  home_team: string;
  away_team: string;
  home_team_ar?: string;
  away_team_ar?: string;
  home_score: number;
  away_score: number;
  predicted_home_score: number;
  predicted_away_score: number;
  points_awarded: number;
  global_rank: number | null;
  previous_global_rank: number | null;
  groups: NotificationGroupRank[];
}

export interface GroupPodiumNotificationPayload {
  group_id: number;
  group_name: string;
  tournament_id: number;
  match_id: number;
  podium: NotificationPodiumEntry[];
}

export interface AppNotification {
  id: number;
  notification_type: "match_result" | "group_podium";
  payload: MatchResultNotificationPayload | GroupPodiumNotificationPayload;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  unread_count: number;
  results: AppNotification[];
}

export interface Tournament {
  id: number;
  name: string;
  name_ar?: string;
  year: number;
  start_date: string;
  end_date: string;
  standing_rules?: string;
  qualifiers_per_group?: number;
  is_active?: boolean;
  is_archived?: boolean;
  live_score_provider?: "manual" | "api_football" | "sportmonks";
  live_score_config?: { league_id?: number; season?: number; season_id?: number };
  stage_count?: number;
  match_count?: number;
  stages?: { id: number; name: string; name_ar?: string; order: number; stage_type: string }[];
  cup_groups?: CupGroup[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const AUTH_API_PREFIX = "/api/auth/";

async function handleSessionExpired(): Promise<never> {
  if (typeof window !== "undefined") {
    const { clearStoredTokens, emitSessionExpired } = await import("./session");
    const { loginUrlWithNext } = await import("./authRedirect");
    clearStoredTokens();
    emitSessionExpired();

    const authPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
    const current = window.location.pathname;
    const onAuthPage = authPaths.some((p) => current === p || current.startsWith(`${p}/`));
    if (!onAuthPage) {
      const next = window.location.pathname + window.location.search;
      window.location.assign(loginUrlWithNext(next));
      return new Promise(() => {}) as never;
    }
  }

  throw new ApiError(401, "Session expired");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  allowRefresh = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token && allowRefresh && !path.startsWith(AUTH_API_PREFIX)) {
    const { refreshAccessToken } = await import("./session");
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return request<T>(path, options, newAccess, false);
    }
    return handleSessionExpired();
  }

  if (res.status === 401 && token && !path.startsWith(AUTH_API_PREFIX)) {
    return handleSessionExpired();
  }

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

  requestPasswordReset: (email: string) =>
    request<{ detail: string }>("/api/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (data: { uid: string; token: string; new_password: string }) =>
    request<{ detail: string }>("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: (refresh: string) =>
    request<{ access: string; refresh?: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }, null, false),

  logout: (refresh: string, token: string) =>
    request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }, token),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  getGroups: (token: string) => request<Group[]>("/api/groups", {}, token),

  createGroup: (token: string, data: { name: string; description?: string }) =>
    request<Group>("/api/groups", { method: "POST", body: JSON.stringify(data) }, token),

  getGroupMembers: (token: string, groupId: number) =>
    request<GroupMember[]>(`/api/groups/${groupId}/members`, {}, token),

  getGroupPredictions: (token: string, groupId: number, tournamentId: number) =>
    request<GroupPredictionsResponse>(
      `/api/groups/${groupId}/predictions?tournament=${tournamentId}`,
      {},
      token
    ),

  joinGroup: (token: string, invite_code: string) =>
    request<Group>("/api/groups/join", {
      method: "POST",
      body: JSON.stringify({ invite_code }),
    }, token),

  leaveGroup: (token: string, groupId: number) =>
    request<void>(`/api/groups/${groupId}/leave`, { method: "POST" }, token),

  removeGroupMember: (token: string, groupId: number, memberId: number) =>
    request<void>(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" }, token),

  getTournaments: (token: string) =>
    request<{ results?: Tournament[] } | Tournament[]>("/api/tournaments", {}, token),

  getCupGroups: (token: string, tournamentId: number) =>
    request<CupGroup[]>(`/api/tournaments/${tournamentId}/cup-groups`, {}, token),

  getTournamentStandings: (token: string, tournamentId: number) =>
    request<TournamentStandings>(`/api/tournaments/${tournamentId}/standings`, {}, token),

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

  getPredictions: (token: string, params?: { tournament?: number; match?: number }) => {
    const qs = new URLSearchParams();
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    if (params?.match) qs.set("match", String(params.match));
    const query = qs.toString() ? `?${qs}` : "";
    return request<{ results?: Prediction[] } | Prediction[]>(`/api/predictions${query}`, {}, token);
  },

  createPrediction: (token: string, data: {
    match: number;
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_winner_team_id?: number | null;
  }) =>
    request<Prediction>("/api/predictions", { method: "POST", body: JSON.stringify(data) }, token),

  updatePrediction: (token: string, id: number, data: {
    match?: number;
    predicted_home_score: number;
    predicted_away_score: number;
    predicted_winner_team_id?: number | null;
  }) =>
    request<Prediction>(`/api/predictions/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  getGroupLeaderboard: (token: string, groupId: number, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<LeaderboardEntry[]>(`/api/leaderboards/group/${groupId}${qs}`, {}, token);
  },

  getGlobalLeaderboard: (token: string, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<LeaderboardEntry[]>(`/api/leaderboards/global${qs}`, {}, token);
  },

  getDashboard: (token: string, params?: { tournament?: number }) => {
    const qs = new URLSearchParams();
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
      name_ar?: string;
      year: number;
      start_date: string;
      end_date: string;
      standing_rules?: string;
      qualifiers_per_group?: number;
      is_active?: boolean;
      is_archived?: boolean;
      live_score_provider?: string;
      live_score_config?: Record<string, unknown>;
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
      name_ar: string;
      year: number;
      start_date: string;
      end_date: string;
      standing_rules: string;
      qualifiers_per_group: number;
      is_active: boolean;
      is_archived: boolean;
      live_score_provider: string;
      live_score_config: Record<string, unknown>;
    }>
  ) =>
    request<Tournament>(
      `/api/tournaments/admin/tournaments/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token
    ),

  adminSyncLiveScores: (token: string, tournamentId: number) =>
    request<{ tournament_id: number; updated: number; skipped: number }>(
      `/api/tournaments/admin/tournaments/${tournamentId}/sync-live-scores`,
      { method: "POST" },
      token
    ),

  adminDeleteTournament: (token: string, id: number) =>
    request(`/api/tournaments/admin/tournaments/${id}`, { method: "DELETE" }, token),

  adminGetStages: (token: string, tournament?: number) => {
    const qs = tournament ? `?tournament=${tournament}` : "";
    return request<
      {
        results?: {
          id: number;
          name: string;
          name_ar?: string;
          order: number;
          stage_type: string;
          tournament: number;
        }[];
      }
      | {
          id: number;
          name: string;
          name_ar?: string;
          order: number;
          stage_type: string;
          tournament: number;
        }[]
    >(`/api/tournaments/admin/stages${qs}`, {}, token);
  },

  adminCreateStage: (
    token: string,
    data: {
      tournament: number;
      name: string;
      name_ar?: string;
      order: number;
      stage_type: string;
    }
  ) =>
    request("/api/tournaments/admin/stages", { method: "POST", body: JSON.stringify(data) }, token),

  adminUpdateStage: (
    token: string,
    id: number,
    data: Partial<{
      name: string;
      name_ar: string;
      order: number;
      stage_type: string;
    }>
  ) =>
    request(`/api/tournaments/admin/stages/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  adminDeleteStage: (token: string, id: number) =>
    request(`/api/tournaments/admin/stages/${id}`, { method: "DELETE" }, token),

  adminGetTeams: (token: string) =>
    request<{ results?: Team[] } | Team[]>("/api/tournaments/teams", {}, token),

  adminCreateTeam: (
    token: string,
    data: { name: string; name_ar?: string; code: string; flag_url?: string }
  ) =>
    request<Team>("/api/tournaments/teams", { method: "POST", body: JSON.stringify(data) }, token),

  adminUpdateTeam: (
    token: string,
    id: number,
    data: Partial<{ name: string; name_ar: string; code: string; flag_url: string }>
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
    data: { tournament: number; name: string; name_ar?: string; team_ids?: number[] }
  ) =>
    request<CupGroup>(
      "/api/tournaments/admin/cup-groups",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  adminUpdateCupGroup: (
    token: string,
    id: number,
    data: Partial<{ tournament: number; name: string; name_ar: string; team_ids: number[] }>
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
      external_fixture_id?: string;
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

  adminGetUsers: (token: string) =>
    request<AdminUser[]>("/api/auth/admin/users", {}, token),

  adminGetGroups: (token: string) =>
    request<AdminGroup[] | { results: AdminGroup[] }>("/api/groups/admin/groups", {}, token),

  adminGetGroup: (token: string, id: number) =>
    request<AdminGroup>(`/api/groups/admin/groups/${id}`, {}, token),

  getNotifications: (token: string, params?: { limit?: number; unread?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.unread) search.set("unread", "1");
    const query = search.toString();
    return request<NotificationListResponse>(
      `/api/notifications${query ? `?${query}` : ""}`,
      {},
      token
    );
  },

  markNotificationRead: (token: string, id: number) =>
    request<AppNotification>(`/api/notifications/${id}/read`, { method: "POST" }, token),

  markAllNotificationsRead: (token: string) =>
    request<{ detail: string; updated: number }>(
      "/api/notifications/mark-all-read",
      { method: "POST" },
      token
    ),
};

export function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.results || [];
}
