"use client";

import type { GroupStandingRow } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { teamLabel } from "@/lib/localize";
import type { Locale } from "@/lib/messages";
import { TeamFlag } from "@/components/TeamFlag";

type Props = {
  standings: GroupStandingRow[];
  locale: Locale;
};

export function GroupStandingsTable({ standings, locale }: Props) {
  const t = useT();

  if (standings.length === 0) {
    return (
      <p className="mt-3 text-xs text-gray-500">{t("standingsNoMatches")}</p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            <th className="py-2 pe-2">#</th>
            <th className="py-2 pe-2">{t("team")}</th>
            <th className="px-1 py-2 text-center">P</th>
            <th className="px-1 py-2 text-center">W</th>
            <th className="px-1 py-2 text-center">D</th>
            <th className="px-1 py-2 text-center">L</th>
            <th className="px-1 py-2 text-center">GF</th>
            <th className="px-1 py-2 text-center">GA</th>
            <th className="px-1 py-2 text-center">GD</th>
            <th className="px-1 py-2 text-center font-extrabold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr
              key={row.team.id}
              className={`border-b border-gray-100 ${
                row.qualifies ? "bg-pitch-50/70" : ""
              }`}
            >
              <td className="py-2 pe-2 font-bold text-night-800">
                {row.rank}
                {row.qualifies && (
                  <span
                    className="ms-1 text-[10px] text-pitch-600"
                    title={
                      row.qualification_via === "best_third"
                        ? t("qualifiesBestThird")
                        : t("qualifies")
                    }
                  >
                    {row.qualification_via === "best_third" ? "✓³" : "✓"}
                  </span>
                )}
              </td>
              <td className="py-2 pe-2">
                <div className="flex items-center gap-2">
                  <TeamFlag src={row.team.flag_url} size="xs" className="shadow-none" />
                  <span className="font-semibold text-night-900">
                    {teamLabel(row.team, locale)}
                  </span>
                </div>
              </td>
              <td className="px-1 py-2 text-center">{row.played}</td>
              <td className="px-1 py-2 text-center">{row.won}</td>
              <td className="px-1 py-2 text-center">{row.drawn}</td>
              <td className="px-1 py-2 text-center">{row.lost}</td>
              <td className="px-1 py-2 text-center">{row.goals_for}</td>
              <td className="px-1 py-2 text-center">{row.goals_against}</td>
              <td className="px-1 py-2 text-center font-semibold">
                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
              </td>
              <td className="px-1 py-2 text-center font-extrabold text-night-900">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
