// sw.js — SHOS's own service worker, real ask: "ensure can be
// downloaded as pwa too." A registered service worker is one of the
// three real requirements for installability (alongside the manifest
// and HTTPS, which GitHub Pages already provides) and is what lets the
// installed app actually launch offline, matching this app's own
// local-only, offline-first identity.
//
// RUNTIME caching, not a build-time precache list: Vite's own output
// filenames are content-hashed (e.g. index-BqTDp20I.js) and change on
// every build, so a hand-written list of files to precache here would
// go stale the moment the next commit ships — a real, silent bug
// waiting to happen. Instead, this caches each file the FIRST time the
// browser actually requests it (during normal online use), so a full
// working copy of the app builds up naturally with zero maintenance
// and nothing to keep in sync with the build output.
const CACHE_NAME = "shos-runtime-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drops any previous cache version's leftovers (e.g. after a
  // CACHE_NAME bump) rather than letting old cached files accumulate
  // forever.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only ever handle real GET requests for this app's own origin —
  // never intercept cross-origin calls (Nominatim's geocoding lookup,
  // etc.) or non-GET requests, so this can't silently break anything
  // outside its own actual job.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Navigations (opening/reloading the app itself): network first, so
  // a real connection always gets the latest build, falling back to
  // the last cached copy of the app shell when offline — this is what
  // actually lets the installed app open with no signal at all.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(new URL(self.registration.scope))))
    );
    return;
  }

  // Every other same-origin GET (the hashed JS/CSS bundles, fonts,
  // icons): cache-first, since a content-hashed filename is
  // immutable by construction — the SAME URL never means different
  // content later, so serving a cached hit instantly and topping the
  // cache up in the background is both safe and correct, not just
  // fast.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ADDED 3 Sep 2026 — real ask: reminders (medication due, DoxyPEP,
// etc.) genuinely working on the web/installed-PWA build, not just the
// native Android app — see src/storage/notificationService.js's own
// header comment for the full reasoning. This is the other half of
// that: a service worker is the only thing that can show a real
// notification with action buttons (Take/Cancel/Snooze) on the web,
// AND the only thing that can react to one of those buttons being
// tapped — but a service worker has no access to this app's own data
// (no localStorage here, a completely separate execution context), so
// it can't log a dose or cancel a reminder itself. It can only RELAY
// the tap to a real page that can: if one is already open, `focus()`
// it and `postMessage` the action straight across, no reload; if none
// is open, `openWindow()` a fresh one with the action encoded in the
// URL (?notifAction=...), which notificationService.js's own
// addNotificationActionListener() reads once on startup — same real
// tap, just arriving via the URL instead of a live message because the
// page didn't exist yet to receive one.
self.addEventListener("notificationclick", (event) => {
  const action = event.action || "";
  event.notification.close();
  const scope = self.registration.scope;
  const targetUrl = action ? `${scope}?notifAction=${encodeURIComponent(action)}` : scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if (action) client.postMessage({ type: "shos-notification-action", action });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
