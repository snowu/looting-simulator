// Offline service worker. Not bundled: vite.config.ts copies it to sw.js at
// build time, filling in the build id and the list of every file the build
// shipped, so one install downloads the whole game and it plays with no
// connection from then on.
/* eslint-disable no-restricted-globals */

const BUILD_ID = __SW_BUILD_ID__;
const PRECACHE = __SW_PRECACHE__;
const FONT_CSS = __SW_FONT_CSS__;

const PREFIX = 'looting-sim-';
const BUILD_CACHE = `${PREFIX}build-${BUILD_ID}`;
// Fonts outlive builds: the same files serve every version.
const FONT_CACHE = `${PREFIX}fonts`;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL('./', SCOPE).href;
// Past this, a navigation stops waiting on a bad connection and boots the cached game.
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(BUILD_CACHE);
      // `reload` skips the HTTP cache, so a stale copy of an unhashed file
      // (art PNGs, the art pack) cannot end up in this build's set.
      await cache.addAll(PRECACHE.map((path) => new Request(new URL(path, SCOPE), { cache: 'reload' })));
      await cacheFonts().catch(() => {});
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(`${PREFIX}build-`) && k !== BUILD_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(fontResponse(req));
    return;
  }
  // Other hosts (cloud saves) and anything outside the game stay untouched.
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  // The update check must always ask the network.
  if (url.pathname.endsWith('/version.json')) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigation(req));
    return;
  }
  event.respondWith(asset(req));
});

/** The page: fresh from the network when it answers in time, else the cached build. */
async function navigation(req) {
  const network = fetch(req);
  try {
    const res = await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
    ]);
    if (res.ok) return res;
  } catch {
    // offline or too slow: fall through to the cache
  }
  const cached = await caches.match(INDEX, { cacheName: BUILD_CACHE, ignoreSearch: true, ignoreVary: true });
  return cached || network;
}

/**
 * Game files: from this build's cache. Art URLs carry `?v=<build>`, which the
 * cache keys leave out, so the search is ignored; the cache is per build already.
 * Vary is ignored too: hosts send `Vary: Origin`, and the install request
 * carried no Origin while the page's module scripts do.
 */
async function asset(req) {
  const cached = await caches.match(req, { cacheName: BUILD_CACHE, ignoreSearch: true, ignoreVary: true });
  return cached || fetch(req);
}

/** Fonts: cached copy first, refreshed in the background when online. */
async function fontResponse(req) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) void cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (cached) return cached;
  return (await refresh) || Response.error();
}

/** Pull the font stylesheet and every font file it names, so the first offline boot has them. */
async function cacheFonts() {
  if (!FONT_CSS) return;
  const cache = await caches.open(FONT_CACHE);
  const res = await fetch(FONT_CSS, { mode: 'cors' });
  if (!res.ok) return;
  const css = await res.clone().text();
  await cache.put(FONT_CSS, res);
  const files = [...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]);
  await Promise.all(
    files.map(async (file) => {
      if (await cache.match(file)) return;
      const font = await fetch(file, { mode: 'cors' });
      if (font.ok) await cache.put(file, font);
    }),
  );
}
