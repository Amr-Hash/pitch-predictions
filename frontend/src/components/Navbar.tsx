"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { TournamentSelect } from "@/components/TournamentSelect";

export function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-pitch-700">
          <span>⚽</span> World Cup Predictions
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          {!loading && user ? (
            <>
              <TournamentSelect />
              <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                Dashboard
              </Link>
              <Link href="/groups" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                Groups
              </Link>
              <Link href="/world-cup-groups" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                Groups & Teams
              </Link>
              <Link href="/matches" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                Matches
              </Link>
              <Link href="/leaderboards" className="text-sm font-medium text-gray-600 hover:text-pitch-600">
                Leaderboards
              </Link>
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
