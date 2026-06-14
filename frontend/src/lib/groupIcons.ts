import type { MessageKey } from "@/lib/messages";

export type GroupIconId = "university" | "school" | "club_friends";

export const GROUP_ICONS: {
  id: GroupIconId;
  emoji: string;
  labelKey: MessageKey;
}[] = [
  { id: "university", emoji: "🎓", labelKey: "groupIconUniversity" },
  { id: "school", emoji: "🏫", labelKey: "groupIconSchool" },
  { id: "club_friends", emoji: "👥", labelKey: "groupIconClubFriends" },
];

export const DEFAULT_GROUP_ICON: GroupIconId = "club_friends";

export function groupIconEmoji(icon: GroupIconId | string | null | undefined): string {
  const match = GROUP_ICONS.find((item) => item.id === icon);
  return match?.emoji ?? GROUP_ICONS.find((item) => item.id === DEFAULT_GROUP_ICON)!.emoji;
}

export function isGroupIconId(value: string): value is GroupIconId {
  return GROUP_ICONS.some((item) => item.id === value);
}
