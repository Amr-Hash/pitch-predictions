"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import {
  dismissPushPrompt,
  pushSupported,
  shouldOfferPushPrompt,
  subscribeToPush,
} from "@/lib/push";

const INSTALL_DISMISS_KEY = "alhabeed_install_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
}

function isMobileDevice(): boolean {
  return isIos() || isAndroid();
}

export function PwaProvider() {
  const t = useT();
  const { token } = useAuth();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [standalone, setStandalone] = useState(() => isStandalone());
  const [installDismissed, setInstallDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !pushSupported()) return "default";
    return Notification.permission;
  });
  const [enabling, setEnabling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refreshState = useCallback(() => {
    if (typeof window === "undefined") return;
    setStandalone(isStandalone());
    setInstallDismissed(localStorage.getItem(INSTALL_DISMISS_KEY) === "1");
    if (pushSupported()) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    refreshState();

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", refreshState);
    document.addEventListener("visibilitychange", refreshState);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", refreshState);
      document.removeEventListener("visibilitychange", refreshState);
    };
  }, [refreshState]);

  useEffect(() => {
    if (!pushSupported()) return;
    api
      .getPushVapidPublicKey()
      .then((data) => setPushConfigured(Boolean(data.configured && data.public_key)))
      .catch(() => setPushConfigured(false));
  }, []);

  const showInstall =
    isMobileDevice() &&
    !standalone &&
    !installDismissed &&
    (Boolean(installEvent) || isIos() || isAndroid());

  const canOfferNotifications =
    pushConfigured &&
    pushSupported() &&
    notificationPermission === "default" &&
    shouldOfferPushPrompt() &&
    (!isIos() || standalone);

  const showNotifications = canOfferNotifications;

  if (dismissed || (!showInstall && !showNotifications)) {
    return null;
  }

  const installHint = (() => {
    if (installEvent) return t("installAppHint");
    if (isIos()) return t("installAppIosHint");
    if (isAndroid()) return t("installAppAndroidHint");
    return t("installAppHint");
  })();

  const dismiss = () => {
    if (showInstall) {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      setInstallDismissed(true);
    }
    if (showNotifications) {
      dismissPushPrompt();
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setInstallDismissed(true);
    setInstallEvent(null);
    refreshState();
  };

  const enableNotifications = async () => {
    if (!token) return;
    setEnabling(true);
    try {
      const ok = await subscribeToPush(token);
      if (ok) {
        setNotificationPermission("granted");
      } else {
        dismissPushPrompt();
      }
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="install-banner safe-bottom fixed inset-x-0 bottom-[4.5rem] z-40 mx-3 md:bottom-4 md:mx-auto md:max-w-lg">
      <div className="rounded-2xl border border-white/20 bg-night-900 p-4 text-white shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>
            {showInstall ? "📲" : "🔔"}
          </span>
          <div className="min-w-0 flex-1">
            {showInstall ? (
              <div>
                <p className="font-bold">{t("installApp")}</p>
                <p className="mt-1 text-sm text-white/80">{installHint}</p>
              </div>
            ) : null}

            {showNotifications ? (
              <div className={showInstall ? "mt-4 border-t border-white/10 pt-4" : undefined}>
                <p className="font-bold">{t("enableNotificationsTitle")}</p>
                <p className="mt-1 text-sm text-white/80">{t("enableNotificationsHint")}</p>
              </div>
            ) : showInstall ? (
              <p className="mt-3 text-sm text-white/70">{t("installAppNotificationsNote")}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {showInstall && installEvent ? (
                <button type="button" onClick={install} className="btn-fan text-sm">
                  {t("installNow")}
                </button>
              ) : null}
              {showNotifications && token ? (
                <button
                  type="button"
                  onClick={enableNotifications}
                  disabled={enabling}
                  className="btn-fan text-sm disabled:opacity-60"
                >
                  {enabling ? t("loading") : t("enableNotifications")}
                </button>
              ) : null}
            </div>
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
    </div>
  );
}
