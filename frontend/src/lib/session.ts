import Cookies from "js-cookie";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const REMEMBER_COOKIE = "remember_me";
const LAST_EMAIL_KEY = "alhabeed_last_email";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined"
      ? ""
      : process.env.BACKEND_URL || "http://localhost:8000";

const REMEMBER_REFRESH_DAYS = 90;
const SHORT_REFRESH_DAYS = 7;
const ACCESS_COOKIE_DAYS = 1;

type TokenListener = (access: string) => void;
type SessionExpiredListener = () => void;

let tokenListener: TokenListener | null = null;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function onSessionTokenRefreshed(listener: TokenListener | null) {
  tokenListener = listener;
}

export function onSessionExpired(listener: SessionExpiredListener | null) {
  sessionExpiredListener = listener;
}

export function emitSessionExpired() {
  sessionExpiredListener?.();
}

function cookieBaseOptions() {
  return {
    sameSite: "lax" as const,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  };
}

export function getStoredEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_EMAIL_KEY) || "";
}

export function storeEmail(email: string) {
  localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
}

export function isRememberMe(): boolean {
  return Cookies.get(REMEMBER_COOKIE) !== "0";
}

export function storeTokens(access: string, refresh: string, rememberMe = true) {
  const refreshDays = rememberMe ? REMEMBER_REFRESH_DAYS : SHORT_REFRESH_DAYS;
  const base = cookieBaseOptions();
  Cookies.set(ACCESS_COOKIE, access, { ...base, expires: ACCESS_COOKIE_DAYS });
  Cookies.set(REFRESH_COOKIE, refresh, { ...base, expires: refreshDays });
  Cookies.set(REMEMBER_COOKIE, rememberMe ? "1" : "0", { ...base, expires: refreshDays });
}

export function clearStoredTokens() {
  Cookies.remove(ACCESS_COOKIE);
  Cookies.remove(REFRESH_COOKIE);
  Cookies.remove(REMEMBER_COOKIE);
}

export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_COOKIE);
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_COOKIE);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    clearStoredTokens();
    return null;
  }

  const body = (await res.json()) as { access: string; refresh?: string };
  storeTokens(body.access, body.refresh ?? refresh, isRememberMe());
  tokenListener?.(body.access);
  return body.access;
}
