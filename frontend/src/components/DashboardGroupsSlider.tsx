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

function CreateGroupHero({ variant }: { variant: "empty" | "another" }) {
  const t = useT();
  const isEmpty = variant === "empty";

  return (
    <Link
      href="/groups#create-group"
      className="group block overflow-hidden rounded-2xl bg-gradient-to-br from-royal-800 via-night-900 to-pitch-800 p-8 text-white shadow-xl transition hover:shadow-2xl sm:p-10"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="mb-3 block text-5xl" aria-hidden>
            🏆
          </span>
          <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
            {isEmpty ? t("groupsHeroTitle") : t("createAnotherGroup")}
          </h2>
          <GroupChallengeAudience
            variant="dark"
            className="mt-4 justify-center sm:justify-start"
          />
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90">
            {isEmpty ? t("noGroupsDesc") : t("groupsCreateAnotherHint")}
          </p>
        </div>
        <div className="shrink-0 sm:text-center">
          <span className="inline-flex min-h-[3.25rem] min-w-[12rem] items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-extrabold text-pitch-700 shadow-lg transition group-hover:bg-gold-50 group-hover:shadow-xl">
            {isEmpty ? t("createGroups") : t("createOrJoinGroup")} →
          </span>
          {!isEmpty && (
            <p className="mt-3 text-xs font-medium text-white/70">{t("createGroupCardDesc")}</p>
          )}
        </div>
      </div>
    </Link>
  );
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
        <CreateGroupHero variant="empty" />
        <p className="mt-4 text-center text-sm text-gray-600">
          {t("joinGroupCardDesc")}{" "}
          <Link href="/groups" className="font-bold text-royal-600 hover:underline">
            {t("joinGroup")} →
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-heading-royal text-base normal-case tracking-normal">
          {t("yourGroups")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/groups#create-group" className="btn-fan px-5 py-2.5 text-base font-bold">
            + {t("createGroups")}
          </Link>
          {groups.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scroll("left")}
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-night-700 shadow-sm transition hover:bg-royal-50 sm:flex"
                aria-label={t("scrollLeft")}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-night-700 shadow-sm transition hover:bg-royal-50 sm:flex"
                aria-label={t("scrollRight")}
              >
                ›
              </button>
            </>
          )}
          <Link href="/groups" className="btn-secondary px-4 py-2.5 text-sm">
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

      <div className="mt-6">
        <CreateGroupHero variant="another" />
      </div>
    </section>
  );
}
