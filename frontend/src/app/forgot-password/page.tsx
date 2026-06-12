"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email);
      setSuccess(res.detail || t("forgotPasswordSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tryAgain"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="font-display text-2xl font-extrabold">{t("forgotPassword")}</h1>
          <p className="mt-1 text-sm text-white/80">{t("forgotPasswordDesc")}</p>
        </div>
        <div className="auth-card-body">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success ? (
            <div className="rounded-xl border border-pitch-200 bg-pitch-50 px-4 py-3 text-sm text-pitch-800">
              {success}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-night-700">{t("email")}</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t("sending") : t("sendResetLink")}
              </button>
            </form>
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
