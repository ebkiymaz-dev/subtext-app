// Subtext — minimal offline shell. No analytics, no third-party requests,
// and no caching of anything you paste. A conversation enters local storage
// only when the user explicitly saves it to their optional private archive.
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const CACHE = "subtext-shell-v13";
const SHELL = [
  BASE + "/",
  BASE + "/plans",
  BASE + "/privacy",
  BASE + "/archive",
  BASE + "/manifest.webmanifest",
  BASE + "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Activation must not be held hostage by one optional shell file. A
      // failed precache previously allowed an obsolete worker to survive on
      // an otherwise-online Android TWA.
      self.skipWaiting();
      try {
        const cache = await caches.open(CACHE);
        await Promise.allSettled(SHELL.map((url) => cache.add(url)));
      } catch {
        // Online navigation remains fully functional without the shell cache.
      }
    })()
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
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  const networkRequest = request.mode === "navigate"
    ? new Request(request, { cache: "reload" })
    : request;
  event.respondWith(
    fetch(networkRequest)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match(BASE + "/")))
  );
});
