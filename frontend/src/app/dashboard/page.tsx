"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { MatchCard } from "@/components/MatchCard";

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { selectedTournament } = useTournament();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    api.getDashboard(token, { tournament: selectedTournament.id })
      .then(setDashboard)
      .catch((e) => setError(e.message));
  }, [token, selectedTournament]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon="⚠️"
          title="Could not load dashboard"
          description={error || "Something went wrong. Please try again in a moment."}
          action={{ label: "Refresh page", href: "/dashboard" }}
        />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  const hasGroups = dashboard.groups.length > 0;
  const hasPending = dashboard.pending_predictions.length > 0;
  const hasUpcoming = dashboard.upcoming_matches.length > 0;
  const hasResults = dashboard.recent_results.length > 0;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">
        Welcome back, {user.username}
      </h1>
      <p className="mb-6 text-gray-600">
        {selectedTournament
          ? `Overview for ${selectedTournament.name} (${selectedTournament.year}). Use the tournament menu in the navbar to switch competitions.`
          : "Track your predictions, points, and upcoming matches."}
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card bg-pitch-50">
          <p className="text-sm text-gray-600">Total Points</p>
          <p className="text-3xl font-bold text-pitch-700">
            {dashboard.total_points}
          </p>
          {dashboard.total_points === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Earn points with correct predictions
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Global Rank</p>
          <p className="text-3xl font-bold">
            {dashboard.current_rank ?? "—"}
          </p>
          {dashboard.current_rank == null && (
            <p className="mt-1 text-xs text-gray-500">No ranked scores yet</p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Your Groups</p>
          <p className="text-3xl font-bold">{dashboard.groups.length}</p>
          {!hasGroups && (
            <p className="mt-1 text-xs text-gray-500">Join or create a group</p>
          )}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Pending Predictions</h2>
        {hasPending ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboard.pending_predictions.map((m) => (
              <MatchCard key={m.id} match={m} showPredictLink />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="✅"
            title="All caught up"
            description={
              hasGroups
                ? "You have no open predictions right now. Check back when new matchdays unlock or browse upcoming fixtures."
                : "Join a prediction group first, then submit picks for upcoming matches."
            }
            action={
              hasGroups
                ? { label: "Browse matches", href: "/matches" }
                : { label: "Join a group", href: "/groups" }
            }
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Upcoming Matches</h2>
        {hasUpcoming ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboard.upcoming_matches.map((m) => (
              <MatchCard key={m.id} match={m} showPredictLink />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📅"
            title="No upcoming matches"
            description="Scheduled fixtures will appear here. Try the Demo Test Cup for a quick matchday demo."
            action={{ label: "View matches", href: "/matches" }}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Recent Results</h2>
        {hasResults ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboard.recent_results.map((m) => (
              <MatchCard key={m.id} match={m} showResultLink />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🏁"
            title="No results yet"
            description="Finished matches and your awarded points will show up here once games are played and scored."
          />
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Groups</h2>
          <Link href="/groups" className="btn-primary text-sm">
            Manage Groups
          </Link>
        </div>
        {hasGroups ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.groups.map((g) => (
              <div key={g.id} className="card">
                <h3 className="font-semibold">{g.name}</h3>
                <p className="mt-1 text-sm text-gray-500">Code: {g.invite_code}</p>
                <Link
                  href={`/leaderboards?group=${g.id}`}
                  className="mt-3 inline-block text-sm text-pitch-600 hover:underline"
                >
                  View Leaderboard →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="👥"
            title="No groups yet"
            description="Create a private league with friends or join one with an invite code to start competing."
            action={{ label: "Create or join a group", href: "/groups" }}
          />
        )}
      </section>
    </div>
  );
}
