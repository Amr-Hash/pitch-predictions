"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pushSupported, subscribeToPush } from "@/lib/push";

export function PushNotificationRegistrar() {
  const { token } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    api
      .getPushVapidPublicKey()
      .then((data) => setPushEnabled(Boolean(data.configured && data.public_key)))
      .catch(() => setPushEnabled(false));
  }, []);

  useEffect(() => {
    if (!token || !pushEnabled || !pushSupported()) return;
    if (Notification.permission === "granted") {
      subscribeToPush(token).catch(() => undefined);
    }
  }, [token, pushEnabled]);

  return null;
}
