"use client";

import { useLocale } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-medium"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-md px-2 py-1 transition ${
          locale === "en"
            ? "bg-pitch-600 text-white"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={`rounded-md px-2 py-1 transition ${
          locale === "ar"
            ? "bg-pitch-600 text-white"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        ع
      </button>
    </div>
  );
}
