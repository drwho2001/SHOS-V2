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
