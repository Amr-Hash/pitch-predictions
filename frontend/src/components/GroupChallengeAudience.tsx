"use client";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";

const AUDIENCE: { key: MessageKey; icon: string }[] = [
  { key: "challengeFriends", icon: "🤝" },
  { key: "challengeFamily", icon: "👨‍👩‍👧‍👦" },
  { key: "challengeCoworkers", icon: "💼" },
  { key: "challengeNeighbors", icon: "🏘️" },
];

type Variant = "dark" | "light";

interface Props {
  variant?: Variant;
  className?: string;
}

export function GroupChallengeAudience({ variant = "dark", className = "" }: Props) {
  const t = useT();
  const chipClass =
    variant === "dark"
      ? "border-white/20 bg-white/10 text-white backdrop-blur-sm"
      : "border-royal-200 bg-white text-night-800 shadow-sm";

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 sm:justify-start ${className}`}
      role="list"
      aria-label={t("groupsChallengeAudience")}
    >
      {AUDIENCE.map(({ key, icon }) => (
        <span
          key={key}
          role="listitem"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${chipClass}`}
        >
          <span aria-hidden>{icon}</span>
          {t(key)}
        </span>
      ))}
    </div>
  );
}
