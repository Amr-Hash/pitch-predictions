"use client";

import { GROUP_ICONS, type GroupIconId } from "@/lib/groupIcons";
import { useT } from "@/lib/i18n";

interface Props {
  value: GroupIconId;
  onChange: (icon: GroupIconId) => void;
  variant?: "light" | "dark";
}

export function GroupIconPicker({ value, onChange, variant = "light" }: Props) {
  const t = useT();
  const isDark = variant === "dark";

  return (
    <fieldset>
      <legend
        className={`mb-2 block text-sm font-semibold ${isDark ? "text-white" : "text-night-800"}`}
      >
        {t("groupIconLabel")}
      </legend>
      <div className="flex flex-wrap gap-2">
        {GROUP_ICONS.map(({ id, emoji, labelKey }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                selected
                  ? isDark
                    ? "border-gold-400 bg-gold-400/20 text-white ring-2 ring-gold-300/60"
                    : "border-royal-500 bg-royal-50 text-royal-800 ring-2 ring-royal-300"
                  : isDark
                    ? "border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15"
                    : "border-gray-200 bg-white text-night-800 hover:border-royal-200 hover:bg-royal-50/50"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {emoji}
              </span>
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
