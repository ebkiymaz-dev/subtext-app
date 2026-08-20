// Subtext — minimal offline shell. No analytics, no third-party requests,
// and no caching of anything you paste (the app never persists raw text).
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const CACHE = "subtext-shell-v7";
const SHELL = [
  BASE + "/",
  BASE + "/plans",
  BASE + "/privacy",
  BASE + "/manifest.webmanifest",
  BASE + "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match(BASE + "/")))
  );
});
