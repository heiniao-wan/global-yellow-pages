/**
 * trending.js — 热点站点渲染层
 *
 * 职责：把 window.TRENDING_DATA（由 tools/fetch-trending.py 每日生成，
 *       tools/translate-trending.py 翻译）渲染成首页的「最新发现」区块。
 *
 * 设计要点：
 * ① 与 data.js 完全解耦 —— 热点数据缺失或为空时，整个区块不渲染，
 *    页面照常工作（这是纯静态站必须有的容错）。
 * ② 热度数据来自公开榜单（Hacker News / GitHub Trending / InfoQ），
 *    每条都标明来源与原始标题，让用户知道「它为什么火」。
 * ③ 站点名与热点理由带 _zh/_en/_ja/_ko 四个语言字段（生成时翻译），
 *    渲染时按当前语言取，缺失回退英文原文——翻译挂了对页面零影响。
 * ④ 分类筛选可点，与主网格的分类栏联动。
 */
window.TrendingUI = (function () {
  'use strict';

  var state = {
    cat: 'all',
    expanded: false
  };

  var LIMIT_COLLAPSED = 6;    // 折叠时显示几条
  var LIMIT_EXPANDED = 24;    // 展开时最多显示几条

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function t(key, fallback) {
    // 注意：取词走 window.I18N.t —— i18n.js 只往 window.I18N 上挂方法，
    // 从来没有 window.t（曾经误用导致动态文案在英日韩下静默走中文兜底）。
    try {
      if (window.I18N && window.I18N.t) {
        var v = window.I18N.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) { /* i18n 未就绪时用兜底 */ }
    return fallback || key;
  }

  function data() {
    var d = window.TRENDING_DATA;
    if (!d || !Array.isArray(d.entries) || !d.entries.length) return null;
    return d;
  }

  /** 分类名（跟随站点当前语言，与主网格的 catName 逻辑一致） */
  function catName(key) {
    var cats = window.SITE_CATEGORIES || [];
    var cur = 'zh';
    try {
      if (window.I18N && window.I18N.lang) cur = window.I18N.lang();
    } catch (e) { /* 忽略 */ }
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].key !== key) continue;
      if (cur === 'zh') return cats[i].zh || key;
      return cats[i][cur] || cats[i].en || cats[i].zh || key;
    }
    return key;
  }

  /** 当前语言码（与分类名同一来源，默认中文） */
  function curLang() {
    try {
      if (window.I18N && window.I18N.lang) return window.I18N.lang();
    } catch (e) { /* 忽略 */ }
    return 'zh';
  }

  /** 取条目的本地化字段：siteTitle_zh / hotTitle_ja …
   *  翻译缺失（生成时翻失败或还没翻）时回退英文原文 */
  function loc(e, field) {
    var v = e[field + '_' + curLang()];
    return v || e[field] || '';
  }

  /** 热度文案（跟随当前语言） */
  function heatText(e) {
    if (e.sourceKey === 'github') {
      return e.points > 0
        ? (e.points + ' ★ ' + t('trend_today', '今日'))
        : t('trend_hot_day', '今日热门');
    }
    if (e.points > 0) {
      var s = e.points + ' ' + t('trend_pts', '分');
      if (e.comments > 0) s += ' · ' + e.comments + ' ' + t('trend_cmt', '评论');
      return s;
    }
    return t('trend_hot', '热门');
  }

  function render() {
    var host = document.getElementById('trendGrid');
    if (!host) return;

    var d = data();
    if (!d) {
      // 没有热点数据 → 整个区块隐藏，不留空壳
      var sec = document.getElementById('trendSection');
      if (sec) sec.hidden = true;
      return;
    }

    var list = d.entries.slice();
    if (state.cat !== 'all') {
      list = list.filter(function (e) { return e.category === state.cat; });
    }

    // 可选分类：只列出有点数数据的分类
    var cats = {};
    d.entries.forEach(function (e) { cats[e.category] = (cats[e.category] || 0) + 1; });
    var catKeys = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });

    var limit = state.expanded ? LIMIT_EXPANDED : LIMIT_COLLAPSED;
    var shown = list.slice(0, limit);

    // ── 分类筛选条 ──
    var chips = '<button class="trend-chip' + (state.cat === 'all' ? ' on' : '') +
      '" data-cat="all">' + esc(t('trend_all', '全部')) +
      ' <b>' + d.entries.length + '</b></button>';
    catKeys.forEach(function (k) {
      chips += '<button class="trend-chip' + (state.cat === k ? ' on' : '') +
        '" data-cat="' + esc(k) + '">' + esc(catName(k)) +
        ' <b>' + cats[k] + '</b></button>';
    });

    // ── 卡片 ──
    var cards = shown.map(function (e) {
      var badge = e.sourceKey === 'github' ? 'GitHub' : e.source;
      // 条目自己的发现日期（滚动窗口内可能是前几天的）
      var day = (e.date || '').replace(/^(\d+)-(\d+)-(\d+)$/, '$2.$3');
      return '<article class="trend-card" data-domain="' + esc(e.domain) + '">' +
        '<div class="trend-head">' +
          '<a class="trend-name" href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(loc(e, 'siteTitle') || e.name) + '</a>' +
          '<span class="trend-heat" title="' + esc(t('trend_heat', '热度')) + '">' +
            esc(heatText(e)) + '</span>' +
        '</div>' +
        '<a class="trend-why" href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer" ' +
          'title="' + esc(loc(e, 'hotTitle')) + '">' + esc(loc(e, 'hotTitle') || e.domain) + '</a>' +
        '<div class="trend-meta">' +
          (day ? '<span class="trend-day">' + esc(day) + '</span>' : '') +
          '<span class="trend-src">' + esc(badge) + '</span>' +
          '<span class="trend-cat">' + esc(catName(e.category)) + '</span>' +
          '<span class="trend-dom">' + esc(e.domain) + '</span>' +
        '</div>' +
      '</article>';
    }).join('');

    // 展开/收起按钮：折叠时若还有更多就显示「展开全部」；
    // 展开状态下若确实有更多（超出上限）显示「收起」，
    // 若已全部显示也保留「收起」按钮 —— 否则用户展开后没法再收起。
    var more = '';
    if (state.expanded) {
      more = '<button class="trend-more" id="trendMore">' +
        esc(t('trend_less', '收起')) + '</button>';
    } else if (list.length > limit) {
      more = '<button class="trend-more" id="trendMore">' +
        esc(t('trend_more', '展开全部')) + '（' + list.length + '）</button>';
    }

    host.innerHTML = chips;
    var grid = document.getElementById('trendCards');
    if (grid) grid.innerHTML = cards;
    var moreBox = document.getElementById('trendMoreBox');
    if (moreBox) moreBox.innerHTML = more;

    // 日期
    var dt = document.getElementById('trendDate');
    if (dt) {
      var dstr = (d.date || '').replace(/-/g, '.');
      dt.textContent = dstr ? (t('trend_updated', '更新于') + ' ' + dstr) : '';
    }

    // 数量
    var cnt = document.getElementById('trendCount');
    if (cnt) {
      cnt.textContent = t('trend_count', '近 3 日新发现 {n} 个站点')
        .replace('{n}', String(d.entries.length));
    }
  }

  function bind() {
    // 事件委托要覆盖三个区域：分类条（#trendGrid）、卡片区（#trendCards）、
    // 展开按钮（#trendMoreBox）。它们是同级容器，
    // 所以把监听器挂在共同的父级 #trendSection 上，一次绑全。
    var sec = document.getElementById('trendSection');
    if (!sec || sec._bound) return;
    sec._bound = true;

    sec.addEventListener('click', function (e) {
      var chip = e.target.closest('.trend-chip');
      if (chip) {
        state.cat = chip.dataset.cat || 'all';
        state.expanded = false;
        render();
        return;
      }
      var more = e.target.closest('#trendMore');
      if (more) {
        state.expanded = !state.expanded;
        render();
      }
    });
  }

  function init() {
    bind();
    render();
  }

  return {
    init: init,
    render: render,
    getState: function () { return state; }
  };
})();
