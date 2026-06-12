"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type AppNotification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";
import { formatNotificationText } from "@/lib/notificationText";

export default function NotificationsPage() {
  const { token, loading: authLoading } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications(token, { limit: 100 });
      setItems(data.results);
      setUnreadCount(data.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tryAgain"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (!authLoading && token) load();
  }, [authLoading, token, load]);

  const markRead = async (id: number) => {
    if (!token) return;
    await api.markNotificationRead(token, id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!token) return;
    await api.markAllNotificationsRead(token);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  if (authLoading) {
    return <div className="fan-page py-10 text-center text-night-600">{t("loading")}</div>;
  }

  if (!token) {
    return (
      <div className="fan-page py-10 text-center">
        <p className="text-night-600">{t("login")}</p>
        <Link href="/login" className="btn-fan mt-4 inline-block">
          {t("login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="fan-page mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-night-900">{t("notifications")}</h1>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="btn-secondary text-sm">
            {t("markAllRead")}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-night-500">{t("loading")}</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <div className="fan-card p-8 text-center text-night-500">{t("noNotifications")}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => {
                  if (!notification.is_read) markRead(notification.id);
                }}
                className={`fan-card w-full p-4 text-start transition ${
                  notification.is_read ? "opacity-80" : "ring-2 ring-gold-300/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!notification.is_read && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-night-800">
                      {formatNotificationText(notification, locale)}
                    </p>
                    <p className="mt-2 text-xs text-night-400">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
