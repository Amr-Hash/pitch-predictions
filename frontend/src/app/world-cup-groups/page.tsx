"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, CupGroup, Tournament, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function WorldCupGroupsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [cupGroups, setCupGroups] = useState<CupGroup[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.getTournaments(token).then((data) => {
      const list = unwrapList(data);
      const wc = list.find((t) => t.year === 2026) || list[0];
      if (!wc) return;
      setTournament(wc);
      return api.getCupGroups(token, wc.id).then(setCupGroups);
    });
  }, [token]);

  if (authLoading || !user) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">World Cup 2026 Groups</h1>
      <p className="mb-6 text-gray-600">
        {tournament
          ? `${tournament.name} — 12 groups, 48 teams`
          : "Loading tournament..."}
      </p>

      <div className="mb-6 rounded-lg border border-pitch-200 bg-pitch-50 p-4 text-sm text-pitch-900">
        <strong>Prediction rules:</strong> Matchday 1 games are open for predictions
        (until 1 hour before kickoff). Matchday 2 and 3 fixtures are visible now but
        predictions unlock only after all Matchday 1 games finish.
      </div>

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
    </div>
  );
}
