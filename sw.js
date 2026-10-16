/**
 * Service Worker — 全球黄页 PWA 离线缓存
 *
 * 策略：
 * · HTML 页面：网络优先（保证更新即时可见），离线时回退缓存
 * · 静态资源（css/js/图标）：缓存优先，后台更新（stale-while-revalidate）
 * · 跨域截图服务（wordpress/microlink）：不缓存，直接透传
 *
 * 升级方式：改动本文件时把 CACHE 版本 号 +1，旧缓存自动清理。
 */
const CACHE = 'gyp-v2';

const PRECACHE = [
  './',
  './index.html',
  './index-v2.html',
  './legal.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/style-v2.css',
  './assets/js/data.js',
  './assets/js/antiabuse.js',
  './assets/js/vault.js',
  './assets/js/thumbs.js',
  './assets/js/i18n.js',
  './assets/js/app.js',
  './assets/js/app-v2.js',
  './assets/img/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（截图/图标服务）不介入
  if (url.pathname.indexOf('/api/') === 0) return; // 留言接口不缓存、不介入

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    // 页面：网络优先，失败回退缓存
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先 + 后台更新
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
