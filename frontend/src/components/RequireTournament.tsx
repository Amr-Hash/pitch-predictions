"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTournament } from "@/lib/tournament";
import { EmptyState } from "@/components/EmptyState";
import { useT } from "@/lib/i18n";

export function RequireTournament({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { selectedTournament, loading: tournamentLoading, error } = useTournament();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (authLoading || tournamentLoading) return;
    if (user && !selectedTournament && !error) {
      router.replace("/?pick=1");
    }
  }, [authLoading, tournamentLoading, user, selectedTournament, error, router]);

  if (authLoading || tournamentLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center font-medium text-gray-500">
        {t("loading")}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title={t("couldNotLoadDashboard")}
        description={error}
        action={{ label: t("home"), href: "/" }}
      />
    );
  }

  if (!selectedTournament) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center font-medium text-gray-500">
        {t("loading")}
      </div>
    );
  }

  return <>{children}</>;
}
