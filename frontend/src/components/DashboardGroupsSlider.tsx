"use client";

import Link from "next/link";
import { useRef } from "react";
import { DashboardGroupSummary } from "@/lib/api";
import { OlympicPodium } from "@/components/OlympicPodium";
import { GroupChallengeAudience } from "@/components/GroupChallengeAudience";
import { useT } from "@/lib/i18n";

function GroupSlide({ group }: { group: DashboardGroupSummary }) {
  const t = useT();
  const gap = group.leader_points - group.total_points;
  const rankLabel =
    group.rank != null
      ? t("groupRank", { rank: group.rank, count: group.member_count })
      : t("groupMembersCount", { count: group.member_count });

  return (
    <Link
      href={`/groups/${group.id}`}
      className="group-slider-card card-hover flex flex-col border-t-4 border-t-royal-500 bg-gradient-to-b from-royal-50/40 to-white"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-extrabold text-night-900">
            {group.name}
          </h3>
          <p className="text-xs font-semibold text-gray-500">{rankLabel}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-night-900 px-3 py-1.5 text-center text-white shadow">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gold-400">
            {t("yourRank")}
          </p>
          <p className="font-display text-2xl font-extrabold leading-none">
            {group.rank != null ? (
              <>
                {group.rank === 1 ? "🥇" : group.rank === 2 ? "🥈" : group.rank === 3 ? "🥉" : `#${group.rank}`}
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-night-700/60">
        {t("groupPodium")}
      </p>
      <OlympicPodium podium={group.podium ?? []} />

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
        <span className="font-display text-xl font-extrabold text-gold-600">
          {group.total_points}{" "}
          <span className="text-xs font-normal text-gray-500">{t("points")}</span>
        </span>
        {gap > 0 && group.rank !== 1 && (
          <span className="text-xs text-gray-500">{t("behindLeader", { points: gap })}</span>
        )}
        <span className="font-bold text-royal-600">{t("openGroup")} →</span>
      </div>
    </Link>
  );
}

interface Props {
  groups: DashboardGroupSummary[];
}

export function DashboardGroupsSlider({ groups }: Props) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;
    const amount = track.clientWidth * 0.85;
    track.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (groups.length === 0) {
    return (
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-heading-royal text-base normal-case tracking-normal">
            {t("yourGroups")}
          </h2>
          <Link href="/groups#create-group" className="btn-fan text-sm">
            {t("createOrJoinGroup")}
          </Link>
        </div>
        <div className="card border-2 border-dashed border-royal-200 bg-gradient-to-br from-royal-50/50 to-white p-8 text-center">
          <span className="mb-2 block text-4xl" aria-hidden>
            🏆
          </span>
          <p className="font-display text-lg font-extrabold text-night-900">{t("noGroupsYet")}</p>
          <GroupChallengeAudience variant="light" className="mx-auto mt-4 max-w-md justify-center" />
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-gray-600">
            {t("noGroupsDesc")}
          </p>
          <Link href="/groups#create-group" className="btn-primary mt-5 inline-block text-sm">
            {t("createOrJoinGroup")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-heading-royal text-base normal-case tracking-normal">
          {t("yourGroups")}
        </h2>
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scroll("left")}
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-night-700 shadow-sm transition hover:bg-royal-50 sm:flex"
                aria-label={t("scrollLeft")}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-night-700 shadow-sm transition hover:bg-royal-50 sm:flex"
                aria-label={t("scrollRight")}
              >
                ›
              </button>
            </>
          )}
          <Link href="/groups" className="btn-secondary text-sm">
            {t("manageGroups")}
          </Link>
        </div>
      </div>

      <div ref={trackRef} className="group-slider -mx-1 px-1">
        {groups.map((group) => (
          <GroupSlide key={group.id} group={group} />
        ))}
      </div>

      {groups.length > 1 && (
        <p className="mt-2 text-center text-xs text-gray-400 sm:hidden">{t("swipeGroups")}</p>
      )}

      <Link
        href="/groups#create-group"
        className="card card-hover mt-4 block border-l-4 border-l-pitch-500 bg-gradient-to-r from-pitch-50/80 to-white p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-start">
            <p className="font-display text-base font-extrabold text-night-900">
              {t("createAnotherGroup")}
            </p>
            <GroupChallengeAudience variant="light" className="mt-3" />
            <p className="mt-3 text-sm text-gray-600">{t("groupsCreateAnotherHint")}</p>
          </div>
          <span className="shrink-0 font-bold text-pitch-700">{t("createOrJoinGroup")} →</span>
        </div>
      </Link>
    </section>
  );
}
