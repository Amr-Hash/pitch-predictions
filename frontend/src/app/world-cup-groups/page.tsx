"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, CupGroup } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";

export default function WorldCupGroupsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { selectedTournament } = useTournament();
  const router = useRouter();
  const [cupGroups, setCupGroups] = useState<CupGroup[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !selectedTournament) return;
    api.getCupGroups(token, selectedTournament.id).then(setCupGroups);
  }, [token, selectedTournament]);

  if (authLoading || !user) return <div>Loading...</div>;
  if (!selectedTournament) return <div>Loading tournaments...</div>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Groups & Teams</h1>
      <p className="mb-6 text-gray-600">
        {selectedTournament.name} ({selectedTournament.year}) — {cupGroups.length} groups
      </p>

      {selectedTournament.name === "Demo Test Cup" ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Demo Test Cup</strong> — compact 2-group demo for testing matchday
          prediction locks before the full World Cup starts.
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-pitch-200 bg-pitch-50 p-4 text-sm text-pitch-900">
          <strong>Prediction rules:</strong> Matchday 1 games are open for predictions
          (until 1 hour before kickoff). Matchday 2 and 3 unlock after the previous
          matchday finishes.
        </div>
      )}

      {cupGroups.length === 0 ? (
        <EmptyState
          icon="🏟️"
          title="No groups configured"
          description="This tournament does not have group-stage teams set up yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cupGroups.map((group) => (
            <div key={group.id} className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-pitch-700">Group {group.name}</h2>
                <Link
                  href={`/matches?cup_group=${group.name}`}
                  className="text-xs font-medium text-pitch-600 hover:underline"
                >
                  View matches
                </Link>
              </div>
              <ul className="space-y-2">
                {group.group_teams.map(({ team }) => (
                  <li key={team.id} className="flex items-center gap-3">
                    {team.flag_url ? (
                      <img
                        src={team.flag_url}
                        alt=""
                        className="h-5 w-7 object-cover"
                      />
                    ) : (
                      <span className="inline-block h-5 w-7 bg-gray-200" />
                    )}
                    <span className="font-medium">{team.name}</span>
                    <span className="text-xs text-gray-400">{team.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
