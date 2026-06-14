"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAME, APP_NAME_LATIN } from "@/lib/brand";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AdminNavbar } from "@/components/AdminNavbar";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TournamentSwitcher } from "@/components/TournamentSwitcher";
import { isStaff, isStaffAllowedPath } from "@/lib/staff";
import { formatBadgeCount } from "@/lib/format";
import { useTournament } from "@/lib/tournament";
import { useT } from "@/lib/i18n";

function navLinkClass(active: boolean) {
  return `relative text-sm font-semibold transition ${
    active
      ? "text-gold-400 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-gold-400"
      : "text-white/85 hover:text-white"
  }`;
}

export function Navbar() {
  const { user, token, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTournament } = useTournament();
  const t = useT();
  const [pendingCount, setPendingCount] = useState(0);

  const showAdminNav =
    !loading && Boolean(user && isStaff(user) && pathname.startsWith("/admin"));

  useEffect(() => {
    if (!loading && user && isStaff(user) && !isStaffAllowedPath(pathname)) {
      router.replace("/admin");
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    if (!token || !selectedTournament) {
      setPendingCount(0);
      return;
    }
    api
      .getPendingCount(token, { tournament: selectedTournament.id })
      .then((data) => setPendingCount(data.pending_count))
      .catch(() => setPendingCount(0));
  }, [token, selectedTournament]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (showAdminNav) {
    return <AdminNavbar />;
  }

  return (
    <header className="sticky top-0 z-50 shadow-lg">
      <nav className="bg-night-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 text-xl font-extrabold text-white"
          >
            <Logo size={36} className="rounded-full shadow-md ring-1 ring-white/10" priority />
            <span>{APP_NAME}</span>
            <span className="hidden text-sm font-medium text-white/50 sm:inline">{APP_NAME_LATIN}</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <LanguageToggle variant="dark" />
            {!loading && user ? (
              <>
                <div className="hidden md:contents">
                  <TournamentSwitcher variant="dark" />
                  <Link href="/dashboard" className={navLinkClass(pathname === "/dashboard")}>
                    {t("home")}
                  </Link>
                  <Link
                    href="/matches"
                    className={`${navLinkClass(pathname.startsWith("/matches"))} inline-flex items-center gap-1`}
                  >
                    {t("matches")}
                    {pendingCount > 0 && (
                      <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-gold-500 px-1.5 py-0.5 text-xs font-bold tabular-nums text-night-900 shadow">
                        {formatBadgeCount(pendingCount)}
                      </span>
                    )}
                  </Link>
                  <Link href="/groups" className={navLinkClass(pathname.startsWith("/groups"))}>
                    {t("myGroups")}
                  </Link>
                  <Link
                    href="/tournament-groups"
                    className={navLinkClass(pathname.startsWith("/tournament-groups"))}
                  >
                    {t("standings")}
                  </Link>
                  <Link href="/scoring" className={navLinkClass(pathname === "/scoring")}>
                    {t("scoringNav")}
                  </Link>
                </div>
                <div className="md:hidden">
                  <TournamentSwitcher variant="dark" />
                </div>
                <NotificationBell />
                <span className="hidden text-sm text-white/60 lg:inline">{user.username}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-ghost-nav inline-flex shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
                  aria-label={t("logout")}
                >
                  {t("logout")}
                </button>
              </>
            ) : !loading ? (
              <>
                <Link href="/scoring" className={navLinkClass(pathname === "/scoring")}>
                  {t("scoringNav")}
                </Link>
                <Link href="/login" className="btn-ghost-nav">
                  {t("login")}
                </Link>
                <Link href="/register" className="btn-fan text-sm">
                  {t("register")}
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </nav>
      <div className="nav-stripe" aria-hidden />
    </header>
  );
}
