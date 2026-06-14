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
  last_login: string | null;
  last_seen_at: string | null;
}

export interface AdminUserActivitySummary {
  total_fans: number;
  active_last_24h: number;
  active_last_7d: number;
  active_24h_pct: number;
  active_7d_pct: number;
  never_seen: number;
  inactive_over_7d: number;
  as_of: string;
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
  team_type?: "national" | "club";
  country_code?: string;
  continent?: string;
  division?: string;
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
  qualification_via?: "group" | "best_third" | null;
}

export interface ThirdPlaceStandingRow {
  rank_among_thirds: number;
  qualifies: boolean;
  group_id: number;
  group_name: string;
  group_name_ar?: string;
  team: Team;
  points: number;
  goal_difference: number;
  goals_for: number;
}

export interface CupGroupStandings {
  group_id: number;
  group_name: string;
  group_name_ar?: string;
  standings: GroupStandingRow[];
}

export interface StandingRuleSetSummary {
  id: number;
  slug: string;
  name: string;
  name_ar?: string;
  competition_type: "world_cup" | "champions_league" | "other";
  version: string;
  engine: "fifa_world_cup" | "uefa_champions_league" | "simple";
  qualifiers_per_group: number;
  best_third_place_qualifiers: number;
  is_active: boolean;
}

