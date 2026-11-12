/* Swivel service worker: keeps the game's files on the device so it opens with no connection. */
'use strict';
var APP = 'swivel-app-f42c0a7aae';
var FONTS = 'swivel-fonts-v1';
var SHELL = ["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png","icon-maskable-512.png"];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(APP)
      // ask the server, not the browser's own cache, so an update is never a stale copy
      .then(function (cache) { return cache.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k !== APP && k !== FONTS && k.indexOf('swivel-') === 0 ? caches.delete(k) : null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // the game's own files: answer from the device, fall back to the network
    event.respondWith(
      caches.open(APP).then(function (cache) {
        return cache.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(function () {
            // any page of the app is the one page
            return req.mode === 'navigate' ? cache.match('./') : Response.error();
          });
        });
      })
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // the typeface: kept after its first download
    event.respondWith(
      caches.open(FONTS).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          });
        });
      })
    );
  }
});
