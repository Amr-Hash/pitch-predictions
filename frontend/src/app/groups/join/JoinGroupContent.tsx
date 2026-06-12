"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, unwrapList } from "@/lib/api";
import { loginUrlWithNext } from "@/lib/authRedirect";
import { useAuth } from "@/lib/auth";
import { groupJoinPath } from "@/lib/groupInvite";
import { useT } from "@/lib/i18n";

export default function JoinGroupContent() {
  const { user, token, loading: authLoading } = useAuth();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = (searchParams.get("code") || "").trim().toUpperCase();

  const [joinCode, setJoinCode] = useState(codeFromUrl);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);

  useEffect(() => {
    setJoinCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const returnPath = codeFromUrl ? groupJoinPath(codeFromUrl) : "/groups/join";
      router.replace(loginUrlWithNext(returnPath));
    }
  }, [authLoading, user, router, codeFromUrl]);

  useEffect(() => {
    if (!token || !codeFromUrl) return;
    setCheckingMembership(true);
    api
      .getGroups(token)
      .then((data) => {
        const existing = unwrapList(data).find(
          (g) => g.invite_code.toUpperCase() === codeFromUrl
        );
        if (existing) router.replace(`/groups/${existing.id}`);
      })
      .finally(() => setCheckingMembership(false));
  }, [token, codeFromUrl, router]);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError(t("inviteCodeRequired"));
      return;
    }
    setError("");
    setJoining(true);
    try {
      const group = await api.joinGroup(token, code);
      router.push(`/groups/${group.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("tryAgain");
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || !user || checkingMembership) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="font-display text-2xl font-extrabold">{t("joinGroupInviteTitle")}</h1>
          <p className="mt-1 text-sm text-white/80">{t("joinGroupInviteDesc")}</p>
        </div>
        <div className="auth-card-body">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-night-700">
                {t("inviteCode")}
              </label>
              <input
                className="input font-mono uppercase tracking-widest"
                placeholder={t("inviteCodePlaceholder")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-fan w-full" disabled={joining}>
              {joining ? t("joiningGroup") : t("joinGroup")}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            <Link href="/groups" className="font-bold text-royal-600 hover:underline">
              {t("backToGroups")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
