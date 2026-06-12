"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { postAuthRedirect, authLinkWithNext } from "@/lib/authRedirect";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

function RegisterForm() {
  const { register, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const t = useT();
  const [username, setUsername] = useState("");
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
      const me = await register(username, email, password);
      router.push(postAuthRedirect(me, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (user) return null;

  return (
    <div className="mx-auto max-w-md">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="font-display text-2xl font-extrabold">{t("createAccount")}</h1>
          <p className="mt-1 text-sm text-white/80">{t("predictMatchesDesc")}</p>
        </div>
        <div className="auth-card-body">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-night-700">{t("username")}</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
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
              <label className="mb-1 block text-sm font-bold text-night-700">{t("password")}</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <button type="submit" className="btn-fan w-full" disabled={loading}>
              {loading ? t("creatingAccount") : t("register")}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            {t("alreadyHaveAccount")}{" "}
            <Link
              href={authLinkWithNext("/login", next)}
              className="font-bold text-royal-600 hover:underline"
            >
              {t("login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
