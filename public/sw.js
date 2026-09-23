/* Couple Finance Control — offline shell (FIN-01).
   All data lives in IndexedDB (Dexie); this worker only keeps the app
   shell available with no connectivity.

   BUILD_ID and ASSETS are injected at build time by the `cfc-pwa-precache`
   plugin in vite.config.js: ASSETS becomes the list of hashed build outputs
   (JS, CSS, fonts, icons) and BUILD_ID a hash of that list, so a new build
   always gets a fresh cache. The `typeof` guards keep this file valid if it is
   ever served straight out of public/ without the injection step. */
const BUILD_ID = typeof __CFC_BUILD__ !== "undefined" ? __CFC_BUILD__ : "dev";
const ASSETS = typeof __CFC_ASSETS__ !== "undefined" ? __CFC_ASSETS__ : [];

const CACHE = "cfc-shell-" + BUILD_ID;
const SHELL = ["./", "./index.html", "./manifest.webmanifest"].concat(ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Precache the shell and every hashed build asset. Entries are added
      // individually so one stale path cannot abort the whole install.
      await Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* an unavailable optional asset must not break install */
          })
        )
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
