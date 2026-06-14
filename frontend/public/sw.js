const CACHE_VERSION = "alhabeed-v5";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_ASSETS = [
  "/",
  "/scoring",
  "/dashboard",
  "/manifest.webmanifest",
  "/logo.svg",
  "/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("alhabeed-") && key !== SHELL_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let title = "alhabeed";
  let body = "";
  let url = "/dashboard";

  try {
    const data = event.data ? event.data.json() : {};
    title = data.title || title;
    body = data.body || body;
    url = data.url || url;
  } catch {
    body = event.data ? event.data.text() : body;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      silent: false,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin) || !("focus" in client)) continue;
        if ("navigate" in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
        client.focus();
        return undefined;
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

function resolveNotificationUrl(raw) {
  const fallback = "/dashboard";
  if (!raw) return new URL(fallback, self.location.origin).href;
  try {
    const parsed = new URL(raw, self.location.origin);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, self.location.origin).href;
    }
    return parsed.href;
  } catch {
    const path = typeof raw === "string" && raw.startsWith("/") ? raw : fallback;
    return new URL(path, self.location.origin).href;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok || url.origin !== self.location.origin) return response;
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
