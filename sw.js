/**
 * Service Worker — 全球黄页 PWA 离线缓存
 *
 * 策略（重要：js/css 由「缓存优先」改为「网络优先」）：
 * · HTML 页面：网络优先，离线回退缓存
 * · JS / CSS：网络优先，离线回退缓存 —— 修过一次「两个皮肤数据对不上」的坑：
 *             缓存优先会把旧脚本长期钉在用户浏览器里，新版本永远到不了，
 *             某台机器就可能一直跑着旧逻辑（旧存储键 / 旧 DOM），表现为数据不共享。
 * · 图片 / manifest 等：缓存优先 + 后台更新（内容基本不变，省流量）
 * · 跨域请求（截图服务）、/api/ 接口：不介入
 *
 * 升级方式：改动本文件时把 CACHE 版本号 +1，旧缓存自动清理。
 */
const CACHE = 'gyp-v3';

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
  './assets/js/share.js',
  './assets/js/thumbs.js',
  './assets/js/i18n.js',
  './assets/js/app.js',
  './assets/js/app-v2.js',
  './assets/img/icon.svg'
];

const CODE_RE = /\.(?:js|css)$/i;

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
        if (k !== CACHE) return caches.delete(k);   // 清理旧版本缓存，避免新旧脚本混用
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/** 允许页面主动触发立即生效 */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** 网络优先，失败回退缓存 */
function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.status === 200 && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit; });
  });
}

/** 缓存优先 + 后台更新 */
function staleWhileRevalidate(req) {
  return caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（截图/图标服务）不介入
  if (url.pathname.indexOf('/api/') === 0) return; // 留言接口不缓存、不介入

  var isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isHtml) {
    e.respondWith(
      networkFirst(req).then(function (res) {
        if (res) return res;
        return caches.match('./index.html');
      })
    );
    return;
  }

  // JS / CSS 必须拿最新的：旧脚本会让两个皮肤的数据逻辑不一致
  if (CODE_RE.test(url.pathname)) {
    e.respondWith(networkFirst(req));
    return;
  }

  e.respondWith(staleWhileRevalidate(req));
});
