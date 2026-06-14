"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isStaff } from "@/lib/staff";
import { formatBadgeCount } from "@/lib/format";
import { useTournament } from "@/lib/tournament";
import { useT } from "@/lib/i18n";

function itemClass(active: boolean) {
  return `flex min-h-[3rem] min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-bold transition ${
    active ? "text-gold-400" : "text-white/70"
  }`;
}

export function MobileBottomNav() {
  const { user, token, loading } = useAuth();
  const pathname = usePathname();
  const { selectedTournament } = useTournament();
  const t = useT();
  const [pendingCount, setPendingCount] = useState(0);

  const show =
    !loading &&
    user &&
    !isStaff(user) &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register");

  useEffect(() => {
    if (!token || !selectedTournament || !show) {
      setPendingCount(0);
      return;
    }
    api
      .getPendingCount(token, { tournament: selectedTournament.id })
      .then((data) => setPendingCount(data.pending_count))
      .catch(() => setPendingCount(0));
  }, [token, selectedTournament, show]);

  if (!show) return null;

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 min-h-mobile-nav border-t border-white/10 bg-night-900/95 backdrop-blur-md md:hidden"
      aria-label={t("mobileNav")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        <Link href="/dashboard" className={itemClass(pathname === "/dashboard")}>
          <span className="text-lg" aria-hidden>
            🏠
          </span>
          <span>{t("home")}</span>
        </Link>
        <Link href="/matches" className={`${itemClass(pathname.startsWith("/matches"))} relative`}>
          <span className="text-lg" aria-hidden>
            ⚽
          </span>
          <span>{t("matches")}</span>
          {pendingCount > 0 && (
            <span className="absolute end-1 top-0 inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold tabular-nums text-night-900">
              {formatBadgeCount(pendingCount)}
            </span>
          )}
        </Link>
        <Link href="/groups" className={itemClass(pathname.startsWith("/groups"))}>
          <span className="text-lg" aria-hidden>
            👥
          </span>
          <span>{t("myGroups")}</span>
        </Link>
        <Link href="/tournament-groups" className={itemClass(pathname.startsWith("/tournament-groups"))}>
          <span className="text-lg" aria-hidden>
            📊
          </span>
          <span>{t("standings")}</span>
        </Link>
        <Link href="/notifications" className={itemClass(pathname.startsWith("/notifications"))}>
          <span className="text-lg" aria-hidden>
            🔔
          </span>
          <span>{t("notifications")}</span>
        </Link>
      </div>
      <div className="nav-stripe h-0.5" aria-hidden />
    </nav>
  );
}
