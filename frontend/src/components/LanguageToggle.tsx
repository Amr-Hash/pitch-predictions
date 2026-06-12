"use client";

import { useLocale, useT } from "@/lib/i18n";
import type { Locale } from "@/lib/messages";

const OPTIONS: { value: Locale; short: string; labelKey: "english" | "arabic" }[] = [
  { value: "en", short: "EN", labelKey: "english" },
  { value: "ar", short: "عربي", labelKey: "arabic" },
];

export function LanguageToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const isDark = variant === "dark";

  return (
    <div
      role="group"
      aria-label={t("language")}
      dir="ltr"
      className={`relative inline-grid grid-cols-2 rounded-full p-0.5 ${
        isDark
          ? "border border-white/15 bg-white/10 shadow-inner shadow-black/20 backdrop-blur-sm"
          : "border border-royal-200/80 bg-white shadow-sm"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-2px)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
          locale === "ar" ? "translate-x-full" : "translate-x-0"
        } ${
          isDark
            ? "bg-gradient-to-b from-gold-400 to-gold-500 shadow-md shadow-gold-500/30 ring-1 ring-gold-300/50"
            : "bg-gradient-to-r from-pitch-600 to-royal-600 shadow-md shadow-royal-500/25"
        }`}
      />
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLocale(option.value)}
            aria-pressed={active}
            aria-label={t(option.labelKey)}
            title={t(option.labelKey)}
            className={`relative z-10 min-w-[2.75rem] rounded-full px-2.5 py-1.5 text-xs font-extrabold tracking-wide transition-colors duration-200 sm:min-w-[3rem] sm:px-3 sm:text-sm ${
              active
                ? isDark
                  ? "text-night-900"
                  : "text-white"
                : isDark
                  ? "text-white/65 hover:text-white"
                  : "text-night-600 hover:text-royal-700"
            }`}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
