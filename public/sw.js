/**
 * Ariko's service worker. It buys ONE thing — an offline page that is Ariko's
 * rather than the browser's — and is shaped so it cannot buy anything else.
 *
 * THE INVARIANT: nothing is written to the cache at runtime.
 *
 * The fetch handler returns without calling `respondWith` for anything that is
 * not a GET navigation, so the browser proceeds exactly as if no worker were
 * installed. Navigations go to the network every time; the cache is consulted
 * only when that fetch REJECTS. The cache therefore holds exactly the single
 * entry below, fixed at install, forever.
 *
 * That matters because this worker's scope is "/", which includes /admin. A
 * runtime cache under this scope could store an authenticated admin response
 * and serve it to the next request, or serve a page composed against a
 * pre-write garden after a publish. Neither is reachable if nothing is ever
 * written — which is a property `lib/pwa-source.test.ts` can check, where "be
 * careful what you cache" would not be.
 *
 * An offline GET navigation to /admin therefore renders the offline page. That
 * is correct: the alternative is a cached login form that posts into nothing.
 * A POST navigation is a different case and is deliberately left alone — see
 * the fetch handler.
 *
 * The offline page carries its mark as an inline <svg>, so it needs no
 * subresource: a precached image would be unreachable from an <img>, which
 * cannot read the Cache API, and would only render a broken glyph. That is why
 * PRECACHE has one entry and why widening the fetch handler to serve images —
 * the obvious "fix" — would trade the invariant for nothing.
 *
 * `skipWaiting` + `clients.claim` are safe here for the same reason they are
 * usually dangerous. The hazard is a new worker taking over clients holding
 * assets from the old build; this worker serves no assets.
 *
 * VERSION carries a digest of the precached bytes, and pwa-source.test.ts
 * recomputes it. Editing offline.html without bumping it would deploy a change
 * no already-installed browser ever sees.
 *
 * TO RECALL THIS WORKER: an installed worker outlives the decision that
 * shipped it, so deploy this file, in full, in its place. `/sw.js` is served
 * `Cache-Control: public, max-age=0`, so every client revalidates and takes it.
 *
 *   self.addEventListener("install", () => self.skipWaiting());
 *   self.addEventListener("activate", (e) => e.waitUntil(self.registration.unregister()));
 */
const VERSION = "ariko-ade7298db353";
const PRECACHE = ["/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // `cache: "reload"` so a stale HTTP cache entry cannot become a
      // permanently stale precache entry.
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Everything that is not a GET navigation is never seen by respondWith at
  // all — not intercepted and passed through, but untouched. ("Navigation"
  // here is the request mode, which covers a nested frame's navigation too;
  // Ariko embeds only cross-origin frames, governed by their own origins.)
  //
  // The method check makes the invariant STRICTER, not weaker. A form POST is
  // a navigation, and answering a failed one with a 200 offline page tells the
  // browser the submission SUCCEEDED: the payload is gone and no reload will
  // retry it. app/admin/login posts exactly that way before hydration. Left
  // alone, the browser shows its own error page, which keeps the retry.
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;

  // `caches.match` and not `caches.open(...).then(c => c.match(...))`: the
  // second form would put a `caches.open` outside the install handler, which
  // is the exact shape this worker's invariant forbids and its test rejects.
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});
