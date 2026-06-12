"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useT } from "@/lib/i18n";

const LINKS = [
  { href: "/admin", labelKey: "adminTournaments" as const, prefix: "/admin/tournaments" },
  { href: "/admin/teams", labelKey: "adminTeams" as const, prefix: "/admin/teams" },
  { href: "/admin/users", labelKey: "adminUsers" as const, prefix: "/admin/users" },
  { href: "/admin/groups", labelKey: "adminGroups" as const, prefix: "/admin/groups" },
];

export function AdminNavbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const t = useT();

  const tournamentDetailMatch = pathname.match(/^\/admin\/tournaments\/(\d+)/);

  return (
    <header className="sticky top-0 z-50 shadow-lg">
    <nav className="bg-night-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/admin" className="flex items-center gap-2 text-xl font-extrabold text-white">
          <span>⚙️</span>
          <span>{APP_NAME}</span>
          <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-night-900">
            {t("admin")}
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageToggle variant="dark" />
          {LINKS.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin" || pathname.startsWith("/admin/tournaments")
                : pathname.startsWith(item.prefix);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-gold-500 text-night-900 shadow-sm"
                    : "text-white/85 hover:bg-white/10"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
          {tournamentDetailMatch && (
            <span className="rounded-lg bg-pitch-600/50 px-3 py-1.5 text-sm font-semibold text-white">
              {t("managingTournament")}
            </span>
          )}
          <span className="ml-2 text-sm text-white/60">{user?.username}</span>
          <button onClick={logout} className="btn-ghost-nav">
            {t("logout")}
          </button>
        </div>
      </div>
    </nav>
    <div className="nav-stripe" aria-hidden />
    </header>
  );
}