export interface StandingRuleSet extends StandingRuleSetSummary {
  tiebreakers_en?: string[];
  tiebreakers_ar?: string[];
  third_place_tiebreakers_en?: string[];
  third_place_tiebreakers_ar?: string[];
  tournament_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentStandings {
  tournament_id: number;
  standing_rules: string;
  standing_rule_set_id?: number | null;
  standing_rule_set_slug?: string | null;
  standing_rules_version?: string | null;
  competition_type?: string | null;
  standing_rules_label_en: string;
  standing_rules_label_ar: string;
  tiebreakers_en: string[];
  tiebreakers_ar: string[];
  third_place_tiebreakers_en?: string[];
  third_place_tiebreakers_ar?: string[];
  qualifiers_per_group: number;
  best_third_place_qualifiers?: number;
  third_place_ranking?: ThirdPlaceStandingRow[];
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

export interface MatchKickoffReminderPayload {
  match_id: number;
  tournament_id: number;
  home_team: string;
  away_team: string;
  home_team_ar?: string;
  away_team_ar?: string;
  kickoff_time: string;
  has_prediction: boolean;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_winner_team_id: number | null;
  predicted_winner_name: string;
  predicted_winner_name_ar?: string;
}

export interface AppNotification {
  id: number;
  notification_type: "match_result" | "group_podium" | "match_kickoff_reminder";
  payload:
    | MatchResultNotificationPayload
    | GroupPodiumNotificationPayload
    | MatchKickoffReminderPayload;
  is_read: boolean;
  created_at: string;
}

export interface PushVapidPublicKeyResponse {
  public_key: string;
  configured: boolean;
}

export interface NotificationListResponse {
  unread_count: number;
  results: AppNotification[];
}

export interface LiveScoreEnvironment {
  cron_secret_configured: boolean;
  sync_window_open: boolean;
  sync_window_start: string | null;
  sync_window_end: string | null;
  cron_schedule: string;
  football_data_api_configured: boolean;
  default_competition_code: string;
}

export interface LiveScoreMatchStats {
  total: number;
  scheduled: number;
  live: number;
  finished: number;
  in_sync_window: number;
}

export interface TournamentLiveScoreStatus {
  tournament_id: number;
  tournament_name: string;
  tournament_name_ar?: string;
  year: number;
  is_active: boolean;
  is_archived: boolean;
  live_score_provider: "manual" | "football_data";
  live_score_config: { competition_code?: string; season?: number };
  competition_code?: string | null;
  health: "ready" | "warning" | "error" | "manual";
  issues: string[];
  matches: LiveScoreMatchStats;
}

export interface LiveScoreOverview {
  environment: LiveScoreEnvironment;
  summary: {
    tournament_count: number;
    auto_sync_tournament_count: number;
    ready_count: number;
    warning_count: number;
    error_count: number;
  };
  tournaments: TournamentLiveScoreStatus[];
}

export interface LiveScoreTournamentStatusResponse {
  environment: LiveScoreEnvironment;
  tournament: TournamentLiveScoreStatus;
}

export interface LiveScoreSyncResult {
  tournament_id: number;
  updated: number;
  skipped: number;
  error?: string;
}

export interface Tournament {
  id: number;
  name: string;
  name_ar?: string;
  competition_type?: "world_cup" | "champions_league" | "other";
  allowed_team_type?: "national" | "club" | "any";
  team_scope?: "worldwide" | "continent" | "country" | "division";
  allowed_continent?: string;
  allowed_country_code?: string;
  allowed_division?: string;
  year: number;
  start_date: string;
  end_date: string;
  standing_rules?: string;
  standing_rule_set?: StandingRuleSetSummary | null;
  qualifiers_per_group?: number;
  is_active?: boolean;
  is_archived?: boolean;
  live_score_provider?: "manual" | "football_data";
  live_score_config?: { competition_code?: string; season?: number };
  stage_count?: number;
  match_count?: number;
  is_subscribed?: boolean;
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
    const contentType = res.headers.get("content-type") ?? "";
    const body =
      contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};
    const message =
      body.detail ||
      body.non_field_errors?.[0] ||
      (Object.keys(body).length > 0 ? JSON.stringify(body) : null) ||
      (res.status >= 500 ? `Server error (${res.status})` : null) ||
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

  getAvailableTournaments: (token: string) =>
    request<Tournament[]>("/api/tournaments/available", {}, token),

  subscribeTournament: (token: string, tournamentId: number) =>
    request<Tournament>(
      `/api/tournaments/${tournamentId}/subscribe`,
      { method: "POST" },
      token
    ),

  unsubscribeTournament: (token: string, tournamentId: number) =>
    request<void>(`/api/tournaments/${tournamentId}/unsubscribe`, { method: "POST" }, token),

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

  getMatch: (token: string, id: number) =>
    request<Match>(`/api/tournaments/matches/${id}`, {}, token),

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

  getPendingCount: (token: string, params?: { tournament?: number }) => {
    const qs = new URLSearchParams();
    if (params?.tournament) qs.set("tournament", String(params.tournament));
    const query = qs.toString() ? `?${qs}` : "";
    return request<{ pending_count: number }>(`/api/dashboard/pending-count${query}`, {}, token);
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

  adminGetStandingRuleSets: (
    token: string,
    params?: { active?: boolean; competition_type?: string }
  ) => {
    const search = new URLSearchParams();
    if (params?.active) search.set("active", "1");
    if (params?.competition_type) search.set("competition_type", params.competition_type);
    const qs = search.toString();
    return request<StandingRuleSet[] | { results: StandingRuleSet[] }>(
      `/api/tournaments/admin/standing-rule-sets${qs ? `?${qs}` : ""}`,
      {},
      token
    );
  },

  adminCreateStandingRuleSet: (
    token: string,
    data: {
      slug: string;
      name: string;
      name_ar?: string;
      competition_type: string;
      version: string;
      engine: string;
      qualifiers_per_group?: number;
      best_third_place_qualifiers?: number;
      is_active?: boolean;
    }
  ) =>
    request<StandingRuleSet>(
      "/api/tournaments/admin/standing-rule-sets",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  adminUpdateStandingRuleSet: (
    token: string,
    id: number,
    data: Partial<{
      slug: string;
      name: string;
      name_ar: string;
      competition_type: string;
      version: string;
      engine: string;
      qualifiers_per_group: number;
      best_third_place_qualifiers: number;
      is_active: boolean;
    }>
  ) =>
    request<StandingRuleSet>(
      `/api/tournaments/admin/standing-rule-sets/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token
    ),

  adminCreateTournament: (
    token: string,
    data: {
      name: string;
      name_ar?: string;
      year: number;
      start_date: string;
      end_date: string;
      standing_rule_set?: number;
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
      standing_rule_set: number | null;
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
    request<LiveScoreSyncResult>(
      `/api/tournaments/admin/tournaments/${tournamentId}/sync-live-scores`,
      { method: "POST" },
      token
    ),

  adminGetLiveScoreOverview: (token: string) =>
    request<LiveScoreOverview>(
      "/api/tournaments/admin/tournaments/live-score-overview",
      {},
      token
    ),

  adminGetTournamentLiveScoreStatus: (token: string, tournamentId: number) =>
    request<LiveScoreTournamentStatusResponse>(
      `/api/tournaments/admin/tournaments/${tournamentId}/live-score-status`,
      {},
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

  adminGetTeams: (token: string, params?: { tournament?: number }) => {
    const qs = params?.tournament ? `?tournament=${params.tournament}` : "";
    return request<{ results?: Team[] } | Team[]>(
      `/api/tournaments/teams${qs}`,
      {},
      token
    );
  },

  adminCreateTeam: (
    token: string,
    data: {
      name: string;
      name_ar?: string;
      code: string;
      flag_url?: string;
      team_type?: string;
      country_code?: string;
      continent?: string;
      division?: string;
    }
  ) =>
    request<Team>("/api/tournaments/teams", { method: "POST", body: JSON.stringify(data) }, token),

  adminUpdateTeam: (
    token: string,
    id: number,
    data: Partial<{
      name: string;
      name_ar: string;
      code: string;
      flag_url: string;
      team_type: string;
      country_code: string;
      continent: string;
      division: string;
    }>
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

  adminGetUsers: (token: string, activity?: "24h" | "7d" | "inactive" | "never") => {
    const query = activity ? `?activity=${activity}` : "";
    return request<AdminUser[]>(`/api/auth/admin/users${query}`, {}, token);
  },

  adminGetUserActivity: (token: string) =>
    request<AdminUserActivitySummary>("/api/auth/admin/user-activity", {}, token),

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

  getPushVapidPublicKey: () =>
    request<PushVapidPublicKeyResponse>("/api/notifications/push/vapid-public-key"),

  subscribePush: (
    token: string,
    body: { endpoint: string; p256dh: string; auth: string }
  ) =>
    request<{ detail: string; id: number }>(
      "/api/notifications/push/subscribe",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  unsubscribePush: (token: string, endpoint: string) =>
    request<{ detail: string }>(
      "/api/notifications/push/unsubscribe",
      { method: "POST", body: JSON.stringify({ endpoint }) },
      token
    ),
};

export function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.results || [];
}
