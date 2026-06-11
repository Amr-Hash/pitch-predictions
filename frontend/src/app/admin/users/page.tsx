"use client";

import { useCallback, useEffect, useState } from "react";
import { api, AdminUser, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export default function AdminUsersPage() {
  const { token } = useAuth();
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api
      .adminGetUsers(token)
      .then((data) => setUsers(unwrapList(data)))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load users."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-amber-950">{t("adminUsers")}</h1>
      <p className="mb-6 text-gray-600">{t("adminUsersDesc")}</p>

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
                <th className="pb-3 pr-4">{t("role")}</th>
                <th className="pb-3 pr-4">{t("groups")}</th>
                <th className="pb-3">{t("joined")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{user.username}</td>
                  <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                  <td className="py-3 pr-4">
                    {user.is_staff ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {t("admin")}
                      </span>
                    ) : (
                      <span className="text-gray-600">{t("groupMember")}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">{user.group_count}</td>
                  <td className="py-3 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
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
