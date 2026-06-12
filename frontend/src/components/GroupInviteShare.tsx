"use client";

import { useState } from "react";
import { groupInviteUrl } from "@/lib/groupInvite";
import { useT } from "@/lib/i18n";

interface Props {
  inviteCode: string;
  /** Stop click propagation when nested inside links or cards. */
  isolateClicks?: boolean;
  className?: string;
  variant?: "dark" | "light";
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function GroupInviteShare({
  inviteCode,
  isolateClicks = false,
  className = "",
  variant = "light",
}: Props) {
  const t = useT();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const code = inviteCode.toUpperCase();
  const isDark = variant === "dark";

  const wrapClick = (handler: () => void) => (e: React.MouseEvent) => {
    if (isolateClicks) {
      e.preventDefault();
      e.stopPropagation();
    }
    handler();
  };

  const copyCode = async () => {
    await copyToClipboard(code);
    setCopied("code");
    setTimeout(() => setCopied(null), 2000);
  };

  const copyLink = async () => {
    await copyToClipboard(groupInviteUrl(code));
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  };

  const codeClass = isDark
    ? "rounded-lg bg-white/15 px-2.5 py-1 font-mono text-sm font-bold text-gold-300"
    : "rounded-lg bg-night-900 px-2.5 py-1 font-mono text-sm font-bold text-gold-400";

  const btnClass = isDark
    ? "rounded-lg border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/20"
    : "rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-night-700 transition hover:border-royal-300 hover:bg-royal-50";

  return (
    <div className={className} onClick={isolateClicks ? (e) => e.stopPropagation() : undefined}>
      <p className={`mb-2 text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-500"}`}>
        {t("inviteCode")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className={codeClass}>{code}</code>
        <button type="button" className={btnClass} onClick={wrapClick(copyCode)}>
          {copied === "code" ? t("copied") : t("copyCode")}
        </button>
        <button type="button" className={btnClass} onClick={wrapClick(copyLink)}>
          {copied === "link" ? t("copied") : t("copyInviteLink")}
        </button>
      </div>
    </div>
  );
}
