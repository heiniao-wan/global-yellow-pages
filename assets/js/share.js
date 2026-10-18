/**
 * GYPShare — V1 / V2 / 多标签页之间的数据同步层
 *
 * 背景：站点有两套皮肤（index.html、index-v2.html），只要 localStorage 的键一致，
 * 两个页面本就共用同一份数据；但如果历史版本用过别的键、或用户浏览器缓存了旧脚本，
 * 就会出现「同一个域名下两个页面数据对不上」。本模块把读写收口到一处，并做三件事：
 *
 *   1. 合并读取：所有历史/变体键都读一遍，票数取最大值、收藏取并集（老数据不丢）
 *   2. 统一写回：永远写规范键；读完之后立刻回写一次完成「迁移」
 *   3. 实时同步：BroadcastChannel + storage 事件，同域名下任一标签页投票/收藏，
 *      其它标签页（含另一个皮肤）立刻刷新，不用手动刷新浏览器
 *
 * 依赖：window.Vault（可选，有则加密存储）
 */
window.GYPShare = (function () {
  'use strict';

  /** 规范键（现行版本只写这两个） */
  var CANON_COUNTS = 'gyp:counts:';
  var CANON_FAVS = 'gyp:favs:';

  /** 历史 / 变体键：只读不写，用于把老数据捞回来 */
  var COUNTS_KEYS = ['gyp:counts:', 'gyp:counts', 'gyp_votes', 'gyp_vote_counts'];
  var FAVS_KEYS = ['gyp:favs:', 'gyp:favs', 'gyp_favs', 'gyp_favorites'];

  var CHANNEL = 'gyp-data-sync';
  var bus = null;
  try { bus = ('BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL) : null; } catch (e) { /* 老浏览器降级到 storage 事件 */ }

  var listeners = [];
  /** 自己刚写的数据会触发一次 storage / 消息回环，用标记跳过 */
  var selfWrite = 0;

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { selfWrite = Date.now(); localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }

  /** 密文优先，其次明文 JSON */
  function parseMaybe(raw) {
    if (!raw) return null;
    if (window.Vault) {
      try {
        var o = window.Vault.open(raw);
        if (o && typeof o === 'object') return o;
      } catch (e) { /* 不是密文，继续按明文解析 */ }
    }
    var head = raw.charAt(0);
    if (head === '{') {
      try {
        var j = JSON.parse(raw);
        if (j && typeof j === 'object') return j;
      } catch (e) { /* 损坏，丢弃 */ }
    }
    return null;
  }

  /** 老版本可能只存了一个数字（赞数），统一成三键结构 */
  function normalizeCounts(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (id) {
      var v = obj[id];
      if (typeof v === 'number') v = { like: v, dislike: 0, broken: 0 };
      if (!v || typeof v !== 'object') return;
      out[id] = {
        like: Math.max(0, parseInt(v.like, 10) || 0),
        dislike: Math.max(0, parseInt(v.dislike, 10) || 0),
        broken: Math.max(0, parseInt(v.broken, 10) || 0)
      };
    });
    return out;
  }

  function normalizeFavs(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (id) {
      if (obj[id] === true || obj[id] === 1 || obj[id] === '1') out[id] = true;
    });
    return out;
  }

  /** 读取并合并所有已知键里的票数（同一站点各分项取最大值） */
  function readCounts() {
    var merged = {};
    COUNTS_KEYS.forEach(function (k) {
      var n = normalizeCounts(parseMaybe(lsGet(k)));
      Object.keys(n).forEach(function (id) {
        var c = merged[id] || { like: 0, dislike: 0, broken: 0 };
        merged[id] = {
          like: Math.max(c.like, n[id].like),
          dislike: Math.max(c.dislike, n[id].dislike),
          broken: Math.max(c.broken, n[id].broken)
        };
      });
    });
    return merged;
  }

  /** 读取并合并收藏（取并集） */
  function readFavs() {
    var merged = {};
    FAVS_KEYS.forEach(function (k) {
      var f = normalizeFavs(parseMaybe(lsGet(k)));
      Object.keys(f).forEach(function (id) { merged[id] = true; });
    });
    return merged;
  }

  function seal(obj) {
    try { return window.Vault ? window.Vault.seal(obj) : JSON.stringify(obj); }
    catch (e) { return JSON.stringify(obj); }
  }

  function writeCounts(obj) {
    lsSet(CANON_COUNTS, seal(obj));
  }
  function writeFavs(obj) {
    lsSet(CANON_FAVS, seal(obj));
  }

  /** 把读到的所有历史数据合并回规范键，完成迁移（顺带清掉多余的变体键） */
  function migrate() {
    writeCounts(readCounts());
    writeFavs(readFavs());
    [COUNTS_KEYS, FAVS_KEYS].forEach(function (group) {
      group.forEach(function (k) {
        if (k === CANON_COUNTS || k === CANON_FAVS) return;
        try { if (localStorage.getItem(k) !== null) localStorage.removeItem(k); } catch (e) { /* 忽略 */ }
      });
    });
  }

  /** 外部数据合并进来；返回是否有变化 */
  function merge(kind, incoming) {
    if (!incoming || typeof incoming !== 'object') return false;
    if (kind === 'counts') {
      var cur = readCounts(), changed = false;
      Object.keys(incoming).forEach(function (id) {
        var n = normalizeCounts({ x: incoming[id] }).x;
        if (!n) return;
        var c = cur[id] || { like: 0, dislike: 0, broken: 0 };
        var m = {
          like: Math.max(c.like, n.like),
          dislike: Math.max(c.dislike, n.dislike),
          broken: Math.max(c.broken, n.broken)
        };
        if (m.like !== c.like || m.dislike !== c.dislike || m.broken !== c.broken) changed = true;
        cur[id] = m;
      });
      if (changed) writeCounts(cur);
      return changed ? cur : null;
    }
    if (kind === 'favs') {
      var f = readFavs(), fChanged = false;
      Object.keys(normalizeFavs(incoming)).forEach(function (id) {
        if (!f[id]) { f[id] = true; fChanged = true; }
      });
      if (fChanged) writeFavs(f);
      return fChanged ? f : null;
    }
    return false;
  }

  function notify() {
    var counts = readCounts(), favs = readFavs();
    listeners.forEach(function (cb) {
      try { cb(counts, favs); } catch (e) { /* 单个监听器出错不影响其它 */ }
    });
  }

  function onExternal() {
    if (Date.now() - selfWrite < 300) return; // 自己的写入引起的回环，忽略
    notify();
  }

  if (bus) {
    bus.onmessage = function (ev) {
      var d = ev.data || {};
      if (d.source === window.__gypTabId) return;
      var changed = false;
      if (d.counts) changed = !!merge('counts', d.counts) || changed;
      if (d.favs) changed = !!merge('favs', d.favs) || changed;
      if (changed) notify();
    };
  }

  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (COUNTS_KEYS.indexOf(e.key) === -1 && FAVS_KEYS.indexOf(e.key) === -1) return;
    onExternal();
  });

  return {
    COUNTS_KEY: CANON_COUNTS,
    FAVS_KEY: CANON_FAVS,
    readCounts: readCounts,
    readFavs: readFavs,
    writeCounts: writeCounts,
    writeFavs: writeFavs,
    migrate: migrate,
    onChange: function (cb) { listeners.push(cb); },
    /** 本页数据变动后广播给其它标签页 */
    announce: function (counts, favs) {
      if (!bus) return;
      try {
        bus.postMessage({
          source: window.__gypTabId,
          counts: counts || readCounts(),
          favs: favs || readFavs()
        });
      } catch (e) { /* 忽略 */ }
    }
  };
})();

/** 每个标签页一个 id，用于识别广播来源 */
window.__gypTabId = (function () {
  return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
})();
