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
    <nav className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="flex items-center gap-2 text-xl font-bold text-amber-900">
          <span>⚙️</span>
          <span>{APP_NAME}</span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            {t("admin")}
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageToggle />
          {LINKS.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin" || pathname.startsWith("/admin/tournaments")
                : pathname.startsWith(item.prefix);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-amber-900 shadow-sm"
                    : "text-amber-800 hover:bg-amber-100"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
          {tournamentDetailMatch && (
            <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-900 shadow-sm">
              {t("managingTournament")}
            </span>
          )}
          <span className="ml-2 text-sm text-amber-700">{user?.username}</span>
          <button onClick={logout} className="btn-secondary border-amber-300 bg-white text-sm">
            {t("logout")}
          </button>
        </div>
      </div>
    </nav>
  );
}
