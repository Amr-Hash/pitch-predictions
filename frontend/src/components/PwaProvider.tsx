"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const INSTALL_DISMISS_KEY = "alhabeed_install_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider() {
  const t = useT();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(INSTALL_DISMISS_KEY) === "1") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const isIos =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !(window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (isIos) {
      setShowIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setHidden(true);
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    dismiss();
  };

  if (hidden) return null;

  return (
    <div className="install-banner safe-bottom fixed inset-x-0 bottom-[4.5rem] z-40 mx-3 md:bottom-4 md:mx-auto md:max-w-lg">
      <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-night-900 p-4 text-white shadow-2xl">
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t("installApp")}</p>
          <p className="mt-1 text-sm text-white/80">
            {showIosHint && !installEvent ? t("installAppIosHint") : t("installAppHint")}
          </p>
          {installEvent ? (
            <button type="button" onClick={install} className="btn-fan mt-3 text-sm">
              {t("installNow")}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-2 py-1 text-sm text-white/70 hover:bg-white/10"
          aria-label={t("dismiss")}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
