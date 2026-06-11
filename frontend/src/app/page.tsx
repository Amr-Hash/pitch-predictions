"use client";

import Link from "next/link";
import { APP_NAME, APP_NAME_LATIN, APP_TAGLINE, APP_TAGLINE_EN } from "@/lib/brand";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-8 text-6xl">⚽</div>
      <h1 className="mb-2 text-4xl font-bold text-pitch-900 sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mb-1 text-lg text-gray-500">{APP_NAME_LATIN}</p>
      <p className="mb-8 max-w-2xl text-lg text-gray-600">
        {APP_TAGLINE}
      </p>
      <p className="mb-8 max-w-2xl text-sm text-gray-500">
        {APP_TAGLINE_EN} Works with any tournament — World Cup, Champions League, and more.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {loading ? (
          <span className="text-gray-500">Loading...</span>
        ) : user ? (
          <>
            <Link href="/dashboard" className="btn-primary px-8 py-3 text-lg">
              Go to Dashboard
            </Link>
            <Link href="/matches" className="btn-secondary px-8 py-3 text-lg">
              View Matches
            </Link>
          </>
        ) : (
          <>
            <Link href="/register" className="btn-primary px-8 py-3 text-lg">
              Get Started
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-3 text-lg">
              Login
            </Link>
          </>
        )}
      </div>
      <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        <div className="card text-left">
          <div className="mb-2 text-2xl">👥</div>
          <h3 className="font-semibold">Create Groups</h3>
          <p className="mt-1 text-sm text-gray-600">
            Form private leagues with friends and compete on group leaderboards.
          </p>
        </div>
        <div className="card text-left">
          <div className="mb-2 text-2xl">🎯</div>
          <h3 className="font-semibold">Predict Matches</h3>
          <p className="mt-1 text-sm text-gray-600">
            Submit score predictions stage by stage before the lock deadline.
          </p>
        </div>
        <div className="card text-left">
          <div className="mb-2 text-2xl">📊</div>
          <h3 className="font-semibold">Track Rankings</h3>
          <p className="mt-1 text-sm text-gray-600">
            Earn up to 5 points per match and climb global and group leaderboards.
          </p>
        </div>
      </div>

      <section className="mt-16 w-full max-w-4xl text-left">
        <h2 className="mb-2 text-center text-2xl font-bold text-pitch-900">How Scoring Works</h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          You get the highest tier you qualify for — points are not stacked for exact score, goal
          difference, and outcome.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreRule
            points={5}
            title="Exact score"
            color="bg-gold-100 text-gold-800 border-gold-200"
            description="Both teams' scores match exactly. Example: you predict 2–1 and the final is 2–1."
          />
          <ScoreRule
            points={3}
            title="Correct goal difference"
            color="bg-pitch-100 text-pitch-800 border-pitch-200"
            description="Same margin, but not the exact score. Example: you predict 3–1 and the final is 2–0 (both +2)."
          />
          <ScoreRule
            points={1}
            title="Correct outcome"
            color="bg-blue-100 text-blue-800 border-blue-200"
            description="Right winner or draw, but wrong goal difference. Example: you predict 1–0 and the final is 3–2 (both home wins)."
          />
          <ScoreRule
            points={0}
            title="Wrong outcome"
            color="bg-gray-100 text-gray-600 border-gray-200"
            description="You picked the wrong result. Example: you predict 2–1 (home win) but the final is 1–1 or 0–2."
          />
        </div>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Knockout bonus:</strong> If a knockout match ends in a draw after extra time and
          goes to penalties, pick the team that advances. A correct winner pick adds{" "}
          <strong>+1 bonus point</strong> on top of your base score.
        </p>
      </section>
    </div>
  );
}

function ScoreRule({
  points,
  title,
  description,
  color,
}: {
  points: number;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="card flex gap-4">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold ${color}`}
      >
        {points}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">
          {points} {points === 1 ? "point" : "points"} — {title}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
