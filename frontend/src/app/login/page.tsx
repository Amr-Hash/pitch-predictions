"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { postAuthRedirect, authLinkWithNext } from "@/lib/authRedirect";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const resetSuccess = searchParams.get("reset") === "1";
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(postAuthRedirect(user, next));
  }, [user, router, next]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const me = await login(email, password);
      router.push(postAuthRedirect(me, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (user) return null;

  return (
    <div className="mx-auto max-w-md">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="font-display text-2xl font-extrabold">{t("login")}</h1>
          <p className="mt-1 text-sm text-white/80">{t("taglineExtra")}</p>
        </div>
        <div className="auth-card-body">
          {resetSuccess && (
            <div className="mb-4 rounded-xl border border-pitch-200 bg-pitch-50 px-4 py-3 text-sm text-pitch-800">
              {t("passwordResetSuccess")}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-night-700">{t("email")}</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-bold text-night-700">{t("password")}</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-royal-600 hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t("loggingIn") : t("login")}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            {t("noAccount")}{" "}
            <Link
              href={authLinkWithNext("/register", next)}
              className="font-bold text-royal-600 hover:underline"
            >
              {t("register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
