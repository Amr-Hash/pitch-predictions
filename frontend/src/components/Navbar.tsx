"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME, APP_NAME_LATIN } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { AdminNavbar } from "@/components/AdminNavbar";
import { isStaffAllowedPath, isStaffSession } from "@/lib/staff";
import { useTournament } from "@/lib/tournament";

export function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTournament, clearSelectedTournament } = useTournament();

  const staffSession = isStaffSession(user, loading);

  useEffect(() => {
    if (!loading && staffSession && !isStaffAllowedPath(pathname)) {
      router.replace("/admin");
    }
  }, [loading, staffSession, pathname, router]);

  if (staffSession) {
    return <AdminNavbar />;
  }

  const showAppNav = Boolean(user && selectedTournament);

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-pitch-700">
          <span>⚽</span>
          <span>{APP_NAME}</span>
          <span className="hidden text-sm font-normal text-gray-400 sm:inline">{APP_NAME_LATIN}</span>
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          {!loading && user ? (
            <>
              {showAppNav ? (
                <>
                  <Link
                    href="/"
                    onClick={clearSelectedTournament}
                    className="text-sm font-medium text-pitch-600 hover:underline"
                  >
                    ← Change tournament
                  </Link>
                  <span className="hidden rounded-full bg-pitch-50 px-2 py-0.5 text-xs font-medium text-pitch-800 sm:inline">
                    {selectedTournament!.name} {selectedTournament!.year}
                  </span>
                  <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                    Dashboard
                  </Link>
                  <Link href="/groups" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                    Groups
                  </Link>
                  <Link href="/tournament-groups" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                    Groups & Teams
                  </Link>
                  <Link href="/matches" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                    Matches
                  </Link>
                  <Link href="/leaderboards" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                    Leaderboards
                  </Link>
                </>
              ) : (
                <span className="text-sm text-gray-500">Select a tournament on the home page</span>
              )}
              <span className="text-sm text-gray-500">{user.username}</span>
              <button onClick={logout} className="btn-secondary text-sm">
                Logout
              </button>
            </>
          ) : !loading ? (
            <>
              <Link href="/login" className="btn-secondary text-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Register
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
