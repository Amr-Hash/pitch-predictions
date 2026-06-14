"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { GroupInviteShare } from "@/components/GroupInviteShare";
import { GroupChallengeAudience } from "@/components/GroupChallengeAudience";
import { GroupIconPicker } from "@/components/GroupIconPicker";
import { api, Group, unwrapList } from "@/lib/api";
import { DEFAULT_GROUP_ICON, groupIconEmoji, type GroupIconId } from "@/lib/groupIcons";
import { loginUrlWithNext } from "@/lib/authRedirect";
import { useAuth } from "@/lib/auth";
import { groupJoinPath } from "@/lib/groupInvite";
import { useT } from "@/lib/i18n";

export default function GroupsContent() {
  const { user, token, loading: authLoading } = useAuth();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<GroupIconId>(DEFAULT_GROUP_ICON);
  const [joinCode, setJoinCode] = useState(searchParams.get("code") || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      router.replace(groupJoinPath(code));
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!authLoading && !user) router.push(loginUrlWithNext("/groups"));
  }, [authLoading, user, router]);

  const loadGroups = () => {
    if (!token) return;
    api.getGroups(token).then((data) => setGroups(unwrapList(data)));
  };

  useEffect(loadGroups, [token]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    try {
      await api.createGroup(token, { name, description, icon });
      setName("");
      setDescription("");
      setIcon(DEFAULT_GROUP_ICON);
      setSuccess(t("groupCreated"));
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tryAgain"));
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    try {
      await api.joinGroup(token, joinCode.toUpperCase());
      setJoinCode("");
      setSuccess(t("groupJoined"));
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tryAgain"));
    }
  };

  if (authLoading || !user) return <div>{t("loading")}</div>;

  return (
    <div>
      <h1 className="page-title mb-2">{t("myGroups")}</h1>

      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-royal-800 via-night-900 to-pitch-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <span className="text-3xl" aria-hidden>
            🏆
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t("groupsHeroTitle")}</h2>
            <GroupChallengeAudience variant="dark" className="mt-4" />
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
              {t("groupsHeroDesc")}
            </p>
            <p className="mt-4 text-xs font-medium text-white/70">
              <Link href="/tournament-groups" className="font-bold text-gold-300 hover:underline">
                {t("standings")} →
              </Link>
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-pitch-200 bg-pitch-50 px-4 py-3 text-sm font-medium text-pitch-800">
          {success}
        </div>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div id="create-group" className="feature-card-pitch scroll-mt-24">
          <h2 className="font-display text-lg font-extrabold text-pitch-800">
            {t("createGroups")}
          </h2>
          <p className="mb-4 mt-2 text-sm text-gray-600">{t("createGroupCardDesc")}</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <GroupIconPicker value={icon} onChange={setIcon} />
            <input
              className="input"
              placeholder={t("groupNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <textarea
              className="input"
              placeholder={t("groupDescPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <button type="submit" className="btn-primary">
              {t("createGroups")}
            </button>
          </form>
        </div>
        <div className="feature-card-royal">
          <h2 className="font-display text-lg font-extrabold text-royal-800">
            {t("joinGroup")}
          </h2>
          <p className="mb-4 mt-2 text-sm text-gray-600">{t("joinGroupCardDesc")}</p>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              className="input font-mono uppercase tracking-widest"
              placeholder={t("inviteCodePlaceholder")}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <button type="submit" className="btn-fan">
              {t("joinGroup")}
            </button>
          </form>
        </div>
      </div>

      <h2 className="section-heading-royal mb-4 text-base normal-case tracking-normal">
        {t("yourGroups")}
      </h2>
      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-royal-200 bg-royal-50/40 p-6 text-center">
          <p className="font-display text-lg font-extrabold text-night-900">{t("noGroupsYet")}</p>
          <GroupChallengeAudience variant="light" className="mx-auto mt-4 max-w-md justify-center" />
          <p className="mx-auto mt-4 max-w-lg text-sm text-gray-600">{t("noGroupsDesc")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, index) => {
            const accents = [
              "border-l-fan-500 from-fan-50/60",
              "border-l-royal-500 from-royal-50/60",
              "border-l-pitch-500 from-pitch-50/60",
            ];
            const accent = accents[index % accents.length];
            return (
              <div
                key={g.id}
                className={`card border-l-4 bg-gradient-to-br to-white ${accent}`}
              >
                <Link href={`/groups/${g.id}`} className="card-hover block">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden>
                      {groupIconEmoji(g.icon)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-extrabold text-night-900">{g.name}</h3>
                      {g.description && (
                        <p className="mt-1 text-sm text-gray-600">{g.description}</p>
                      )}
                      <p className="mt-1 text-sm font-medium text-gray-500">
                        {t("groupMembersCount", { count: g.member_count })}
                      </p>
                      {g.is_admin && (
                        <span className="mt-2 inline-block rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-gold-800">
                          {t("groupAdmin")}
                        </span>
                      )}
                      <p className="mt-3 text-sm font-bold text-royal-600">{t("openGroup")} →</p>
                    </div>
                  </div>
                </Link>
                <GroupInviteShare
                  inviteCode={g.invite_code}
                  isolateClicks
                  className="mt-4 border-t border-gray-100 pt-4"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
