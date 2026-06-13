"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  AdminUser,
  AdminUserActivitySummary,
  unwrapList,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/messages";

type ActivityFilter = "all" | "24h" | "7d" | "inactive" | "never";

const FILTERS: { id: ActivityFilter; labelKey: "adminActivityAll" | "adminActivity24h" | "adminActivity7d" | "adminActivityInactive" | "adminActivityNever" }[] = [
  { id: "all", labelKey: "adminActivityAll" },
  { id: "24h", labelKey: "adminActivity24h" },
  { id: "7d", labelKey: "adminActivity7d" },
  { id: "inactive", labelKey: "adminActivityInactive" },
  { id: "never", labelKey: "adminActivityNever" },
];

function formatLastSeen(value: string | null, locale: Locale, t: (key: "adminNeverVisited" | "adminJustNow") => string) {
  if (!value) return t("adminNeverVisited");
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return t("adminJustNow");
  return formatDateTime(date, locale);
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminUserActivitySummary | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    Promise.all([
      api.adminGetUserActivity(token),
      api.adminGetUsers(token, filter === "all" ? undefined : filter),
    ])
      .then(([activity, data]) => {
        setSummary(activity);
        setUsers(unwrapList(data));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load users."))
      .finally(() => setLoading(false));
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-amber-950">{t("adminUsers")}</h1>
      <p className="mb-6 text-gray-600">{t("adminUsersDesc")}</p>

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500">{t("adminActive24h")}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {summary.active_last_24h}
              <span className="ms-2 text-sm font-medium text-gray-500">
                ({summary.active_24h_pct}%)
              </span>
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">{t("adminActive7d")}</p>
            <p className="mt-1 text-2xl font-bold text-sky-700">
              {summary.active_last_7d}
              <span className="ms-2 text-sm font-medium text-gray-500">
                ({summary.active_7d_pct}%)
              </span>
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">{t("adminInactive7d")}</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{summary.inactive_over_7d}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">{t("adminNeverVisited")}</p>
            <p className="mt-1 text-2xl font-bold text-gray-700">{summary.never_seen}</p>
            <p className="mt-1 text-xs text-gray-400">
              {t("adminTotalFans")}: {summary.total_fans}
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === item.id
                ? "bg-amber-700 text-white"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}

      {loading ? (
        <p className="text-gray-500">{t("loading")}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-3 pr-4">{t("username")}</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">{t("groups")}</th>
                <th className="pb-3 pr-4">{t("adminLastSeen")}</th>
                <th className="pb-3">{t("joined")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{user.username}</td>
                  <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                  <td className="py-3 pr-4">{user.group_count}</td>
                  <td className="py-3 pr-4 text-gray-600">
                    {formatLastSeen(user.last_seen_at, locale, t)}
                  </td>
                  <td className="py-3 text-gray-500">
                    {formatDate(user.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="py-6 text-center text-gray-500">{t("adminNoUsers")}</p>
          )}
        </div>
      )}
    </div>
  );
}
