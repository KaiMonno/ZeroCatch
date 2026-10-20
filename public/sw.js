/*
 * ZeroCatch offline support. Hand-written and dependency-free.
 *
 * - Feed pages ("/", "/?tab=trials", ...): network first, saved copy when
 *   offline. Both tabs are saved at install so they work offline right away.
 * - Build assets (/_next/static, hashed and immutable) and icons: cache first.
 * - Anything personal or with side effects (/account, /login, /auth, /admin,
 *   /api) is never cached; offline, those show the offline page.
 * - Only GET navigations and assets are handled. Next.js's own requests
 *   (RSC, Server Actions, its HEAD connectivity checks) always hit the network,
 *   so `experimental.useOffline` can tell when the connection is back.
 *
 * Bump VERSION when this file's caching rules change; old caches are dropped.
 */
const VERSION = "v1";
const PAGES = `zc-pages-${VERSION}`;
const ASSETS = `zc-assets-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = ["/", "/?tab=trials", OFFLINE_URL];
const MAX_PAGES = 30;
const MAX_ASSETS = 400;
const NETWORK_TIMEOUT_MS = 4000;
/** Header recording when a page copy was saved (read by the offline banner). */
const SAVED_AT = "x-zc-saved-at";

const isSavedPage = (url) => url.pathname === "/" || url.pathname === "/what-qualifies" || url.pathname === OFFLINE_URL;
const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  ["/manifest.webmanifest", "/icon.png", "/apple-icon.png"].includes(url.pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // One failed page shouldn't block installing the rest.
      await Promise.allSettled(PRECACHE.map((path) => savePage(new Request(path, { credentials: "same-origin" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS]);
      for (const name of await caches.keys()) if (name.startsWith("zc-") && !keep.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out: saved pages reflect that person's claims and hidden vendors.
  if (event.data?.type === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(isSavedPage(url) ? networkFirst(event) : fetch(request).catch(toOfflinePage));
  } else if (isAsset(url)) {
    event.respondWith(cacheFirst(event));
  }
});

async function networkFirst(event) {
  const { request } = event;
  const saved = await caches.match(request, { cacheName: PAGES, ignoreVary: true });
  try {
    const response = await withTimeout(fetch(request), saved ? NETWORK_TIMEOUT_MS : 0);
    if (isCacheable(response)) event.waitUntil(store(PAGES, request, response.clone(), MAX_PAGES, true));
    return response;
  } catch {
    // Offline (or too slow with a copy on hand): the last saved copy of this exact view.
    if (saved) return saved;
    const url = new URL(request.url);
    return url.pathname === OFFLINE_URL ? Response.error() : toOfflinePage();
  }
}

async function cacheFirst(event) {
  const { request } = event;
  const hit = await caches.match(request, { cacheName: ASSETS });
  if (hit) return hit;
  const response = await fetch(request);
  if (isCacheable(response)) event.waitUntil(store(ASSETS, request, response.clone(), MAX_ASSETS, false));
  return response;
}

async function savePage(request) {
  const response = await fetch(request);
  if (isCacheable(response)) await store(PAGES, request, response, MAX_PAGES, true);
}

/**
 * Redirect (not serve) to the offline page, so the address bar matches the
 * page: Next.js would otherwise notice the mismatch and try to fetch the
 * requested route, which can't work offline. /offline itself is a saved page.
 */
function toOfflinePage() {
  return Response.redirect(new URL(OFFLINE_URL, self.location.origin).href, 302);
}

/** Same-origin 200s that weren't redirected (a redirect means "not this page"). */
function isCacheable(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}

async function store(cacheName, request, response, maxEntries, stamp) {
  const cache = await caches.open(cacheName);
  let copy = response;
  if (stamp) {
    const html = await response.text();
    const headers = new Headers(response.headers);
    headers.set(SAVED_AT, String(Date.now()));
    copy = new Response(html, { status: response.status, statusText: response.statusText, headers });
    // A saved page is only usable offline with its scripts and styles, including
    // pages (like /offline) that were saved but never opened online.
    await saveAssets(html);
  }
  await cache.put(request, copy);
  // Oldest-first trim: keys() returns entries in insertion order.
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(old);
}

async function saveAssets(html) {
  const cache = await caches.open(ASSETS);
  const urls = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) ?? []);
  await Promise.allSettled(
    [...urls].map(async (path) => {
      if (await cache.match(path)) return;
      const response = await fetch(path);
      if (isCacheable(response)) await cache.put(path, response);
    }),
  );
}

function withTimeout(promise, ms) {
  if (!ms) return promise;
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}
