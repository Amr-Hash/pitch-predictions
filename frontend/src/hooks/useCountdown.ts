"use client";

import { useEffect, useState } from "react";

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function computeCountdown(target: Date): CountdownParts {
  const totalMs = target.getTime() - Date.now();
  if (totalMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs, days, hours, minutes, seconds, expired: false };
}

export function useCountdown(kickoffIso: string | null | undefined): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() =>
    kickoffIso ? computeCountdown(new Date(kickoffIso)) : computeCountdown(new Date(0))
  );

  useEffect(() => {
    if (!kickoffIso) return;
    const target = new Date(kickoffIso);
    const tick = () => setParts(computeCountdown(target));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [kickoffIso]);

  return parts;
}
