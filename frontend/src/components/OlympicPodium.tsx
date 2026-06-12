"use client";

import { useMemo } from "react";
import { DashboardPodiumEntry } from "@/lib/api";
import { useT } from "@/lib/i18n";

const PODIUM_SLOTS = [
  { rank: 2, medal: "🥈", height: "h-20", platform: "from-slate-300 to-slate-100" },
  { rank: 1, medal: "🥇", height: "h-28", platform: "from-gold-500 to-gold-200" },
  { rank: 3, medal: "🥉", height: "h-14", platform: "from-amber-700 to-amber-400" },
] as const;

export function OlympicPodium({ podium }: { podium: DashboardPodiumEntry[] }) {
  const t = useT();

  const byRank = useMemo(() => {
    const map: Record<number, DashboardPodiumEntry[]> = { 1: [], 2: [], 3: [] };
    for (const entry of podium) {
      if (entry.rank >= 1 && entry.rank <= 3) {
        map[entry.rank].push(entry);
      }
    }
    return map;
  }, [podium]);

  return (
    <div className="flex items-end justify-center gap-1.5 sm:gap-2">
      {PODIUM_SLOTS.map((slot) => {
        const entries = byRank[slot.rank];
        const points = entries[0]?.total_points;
        const slotHeight =
          entries.length > 2 ? "min-h-[5.5rem]" : entries.length > 1 ? "min-h-[4.5rem]" : slot.height;

        return (
          <div key={slot.rank} className="flex w-[31%] flex-col items-center">
            <span className="text-xl sm:text-2xl" aria-hidden>
              {slot.medal}
            </span>
            {entries.length > 0 ? (
              <div className="mt-1 w-full space-y-0.5 px-0.5 text-center">
                {entries.map((entry) => (
                  <p
                    key={entry.user_id}
                    className={`truncate text-[10px] font-bold leading-tight sm:text-xs ${
                      entry.is_you ? "text-royal-600" : "text-night-900"
                    }`}
                    title={entry.username}
                  >
                    {entry.username}
                    {entry.is_you && (
                      <span className="font-semibold text-royal-500"> ({t("you")})</span>
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">—</p>
            )}
            <div
              className={`mt-2 flex w-full ${slotHeight} items-end justify-center rounded-t-xl bg-gradient-to-t ${slot.platform} px-1 pb-1.5 shadow-inner`}
            >
              {points != null && (
                <span className="font-display text-sm font-extrabold text-night-900/80">
                  {points}
                  {entries.length > 1 && (
                    <span className="block text-[9px] font-semibold normal-case opacity-70">
                      {t("tiedPoints")}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
