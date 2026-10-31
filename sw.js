// Bot Office service worker: keeps the app shell for offline use.
// - app shell (index, hashed assets, icons, manifest): precached at install,
//   cache-first; the cache name carries the build id, so a new build
//   replaces it and old caches are deleted on activate
// - page loads: network first, the cached shell when offline
// - office.json: network first, the cached copy when offline
// - /api, /ws, /avatars and anything cross-origin: never touched (the
//   private build is served by the Go server from the same files)
// The build fills in BUILD and SHELL (vite.config.js, sw-precache).
const BUILD = "41df76f89f4e";
const SHELL = ["./","./assets/index-CklnnvPU.js","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./manifest.webmanifest"];
const CACHE = 'botoffice-shell-' + BUILD;
const PACKS = 'botoffice-packs';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('botoffice-shell-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const scope = new URL(self.registration.scope);
function passThrough(url) {
  if (url.origin !== scope.origin) return true;
  const rel = url.pathname.slice(scope.pathname.length - 1); // keeps the leading '/'
  return /^\/(api|ws|avatars)(\/|$)/.test(rel) || /^\/(api|ws|avatars)(\/|$)/.test(url.pathname);
}

async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(fallbackKey || req.url.split('?')[0], res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackKey || req.url.split('?')[0], { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (passThrough(url)) return;
  if (url.pathname.endsWith('office.json')) { e.respondWith(networkFirst(req, PACKS)); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, CACHE, new URL('./', scope).href)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
