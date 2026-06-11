"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Match, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MatchCard } from "@/components/MatchCard";

function MatchesContent() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cupGroupFilter = searchParams.get("cup_group") || "";
  const matchdayFilter = searchParams.get("matchday") || "";

  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    const params: { cup_group?: string; matchday?: number } = {};
    if (cupGroupFilter) params.cup_group = cupGroupFilter;
    if (matchdayFilter) params.matchday = Number(matchdayFilter);
    api.getMatches(token, params).then((data) => setMatches(unwrapList(data)));
  }, [token, cupGroupFilter, matchdayFilter]);

  const grouped = useMemo(() => {
    const byDay: Record<number, Match[]> = { 1: [], 2: [], 3: [] };
    for (const m of matches) {
      const day = m.matchday || 0;
      if (day >= 1 && day <= 3) byDay[day].push(m);
    }
    return byDay;
  }, [matches]);

  if (authLoading || !user) return <div>Loading...</div>;

  const showGrouped = !matchdayFilter && matches.some((m) => m.matchday);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Matches</h1>
      <p className="mb-4 text-gray-600">
        FIFA World Cup 2026 group stage — 72 fixtures
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterLink href="/matches" active={!cupGroupFilter && !matchdayFilter}>
          All
        </FilterLink>
        {[1, 2, 3].map((day) => (
          <FilterLink
            key={day}
            href={`/matches?matchday=${day}${cupGroupFilter ? `&cup_group=${cupGroupFilter}` : ""}`}
            active={matchdayFilter === String(day)}
          >
            Matchday {day}
          </FilterLink>
        ))}
        {cupGroupFilter && (
          <span className="rounded-full bg-pitch-100 px-3 py-1 text-sm text-pitch-800">
            Group {cupGroupFilter}
          </span>
        )}
      </div>

      {showGrouped ? (
        [1, 2, 3].map((day) =>
          grouped[day].length > 0 ? (
            <section key={day} className="mb-10">
              <h2 className="mb-4 text-xl font-semibold">
                Matchday {day}
                {day > 1 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    — predictions unlock after Matchday {day - 1} completes
                  </span>
                )}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[day].map((m) => (
                  <MatchCard key={m.id} match={m} showPredictLink showResultLink />
                ))}
              </div>
            </section>
          ) : null
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} showPredictLink showResultLink />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm font-medium ${
        active
          ? "bg-pitch-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </Link>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MatchesContent />
    </Suspense>
  );
}
