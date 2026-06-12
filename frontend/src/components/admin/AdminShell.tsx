"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { isStaff } from "@/lib/staff";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    else if (!loading && user && !isStaff(user)) router.push("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="py-12 text-center text-gray-500">{t("loading")}</div>;
  }
  if (!isStaff(user)) return null;

  return <>{children}</>;
}
