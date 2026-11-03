// [MODULE] sw | Service worker: precache the app so the installed PWA runs offline; serve the kanji library cache too
// [IFACE] layer: infrastructure | in: install/activate/fetch events -> out: cached responses | crosses: [Cache Storage API]
// [GRAPH] needs: [] | feeds: [main] | group: infrastructure
// [STATE] stateful | persists: Cache Storage bucket named by CACHE_NAME | raises: nothing

/**
 * Cache-first for everything: the app is a fixed set of static files and the
 * learner's data lives in localStorage, never here.
 *
 * Two kinds of bucket:
 *   CACHE_NAME                  the app files below, replaced on every release
 *   hino-lite-library-<version> the kanji library, written by js/kanji/library.js
 *                               on the first Kanji-tab visit; this worker only
 *                               reads it and never deletes it (library.js drops
 *                               old versions itself), so app updates do not
 *                               download the library again.
 *
 * BUMP CACHE_NAME whenever a file in ASSETS changes, otherwise installed
 * copies keep serving the old bundle forever: cache-first never revalidates.
 */
var CACHE_NAME = 'hino-lite-app-v4';
var LIBRARY_PREFIX = 'hino-lite-library-';

var ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'css/app.css',
  'css/review.css',
  'css/words.css',
  'css/sentences.css',
  'css/kanji.css',
  'js/main.js',
  'js/core/backup.js',
  'js/core/dom.js',
  'js/core/romaji.js',
  'js/core/shell.js',
  'js/core/storage.js',
  'js/core/theme.js',
  'js/kana/kana-data.js',
  'js/kana/kana-srs.js',
  'js/kana/kana-ui.js',
  'js/review/review.js',
  'js/review/review-ui.js',
  'js/words/words.js',
  'js/words/words-ui.js',
  'js/sentences/sentences.js',
  'js/sentences/sentences-ui.js',
  'js/kanji/kanji-index.js',
  'js/kanji/kanji.js',
  'js/kanji/library.js',
  'js/kanji/kanji-card.js',
  'js/kanji/kanji-ui.js',
  'js/settings/settings-ui.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // 'reload' skips the HTTP cache, so an update never precaches a stale copy of a file.
      .then(function (cache) {
        return cache.addAll(ASSETS.map(function (url) { return new Request(url, { cache: 'reload' }); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        var keep = name === CACHE_NAME || name.indexOf(LIBRARY_PREFIX) === 0;
        return keep ? null : caches.delete(name);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(event.request).catch(function () {
        return event.request.mode === 'navigate' ? caches.match('index.html') : Response.error();
      });
    })
  );
});
