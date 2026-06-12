"use client";

import { useT } from "@/lib/i18n";

export function LoadingScreen({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <div className={`text-center text-gray-500 ${className}`.trim()}>{t("loading")}</div>
  );
}
