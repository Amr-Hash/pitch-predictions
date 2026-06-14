import type { MessageKey } from "@/lib/messages";

export type GroupIconId =
  | "friends"
  | "family"
  | "coworkers"
  | "neighbors"
  | "university"
  | "school"
  | "club_friends"
  | "cafe_friends"
  | "best_friends"
  | "others";

export const GROUP_ICONS: {
  id: GroupIconId;
  emoji: string;
  labelKey: MessageKey;
}[] = [
  { id: "friends", emoji: "🤝", labelKey: "challengeFriends" },
  { id: "family", emoji: "👨‍👩‍👧‍👦", labelKey: "challengeFamily" },
  { id: "coworkers", emoji: "💼", labelKey: "challengeCoworkers" },
  { id: "neighbors", emoji: "🏘️", labelKey: "challengeNeighbors" },
  { id: "university", emoji: "🎓", labelKey: "groupIconUniversity" },
  { id: "school", emoji: "🏫", labelKey: "groupIconSchool" },
  { id: "club_friends", emoji: "👥", labelKey: "groupIconClubFriends" },
  { id: "cafe_friends", emoji: "☕", labelKey: "groupIconCafeFriends" },
  { id: "best_friends", emoji: "💛", labelKey: "groupIconBestFriends" },
  { id: "others", emoji: "✨", labelKey: "groupIconOthers" },
];

export const DEFAULT_GROUP_ICON: GroupIconId = "club_friends";

export function groupIconEmoji(icon: GroupIconId | string | null | undefined): string {
  const match = GROUP_ICONS.find((item) => item.id === icon);
  return match?.emoji ?? GROUP_ICONS.find((item) => item.id === DEFAULT_GROUP_ICON)!.emoji;
}

export function isGroupIconId(value: string): value is GroupIconId {
  return GROUP_ICONS.some((item) => item.id === value);
}
