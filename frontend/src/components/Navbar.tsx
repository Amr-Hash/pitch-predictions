"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAME, APP_NAME_LATIN } from "@/lib/brand";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AdminNavbar } from "@/components/AdminNavbar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TournamentSwitcher } from "@/components/TournamentSwitcher";
import { isStaff, isStaffAllowedPath } from "@/lib/staff";
import { useTournament } from "@/lib/tournament";
import { useT } from "@/lib/i18n";

function navLinkClass(active: boolean) {
  return `text-sm font-medium transition ${
    active ? "text-pitch-700" : "text-gray-600 hover:text-pitch-600"
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
      .getDashboard(token, { tournament: selectedTournament.id })
      .then((data) => setPendingCount(data.pending_count ?? data.pending_predictions.length))
      .catch(() => setPendingCount(0));
  }, [token, selectedTournament, pathname]);

  if (showAdminNav) {
    return <AdminNavbar />;
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-xl font-bold text-pitch-700">
          <span>⚽</span>
          <span>{APP_NAME}</span>
          <span className="hidden text-sm font-normal text-gray-400 sm:inline">{APP_NAME_LATIN}</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
          <LanguageToggle />
          {!loading && user ? (
            <>
              <TournamentSwitcher />
              <Link href="/dashboard" className={navLinkClass(pathname === "/dashboard")}>
                {t("home")}
              </Link>
              <Link href="/matches" className={`relative ${navLinkClass(pathname.startsWith("/matches"))}`}>
                {t("matches")}
                {pendingCount > 0 && (
                  <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-pitch-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {pendingCount > 9 ? "9+" : pendingCount}
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
              <span className="text-sm text-gray-500">{user.username}</span>
              <button onClick={logout} className="btn-secondary text-sm">
                {t("logout")}
              </button>
            </>
          ) : !loading ? (
            <>
              <Link href="/login" className="btn-secondary text-sm">
                {t("login")}
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                {t("register")}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
