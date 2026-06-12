import type { User } from "./api";

const STAFF_CACHE_KEY = "alhabeed_is_staff";

export function isStaff(user: User | null | undefined): boolean {
  return Boolean(user?.is_staff);
}

export function cacheStaffStatus(user: User | null | undefined): void {
  if (typeof window === "undefined") return;
  if (user) {
    sessionStorage.setItem(STAFF_CACHE_KEY, user.is_staff ? "1" : "0");
  } else {
    sessionStorage.removeItem(STAFF_CACHE_KEY);
  }
}

export function getCachedStaffStatus(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STAFF_CACHE_KEY) === "1";
}

export function clearStaffCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STAFF_CACHE_KEY);
}

export function isStaffSession(user: User | null | undefined, authLoading: boolean): boolean {
  if (authLoading || !user) return false;
  return isStaff(user);
}

export function staffHomePath(user: User | null | undefined): string {
  return isStaff(user) ? "/admin" : "/dashboard";
}

export function isStaffAllowedPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/admin");
}

export function clearUserSessionData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("selected_tournament_id");
  clearStaffCache();
}
