const CACHE = "drc-shell-v3";
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "/",
          "/icon.svg",
          "/manifest.webmanifest",
          "/fonts/noto-thai-400.ttf",
          "/fonts/noto-thai-500.ttf",
          "/fonts/noto-thai-600.ttf",
          "/fonts/noto-thai-700.ttf",
        ]),
      )
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.includes("/auth/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then(
            (cached) =>
              cached ||
              (event.request.mode === "navigate"
                ? caches.match("/")
                : new Response("ไม่สามารถโหลดขณะออฟไลน์", { status: 503 })),
          ),
      ),
  );
});
