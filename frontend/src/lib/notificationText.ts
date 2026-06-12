import type {
  AppNotification,
  GroupPodiumNotificationPayload,
  MatchResultNotificationPayload,
} from "@/lib/api";
import type { Locale } from "@/lib/messages";
import { messages, type MessageKey } from "@/lib/messages";

const PODIUM_MEDALS = ["🥇", "🥈", "🥉"] as const;

function teamName(payload: MatchResultNotificationPayload, side: "home" | "away", locale: Locale) {
  if (locale === "ar") {
    if (side === "home" && payload.home_team_ar) return payload.home_team_ar;
    if (side === "away" && payload.away_team_ar) return payload.away_team_ar;
  }
  return side === "home" ? payload.home_team : payload.away_team;
}

function rankChangeText(
  rank: number | null | undefined,
  previous: number | null | undefined,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
) {
  if (rank == null) return "";
  if (previous == null) return t("rankNew");
  const delta = previous - rank;
  if (delta > 0) return t("rankUp", { delta });
  if (delta < 0) return t("rankDown", { delta: Math.abs(delta) });
  return t("rankSame");
}

function formatMatchResult(
  payload: MatchResultNotificationPayload,
  locale: Locale,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
) {
  const home = teamName(payload, "home", locale);
  const away = teamName(payload, "away", locale);
  const score = `${payload.home_score}-${payload.away_score}`;
  const pick = `${payload.predicted_home_score}-${payload.predicted_away_score}`;
  let text = t("notificationMatchResult", {
    home,
    away,
    score,
    pick,
    points: payload.points_awarded,
    rank: payload.global_rank ?? "—",
    rankChange: rankChangeText(payload.global_rank, payload.previous_global_rank, t),
  });
  for (const group of payload.groups ?? []) {
    text += t("notificationMatchResultGroup", {
      group: group.group_name,
      groupRank: group.rank ?? "—",
      groupRankChange: rankChangeText(group.rank, group.previous_rank, t),
    });
  }
  return text;
}

function formatGroupPodium(
  payload: GroupPodiumNotificationPayload,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
) {
  const byRank = new Map<number, string[]>();
  for (const entry of payload.podium ?? []) {
    if (entry.rank < 1 || entry.rank > 3) continue;
    const list = byRank.get(entry.rank) ?? [];
    list.push(entry.username);
    byRank.set(entry.rank, list);
  }

  const parts: string[] = [];
  for (const rank of [1, 2, 3]) {
    const names = byRank.get(rank);
    if (!names?.length) continue;
    parts.push(`${PODIUM_MEDALS[rank - 1]} ${names.join(", ")}`);
  }

  return t("notificationPodium", { group: payload.group_name, podium: parts.join(" · ") });
}

export function formatNotificationText(
  notification: AppNotification,
  locale: Locale
): string {
  const t = (key: MessageKey, vars?: Record<string, string | number>) => {
    let text: string = messages[locale][key];
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };

  if (notification.notification_type === "match_result") {
    return formatMatchResult(notification.payload as MatchResultNotificationPayload, locale, t);
  }
  return formatGroupPodium(notification.payload as GroupPodiumNotificationPayload, t);
}
