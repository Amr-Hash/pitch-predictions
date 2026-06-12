"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AppNotification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/lib/i18n";
import { formatNotificationText } from "@/lib/notificationText";

export function NotificationBell() {
  const { token } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getNotifications(token, { limit: 8 });
      setItems(data.results);
      setUnreadCount(data.unread_count);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

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

  if (!token) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) loadNotifications();
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
        aria-label={t("notifications")}
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-gold-500 px-1 py-0.5 text-[10px] font-bold text-night-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-night-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-bold text-white">{t("notifications")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-gold-400 hover:text-gold-300"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-white/60">{t("loading")}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-white/60">{t("noNotifications")}</p>
            ) : (
              <ul>
                {items.map((notification) => (
                  <li key={notification.id} className="border-b border-white/5 last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (!notification.is_read) markRead(notification.id);
                      }}
                      className={`w-full px-4 py-3 text-start text-sm transition hover:bg-white/5 ${
                        notification.is_read ? "text-white/70" : "text-white"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!notification.is_read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-400" />
                        )}
                        <span className={notification.is_read ? "" : "font-medium"}>
                          {formatNotificationText(notification, locale)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-white/10 px-4 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-gold-400 hover:text-gold-300"
            >
              {t("notifications")} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
