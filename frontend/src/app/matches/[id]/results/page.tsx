"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Match, Prediction, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";
import { teamLabel } from "@/lib/localize";
import type { MessageKey } from "@/lib/messages";

const STATUS_KEYS: Record<string, MessageKey> = {
  scheduled: "statusScheduled",
  live: "statusLive",
  finished: "statusFinished",
};

export default function MatchResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();
  const [match, setMatch] = useState<Match | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      api.getMatches(token).then((data) => {
        const list = unwrapList(data);
        setMatch(list.find((m) => m.id === Number(id)) || null);
      }),
      api.getPredictions(token).then((data) => {
        setPredictions(unwrapList(data).filter((p) => p.match === Number(id)));
      }),
    ]);
  }, [token, id]);

  if (authLoading || !user) return <div>{t("loading")}</div>;
  if (!match) return <div>{t("matchNotFound")}</div>;

  const statusKey = STATUS_KEYS[match.status];
  const statusText = statusKey ? t(statusKey) : match.status;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/matches"
        className="mb-4 inline-block text-sm text-pitch-600 hover:underline"
      >
        ← {t("backToMatches")}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">{t("matchResults")}</h1>

      <div className="card mb-6">
        <p className="mb-2 text-sm text-gray-500">
          {locale === "ar" && match.stage_name_ar ? match.stage_name_ar : match.stage_name}
        </p>
        <div className="flex items-center justify-between">
          <p className="font-semibold">{teamLabel(match.home_team, locale)}</p>
          <p className="text-3xl font-bold">
            {match.home_score} - {match.away_score}
          </p>
          <p className="font-semibold">{teamLabel(match.away_team, locale)}</p>
        </div>
        <p className="mt-2 text-center text-sm text-gray-500">
          {t("statusLabel", { status: statusText })}
        </p>
        {match.winner_team && (
          <p className="mt-1 text-center text-sm text-pitch-600">
            {t("winnerLabel", { name: teamLabel(match.winner_team, locale) })}
          </p>
        )}
      </div>

      <h2 className="mb-4 text-xl font-semibold">{t("yourPredictions")}</h2>
      {predictions.length === 0 ? (
        <p className="text-gray-500">{t("noPredictionsForMatch")}</p>
      ) : (
        predictions.map((p) => (
          <div key={p.id} className="card mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {t("predictedLabel", {
                    home: p.predicted_home_score,
                    away: p.predicted_away_score,
                  })}
                </p>
                {p.predicted_winner_team && (
                  <p className="text-sm text-gray-500">
                    {t("advancedLabel", {
                      name: teamLabel(p.predicted_winner_team, locale),
                    })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-pitch-600">{p.points_awarded}</p>
                <p className="text-xs text-gray-500">{t("points")}</p>
              </div>
            </div>
          </div>
        ))
      )}

      {match.status === "finished" && (
        <div className="mt-8 text-center">
          <Link href={`/matches/${id}/compare`} className="btn-secondary">
            {t("compareWithGroup")}
          </Link>
        </div>
      )}
    </div>
  );
}
