/**
 * votes-sync.js — 投票数据的服务端同步层
 *
 * 职责：把「全站共享票数」与「我投过什么」这两件事从本机存储搬到服务端。
 * 约定：所有网络失败都静默降级为本地模式，绝不让页面报错或卡住。
 *
 * 为什么单独一个文件：投票链路同时涉及 API 交互、本地降级、状态合并，
 * 放进 app.js 会让那个已经很长的文件更难读。
 */
window.VotesSync = (function () {
  'use strict';

  var ENDPOINT = '/api/votes';
  /** 服务端不可用时置位，之后不再反复请求（避免每页刷几十个失败请求） */
  var offline = false;

  function fp() {
    try { return window.AntiAbuse.fingerprint(); } catch (e) { return ''; }
  }

  /** 把服务端返回的 counts 规整成 { siteId: {like,dislike,broken} } */
  function normalize(counts) {
    var out = {};
    if (!counts || typeof counts !== 'object') return out;
    Object.keys(counts).forEach(function (id) {
      var c = counts[id] || {};
      out[id] = {
        like: Number(c.like) || 0,
        dislike: Number(c.dislike) || 0,
        broken: Number(c.broken) || 0
      };
    });
    return out;
  }

  function req(method, url, body) {
    var opts = {
      method: method,
      headers: { 'X-Gyp-Fp': fp() }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error(j.error || ('http ' + r.status));
          err.status = r.status;
          err.payload = j;
          throw err;
        }
        return j;
      });
    });
  }

  return {
    /** 服务端是否已降级（页面可用于提示「当前为本地模式」） */
    isOffline: function () { return offline; },

    /** 拉取全站票数 */
    fetchCounts: function () {
      if (offline) return Promise.resolve(null);
      return req('GET', ENDPOINT).then(function (j) {
        return normalize(j.counts);
      }).catch(function () {
        offline = true;
        return null;
      });
    },

    /** 拉取「我投过什么」：{ siteId: action } */
    fetchMine: function () {
      if (offline) return Promise.resolve(null);
      return req('GET', ENDPOINT + '?mine=1').then(function (j) {
        return (j.mine && typeof j.mine === 'object') ? j.mine : {};
      }).catch(function () {
        offline = true;
        return null;
      });
    },

    /**
     * 投票 / 改票。
     * @returns {Promise<{ok, counts, prev, action}|null>} null 表示已降级本地
     */
    vote: function (siteId, action) {
      if (offline) return Promise.resolve(null);
      return req('POST', ENDPOINT, { id: siteId, action: action }).then(function (j) {
        return { ok: true, counts: normalize(j.counts), prev: j.prev || null, action: j.action };
      }).catch(function (e) {
        if (e.status === 429 || e.status === 503) offline = true;
        throw e;
      });
    },

    /** 取消我在该站的票 */
    unvote: function (siteId) {
      if (offline) return Promise.resolve(null);
      return req('DELETE', ENDPOINT + '?id=' + encodeURIComponent(siteId))
        .then(function (j) {
          return { ok: true, counts: normalize(j.counts), removed: j.removed || null };
        }).catch(function (e) {
          if (e.status === 429 || e.status === 503) offline = true;
          throw e;
        });
    },

    /** 供 UI 拼错误文案用 */
    normalize: normalize
  };
})();
