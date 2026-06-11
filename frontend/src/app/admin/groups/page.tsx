"use client";

import { useCallback, useEffect, useState } from "react";
import { api, AdminGroup, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export default function AdminGroupsPage() {
  const { token } = useAuth();
  const t = useT();
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [groupDetails, setGroupDetails] = useState<Record<number, AdminGroup>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api
      .adminGetGroups(token)
      .then((data) => setGroups(unwrapList(data)))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load groups."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleGroup(groupId: number) {
    if (expandedId === groupId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(groupId);
    if (groupDetails[groupId] || !token) return;
    setLoadingDetail(groupId);
    try {
      const detail = await api.adminGetGroup(token, groupId);
      setGroupDetails((prev) => ({ ...prev, [groupId]: detail }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load group members.");
    } finally {
      setLoadingDetail(null);
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-amber-950">{t("adminGroups")}</h1>
      <p className="mb-6 text-gray-600">{t("adminGroupsDesc")}</p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}

      {loading ? (
        <p className="text-gray-500">{t("loading")}</p>
      ) : groups.length === 0 ? (
        <div className="card py-8 text-center text-gray-500">{t("adminNoGroups")}</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const expanded = expandedId === group.id;
            const detail = groupDetails[group.id];
            return (
              <div key={group.id} className="card">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div>
                    <h2 className="text-lg font-semibold">{group.name}</h2>
                    {group.description && (
                      <p className="mt-1 text-sm text-gray-600">{group.description}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-500">
                      {t("createdBy")}: {group.created_by_username} ·{" "}
                      {t("groupMembersCount", { count: group.member_count })} ·{" "}
                      {t("inviteCode")}:{" "}
                      <code className="rounded bg-gray-100 px-1.5 py-0.5">{group.invite_code}</code>
                    </p>
                  </div>
                  <span className="text-sm text-pitch-600">
                    {expanded ? t("hideMembers") : t("showMembers")}
                  </span>
                </button>

                {expanded && (
                  <div className="mt-4 border-t pt-4">
                    {loadingDetail === group.id ? (
                      <p className="text-sm text-gray-500">{t("loading")}</p>
                    ) : detail?.members ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b text-gray-500">
                              <th className="pb-2 pr-4">{t("username")}</th>
                              <th className="pb-2 pr-4">Email</th>
                              <th className="pb-2 pr-4">{t("role")}</th>
                              <th className="pb-2">{t("joined")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.members.map((member) => (
                              <tr key={member.id} className="border-b last:border-0">
                                <td className="py-2 pr-4 font-medium">{member.username}</td>
                                <td className="py-2 pr-4 text-gray-600">{member.email}</td>
                                <td className="py-2 pr-4 capitalize">
                                  {member.role === "admin" ? t("groupAdmin") : t("groupMember")}
                                </td>
                                <td className="py-2 text-gray-500">
                                  {new Date(member.joined_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{t("adminNoMembers")}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
