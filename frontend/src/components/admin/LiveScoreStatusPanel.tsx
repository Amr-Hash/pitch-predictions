"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  type LiveScoreEnvironment,
  type LiveScoreSyncResult,
  type TournamentLiveScoreStatus,
} from "@/lib/api";
import { adminLabel } from "@/lib/adminDisplay";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";

const PROVIDER_KEYS: Record<string, MessageKey> = {
  manual: "adminLiveScoreManual",
  football_data: "adminLiveScoreFootballData",
};

const ISSUE_KEYS: Record<string, MessageKey> = {
  missing_api_token: "adminLiveScoreIssueMissingApiToken",
  outside_sync_window: "adminLiveScoreIssueOutsideWindow",
};

const HEALTH_KEYS: Record<string, MessageKey> = {
  ready: "adminLiveScoreHealthReady",
  warning: "adminLiveScoreHealthWarning",
  error: "adminLiveScoreHealthError",
  manual: "adminLiveScoreHealthManual",
};

const CRON_SCHEDULE_KEYS: Record<string, MessageKey> = {
  django_scheduler: "adminLiveScoreCronScheduler",
  vercel_cron: "adminLiveScoreCronScheduler",
  every_15_minutes_crontab: "adminLiveScoreCronScheduler",
  every_15_minutes: "adminLiveScoreCronScheduler",
};

function HealthBadge({ health }: { health: string }) {
  const t = useT();
  const colors: Record<string, string> = {
    ready: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-900",
    error: "bg-red-100 text-red-800",
    manual: "bg-gray-100 text-gray-700",
  };
  const labelKey = HEALTH_KEYS[health] ?? "adminLiveScoreHealthWarning";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[health] ?? colors.warning}`}
    >
      {t(labelKey)}
    </span>
  );
}

function EnvRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="text-end">
        <span
          className={`font-semibold ${ok ? "text-green-700" : "text-red-700"}`}
        >
          {ok ? "✓" : "✕"}
        </span>
        {detail ? <p className="mt-0.5 text-xs text-gray-500">{detail}</p> : null}
      </div>
    </div>
  );
}

function EnvironmentCard({ environment }: { environment: LiveScoreEnvironment }) {
  const t = useT();
  const windowDetail =
    environment.sync_window_start || environment.sync_window_end
      ? `${environment.sync_window_start ?? "…"} → ${environment.sync_window_end ?? "…"}`
      : t("adminLiveScoreWindowAlways");

  return (
    <div className="admin-card space-y-3">
      <h3 className="font-semibold text-pitch-900">{t("adminLiveScoreEnvironment")}</h3>
      <EnvRow label={t("adminLiveScoreCronSecret")} ok={environment.cron_secret_configured} />
      <EnvRow
        label={t("adminLiveScoreSyncWindow")}
        ok={environment.sync_window_open}
        detail={windowDetail}
      />
      <EnvRow
        label={t("adminLiveScoreCronSchedule")}
        ok={environment.cron_secret_configured}
        detail={t(
          CRON_SCHEDULE_KEYS[environment.cron_schedule] ?? "adminLiveScoreCronScheduler",
        )}
      />
      <EnvRow
        label={t("adminLiveScoreApiToken")}
        ok={environment.football_data_api_configured}
        detail={environment.default_competition_code}
      />
    </div>
  );
}

function TournamentStatusCard({
  status,
  onSync,
  syncing,
  lastSync,
  showManageLink,
}: {
  status: TournamentLiveScoreStatus;
  onSync?: () => void;
  syncing?: boolean;
  lastSync?: LiveScoreSyncResult | null;
  showManageLink?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const providerKey = PROVIDER_KEYS[status.live_score_provider] ?? "adminLiveScoreManual";

  return (
    <div className="admin-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            {adminLabel({
              name: status.tournament_name,
              name_ar: status.tournament_name_ar,
            }, locale)}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t(providerKey)}
            {status.competition_code ? (
              <span className="block truncate text-xs text-gray-500">
                {status.competition_code}
              </span>
            ) : null}
          </p>
        </div>
        <HealthBadge health={status.health} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("adminLiveScoreMatchesTotal")} value={status.matches.total} />
        <Stat label={t("statusLive")} value={status.matches.live} highlight />
        <Stat label={t("statusFinished")} value={status.matches.finished} />
        <Stat
          label={t("adminLiveScoreInWindowLabel")}
          value={status.matches.in_sync_window}
          highlight={status.matches.in_sync_window > 0}
        />
      </div>

      {status.issues.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          {status.issues.map((issue) => (
            <li key={issue}>• {t(ISSUE_KEYS[issue] ?? "adminLiveScoreIssueOutsideWindow")}</li>
          ))}
        </ul>
      )}

      {lastSync && (
        <p className="text-sm text-gray-600">
          {t("adminLiveScoreLastSync", {
            updated: lastSync.updated ?? 0,
            skipped: lastSync.skipped ?? 0,
          })}
          {lastSync.error ? ` · ${lastSync.error}` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onSync && status.live_score_provider === "football_data" && (
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={syncing}
            onClick={onSync}
          >
            {syncing ? t("loading") : t("adminSyncLiveScores")}
          </button>
        )}
        {showManageLink && (
          <Link
            href={`/admin/tournaments/${status.tournament_id}`}
            className="btn-secondary text-sm"
          >
            {t("adminManageTournament")} →
          </Link>
        )}
        <Link href="/admin/tournaments" className="btn-secondary text-sm">
          {t("adminEditDetails")}
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-xl font-bold ${
          warn ? "text-red-700" : highlight ? "text-fan-700" : "text-pitch-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function LiveScoreStatusPanel({
  tournamentId,
  compact,
}: {
  tournamentId?: number;
  compact?: boolean;
}) {
  const { token } = useAuth();
  const t = useT();
  const [environment, setEnvironment] = useState<LiveScoreEnvironment | null>(null);
  const [tournaments, setTournaments] = useState<TournamentLiveScoreStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [lastSyncById, setLastSyncById] = useState<Record<number, LiveScoreSyncResult>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      if (tournamentId) {
        const data = await api.adminGetTournamentLiveScoreStatus(token, tournamentId);
        setEnvironment(data.environment);
        setTournaments([data.tournament]);
      } else {
        const data = await api.adminGetLiveScoreOverview(token);
        setEnvironment(data.environment);
        setTournaments(data.tournaments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminLiveScoreLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, tournamentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync(id: number) {
    if (!token) return;
    setSyncingId(id);
    try {
      const result = await api.adminSyncLiveScores(token, id);
      setLastSyncById((prev) => ({ ...prev, [id]: result }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveTournament"));
    } finally {
      setSyncingId(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500">{t("loading")}</p>;
  }

  return (
    <div className="space-y-6">
      {!compact && (
        <div>
          <h2 className="text-xl font-bold text-pitch-900">{t("adminLiveScores")}</h2>
          <p className="mt-1 text-sm text-gray-600">{t("adminLiveScoresDesc")}</p>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {environment && !compact ? <EnvironmentCard environment={environment} /> : null}

      {tournaments.map((status) => (
        <TournamentStatusCard
          key={status.tournament_id}
          status={status}
          onSync={() => handleSync(status.tournament_id)}
          syncing={syncingId === status.tournament_id}
          lastSync={lastSyncById[status.tournament_id] ?? null}
          showManageLink={!tournamentId}
        />
      ))}
    </div>
  );
}
