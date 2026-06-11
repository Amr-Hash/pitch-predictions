"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-8 text-6xl">🏆</div>
      <h1 className="mb-4 text-4xl font-bold text-pitch-900 sm:text-5xl">
        World Cup Prediction Competition
      </h1>
      <p className="mb-8 max-w-2xl text-lg text-gray-600">
        Compete with friends by predicting match results. Earn points for exact scores,
        goal differences, and correct outcomes. Climb the leaderboard and prove you know football best.
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
            Form private groups with friends and compete on group leaderboards.
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
    </div>
  );
}
