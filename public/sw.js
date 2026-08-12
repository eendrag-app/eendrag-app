// The service worker. Hand-written and deliberately tiny — no next-pwa, no
// Workbox, nothing that generates a cache manifest at build time.
//
// It exists for two reasons and does nothing else:
//
//   1. A browser will not offer "install" without a service worker that has a
//      fetch handler. Ours passes every request straight to the network.
//   2. Web push is only delivered to a service worker. The `push` and
//      `notificationclick` handlers below are what make a notification appear
//      on a phone (v1.1 — the server side lands with the push channel).
//
// IT CACHES NOTHING, ON PURPOSE. A stale cache in a res announcement app is
// worse than a slow one: someone reads yesterday's notice about tonight's
// meeting. Next.js already caches its own static assets with immutable
// headers, which is the part that actually matters for speed.
//
// If you ever do add caching here: never cache HTML documents or anything
// under /api, and bump CACHE_VERSION so old entries are dropped on activate.

const CACHE_VERSION = "eendrag-v1";

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop anything a previous version of this file may have cached.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Straight passthrough. Present only because the install criteria require a
  // fetch handler to exist.
  event.respondWith(fetch(event.request));
});

// --- push -------------------------------------------------------------------

self.addEventListener("push", (event) => {
  // The payload is written by src/core/notifications/channels.ts. Anything
  // else arriving here is either a test from the browser devtools or a bug, so
  // fall back to something honest rather than throwing.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Eendrag", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Eendrag";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Grouping by category means five sport notifications do not become five
      // separate lines on a lock screen.
      tag: payload.tag || "eendrag",
      renotify: Boolean(payload.tag),
      requireInteraction: Boolean(payload.urgent),
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      // Focus a tab that already has the app open rather than opening a
      // second one — the usual behaviour people expect from an installed app.
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
