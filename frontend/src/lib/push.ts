import { api } from "@/lib/api";

const PUSH_DISMISS_KEY = "alhabeed_push_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  ) {
    return true;
  }
  return false;
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

export function isNotificationPermissionGranted(): boolean {
  return pushSupported() && Notification.permission === "granted";
}

export function isNotificationPermissionDenied(): boolean {
  return pushSupported() && Notification.permission === "denied";
}

export async function subscribeToPush(token: string): Promise<boolean> {
  if (!pushSupported()) return false;

  const { public_key, configured } = await api.getPushVapidPublicKey();
  if (!configured || !public_key) return false;

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    }));

  const json = subscription.toJSON();
  const keys = json.keys;
  if (!keys?.p256dh || !keys.auth) return false;

  await api.subscribePush(token, {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
  dismissPushPrompt();
  return true;
}

export function shouldOfferPushPrompt(): boolean {
  if (!pushSupported()) return false;
  if (isNotificationPermissionDenied()) return false;
  if (isNotificationPermissionGranted()) return false;
  if (localStorage.getItem(PUSH_DISMISS_KEY) === "1") return false;
  return true;
}

export function dismissPushPrompt() {
  localStorage.setItem(PUSH_DISMISS_KEY, "1");
}
