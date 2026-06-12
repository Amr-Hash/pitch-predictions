"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useT } from "@/lib/i18n";

function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const linkInvalid = !uid || !token;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (linkInvalid) return;
    if (password !== confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.confirmPasswordReset({ uid, token, new_password: password });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resetLinkInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="font-display text-2xl font-extrabold">{t("resetPassword")}</h1>
          <p className="mt-1 text-sm text-white/80">{t("resetPasswordDesc")}</p>
        </div>
        <div className="auth-card-body">
          {linkInvalid ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {t("resetLinkInvalid")}
              </div>
              <Link href="/forgot-password" className="btn-primary block text-center text-sm">
                {t("requestNewLink")}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-night-700">
                    {t("newPassword")}
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-night-700">
                    {t("confirmPassword")}
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? t("saving") : t("resetPassword")}
                </button>
              </form>
            </>
          )}
          <p className="mt-4 text-center text-sm text-gray-600">
            <Link href="/login" className="font-bold text-royal-600 hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
