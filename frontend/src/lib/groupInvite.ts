export function groupJoinPath(inviteCode: string): string {
  const code = inviteCode.trim().toUpperCase();
  return `/groups/join?code=${encodeURIComponent(code)}`;
}

export function groupInviteUrl(inviteCode: string, origin?: string): string {
  const path = groupJoinPath(inviteCode);
  if (origin) return `${origin}${path}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}
