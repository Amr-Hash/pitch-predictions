"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import {
  dismissPushPrompt,
  hasActivePushSubscription,
  isAppInstalled,
  isNotificationPermissionGranted,
  pushSupported,
  shouldOfferPushPrompt,
  subscribeToPush,
} from "@/lib/push";

const INSTALL_DISMISS_KEY = "alhabeed_install_dismissed";
const PUSH_DISMISS_KEY = "alhabeed_push_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

function isPromptRoute(pathname: string): boolean {
  return (
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/admin")
  );
}

type CompactPromptProps = {
  icon: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onDismiss: () => void;
  dismissLabel: string;
};

function CompactPrompt({
  icon,
  message,
  actionLabel,
  onAction,
  actionDisabled,
  onDismiss,
  dismissLabel,
}: CompactPromptProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-night-900/95 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-md">
      <span className="shrink-0 text-base" aria-hidden>
        {icon}
      </span>
      <p className="min-w-0 flex-1 text-white/80">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="shrink-0 rounded-lg bg-gold-500 px-2.5 py-1 text-xs font-bold text-night-900 disabled:opacity-60"
        >
          {actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white"
        aria-label={dismissLabel}
      >
        ✕
      </button>
    </div>
  );
}

export function PwaProvider() {
  const t = useT();
  const pathname = usePathname();
  const { token, loading } = useAuth();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [installed, setInstalled] = useState(() => isAppInstalled());
  const [installDismissed, setInstallDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  });
  const [notificationDismissed, setNotificationDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(PUSH_DISMISS_KEY) === "1";
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !pushSupported()) return "default";
    return Notification.permission;
  });
  const [hasPushSubscription, setHasPushSubscription] = useState<boolean | null>(null);
  const [enabling, setEnabling] = useState(false);

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined") return;
    setInstalled(isAppInstalled());
    setInstallDismissed(localStorage.getItem(INSTALL_DISMISS_KEY) === "1");
    setNotificationDismissed(localStorage.getItem(PUSH_DISMISS_KEY) === "1");
    if (pushSupported()) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "granted") {
        setHasPushSubscription(await hasActivePushSubscription());
      } else {
        setHasPushSubscription(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshState();

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      setInstallDismissed(true);
      setInstallEvent(null);
      void refreshState();
    };
    const onVisibilityChange = () => {
      void refreshState();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshState]);

  useEffect(() => {
    if (!pushSupported()) return;
    api
      .getPushVapidPublicKey()
      .then((data) => setPushConfigured(Boolean(data.configured && data.public_key)))
      .catch(() => setPushConfigured(false));
  }, []);

  useEffect(() => {
    if (!token) {
      setHasPushSubscription(null);
      return;
    }
    void refreshState();
  }, [token, refreshState]);

  const showInstall =
    Boolean(token) &&
    !loading &&
    isPromptRoute(pathname) &&
    isMobileDevice() &&
    !installed &&
    !installDismissed &&
    (Boolean(installEvent) || isIos() || isAndroid());

  const showNotifications =
    Boolean(token) &&
    !loading &&
    isPromptRoute(pathname) &&
    pushConfigured &&
    pushSupported() &&
    shouldOfferPushPrompt() &&
    !notificationDismissed &&
    !isNotificationPermissionGranted() &&
    hasPushSubscription !== true &&
    (!isIos() || installed);

  if (!showInstall && !showNotifications) {
    return null;
  }

  const installHint = (() => {
    if (installEvent) return t("installAppHintShort");
    if (isIos()) return t("installAppIosHintShort");
    if (isAndroid()) return t("installAppAndroidHintShort");
    return t("installAppHintShort");
  })();

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setInstallDismissed(true);
  };

  const dismissNotifications = () => {
    dismissPushPrompt();
    setNotificationDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setInstallDismissed(true);
    setInstallEvent(null);
    await refreshState();
  };

  const enableNotifications = async () => {
    if (!token) return;
    setEnabling(true);
    try {
      const ok = await subscribeToPush(token);
      if (ok) {
        setNotificationPermission("granted");
        setHasPushSubscription(true);
        setNotificationDismissed(true);
      } else {
        dismissPushPrompt();
        setNotificationDismissed(true);
        await refreshState();
      }
    } finally {
      setEnabling(false);
    }
  };

  const bottomClass =
    "fixed inset-x-0 bottom-[4.5rem] z-40 space-y-2 px-3 md:bottom-4 md:mx-auto md:max-w-lg";

  return (
    <div className={bottomClass}>
      {showInstall ? (
        <CompactPrompt
          icon="📲"
          message={installHint}
          actionLabel={installEvent ? t("installNow") : undefined}
          onAction={installEvent ? install : undefined}
          onDismiss={dismissInstall}
          dismissLabel={t("dismiss")}
        />
      ) : null}
      {showNotifications ? (
        <CompactPrompt
          icon="🔔"
          message={t("enableNotificationsHintShort")}
          actionLabel={enabling ? t("loading") : t("enableNotifications")}
          onAction={enableNotifications}
          actionDisabled={enabling}
          onDismiss={dismissNotifications}
          dismissLabel={t("dismiss")}
        />
      ) : null}
    </div>
  );
}
