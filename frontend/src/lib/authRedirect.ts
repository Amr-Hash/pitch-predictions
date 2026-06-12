import type { User } from "./api";
import { staffHomePath } from "./staff";

/** Only allow same-origin relative paths (no protocol-relative or external URLs). */
export function sanitizeRedirectPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function postAuthRedirect(user: User, next: string | null | undefined): string {
  const safe = sanitizeRedirectPath(next);
  if (safe) return safe;
  return staffHomePath(user);
}

export function loginUrlWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function registerUrlWithNext(next: string): string {
  return `/register?next=${encodeURIComponent(next)}`;
}

export function authLinkWithNext(base: "/login" | "/register", next: string | null): string {
  const safe = sanitizeRedirectPath(next);
  if (!safe) return base;
  return `${base}?next=${encodeURIComponent(safe)}`;
}
