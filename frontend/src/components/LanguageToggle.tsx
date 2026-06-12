"use client";

import { useLocale, useT } from "@/lib/i18n";
import type { Locale } from "@/lib/messages";

export function LanguageToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const isDark = variant === "dark";

  return (
    <label
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
        isDark
          ? "border border-white/20 bg-white/10 text-white"
          : "border border-royal-200 bg-white shadow-sm"
      }`}
    >
      <span className="text-base leading-none" aria-hidden>
        🌐
      </span>
      <span className={`hidden font-medium sm:inline ${isDark ? "text-white/70" : "text-gray-600"}`}>
        {t("language")}
      </span>
      <select
        className={`cursor-pointer border-0 bg-transparent py-0 pl-0 pr-6 text-sm font-semibold focus:outline-none focus:ring-0 ${
          isDark ? "text-white" : "text-royal-700"
        }`}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("language")}
      >
        <option value="en" className="text-gray-900">
          {t("english")}
        </option>
        <option value="ar" className="text-gray-900">
          {t("arabic")}
        </option>
      </select>
    </label>
  );
}
