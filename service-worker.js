'use strict';

// BEGIN RELEASE
const release = {
  "version": "7309dba4a90c749e06da6a6387c23e8370502af228c116b3e99310cf82411a2a",
  "assets": {
    "./": "8dc47a68f04b4e3f030eaf017dfcf145124ba9e0878ea3fea5d41f0b2bbe3e07",
    "styles.css": "dd2282c228bdd2c0abe4440b426f74fcbd603b9541a7c79cd661f72a65ad2612",
    "app.js": "c7e8ed15746636b7b7a27bbbb81e9b12285f91ee21340eb1dae9297935d81d13",
    "translations.js": "b0c43b19d1a3fe0efb8301d27fedd2d0acf14080c172142ab8be3842b747a643",
    "manifest.webmanifest": "7549834c671b4b2ac02e396763662d6db25ca2dcd9ed2030860465ae7781e543",
    "icons/icon-192.png": "e1376962114fb45282344aba6d7afcf77e7fa21dc46479423b450a721c381e07",
    "icons/icon-512.png": "6a46806c1cfb12b7b5ceee3b5b9dcfc3eccb1077b341181fdd3f2e9a99dab9ed",
    "icons/apple-touch-icon.png": "0d43488ed43eb6aab23c33241b5bb4c5afd22c912be9e914c8ce04cc7ba68f4d"
  }
};
// END RELEASE

const scope = self.registration.scope;
const cachePrefix = `pushup-tracker:${scope}:`;
const cacheName = cachePrefix + release.version;
const assets = new Map(Object.entries(release.assets)
  .map(([path, digest]) => [new URL(path, scope).href, digest]));

async function fetchVerified(url, expected) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error(`Cannot fetch ${url}`);

  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== expected) throw new Error(`Unexpected content for ${url}`);
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Verify the whole release before writing its cache.
    const responses = await Promise.all([...assets].map(async ([url, digest]) =>
      [url, await fetchVerified(url, digest)]));
    const cache = await caches.open(cacheName);
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  url.search = '';
  const key = url.href === new URL('index.html', scope).href && request.mode === 'navigate'
    ? scope
    : url.href;
  if (!assets.has(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(key);
    if (cached) return cached;
    try {
      const response = await fetchVerified(key, assets.get(key));
      await cache.put(key, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
