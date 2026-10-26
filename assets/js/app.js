/**
 * 应用主逻辑：目录渲染 / 搜索筛选 / 投票交互 / 统计图表
 */
(function () {
  'use strict';

  const SITES = window.SITE_DATA;
  const CATS = window.SITE_CATEGORIES;
  const esc = window.Thumbnails.escapeHtml;
  const t = window.I18N.t;

  /** 分类名多语言：zh 用 zh 字段，en/ja/ko 回退到 en */
  function catName(c) {
    var cur = window.I18N.lang();
    if (cur === 'zh') return c.zh;
    return c[cur] || c.en || c.zh;
  }

  const VOTE_KEY = 'gyp:counts:';
  const FAV_KEY = 'gyp:favs:';
  const VOTE_TYPES = [
    { key: 'like',    i18n: 'label_like',    icon: '👍', color: '#34c759' },
    { key: 'dislike', i18n: 'label_dislike', icon: '👎', color: '#ff3b30' },
    { key: 'broken',  i18n: 'label_broken',  icon: '🚫', color: '#ff9f0a' }
  ];

  /* 口碑榜配置：显示条数 TOP_N、进榜最低票数 MIN_VOTES
     MIN_VOTES 说明：目前票数是浏览器本地累计、每个访客每站仅一票，故门槛取 1；
     将来接入服务端汇总真实票数后，把这里改成 3 即可过滤掉「一票霸榜」 */
  const TOP_N = 8;
  const MIN_VOTES = 1;

  /* ───────────────────── 状态 ───────────────────── */
  const state = {
    category: 'all',
    region: 'all',
    keyword: '',
    sort: 'hot',
    onlyBroken: false,
    // 场景化入口：按意图分流（策展清单见 data.js 的 SCENE_DATA），空串=未选
    scenario: '',
    counts: loadCounts(),
    voted: {},
    favs: loadFavs(),
    faqGroup: null,
    // 服务端票数/我的票是否已同步到位。
    // false 时禁止投票，避免把「本机旧票」误判成「再点一次=取消」。
    synced: false
  };

  /** 各站点累计票数：经 Vault 加密+校验存于本地，被篡改/损坏时自动作废重置
      读写统一收口到 GYPShare —— V1/V2 两个皮肤、以及多个标签页共用同一份数据，
      并且会自动把历史/变体键里的老票合并回来（同一站点各分项取最大值） */
  function loadCounts() {
    if (window.GYPShare) {
      try { return window.GYPShare.readCounts(); } catch (e) { /* 继续走兜底 */ }
    }
    try {
      var raw = localStorage.getItem(VOTE_KEY);
      if (!raw) return {};
      var data = window.Vault.open(raw);
      if (data && typeof data === 'object') return data;
      if (raw.charAt(0) === '{') {
        try { return JSON.parse(raw) || {}; } catch (e) { /* 损坏，重置 */ }
      }
    } catch (e) { /* 隐私模式下退回内存态 */ }
    return {};
  }
  function saveCounts() {
    try {
      if (window.GYPShare) {
        window.GYPShare.writeCounts(state.counts);
        window.GYPShare.announce(state.counts, null);
        return;
      }
      localStorage.setItem(VOTE_KEY, window.Vault.seal(state.counts));
    } catch (e) { /* 忽略 */ }
  }

  /** 收藏夹：站点 id → true，同样加密存储 */
  function loadFavs() {
    if (window.GYPShare) {
      try { return window.GYPShare.readFavs(); } catch (e) { /* 继续走兜底 */ }
    }
    try {
      var raw = localStorage.getItem(FAV_KEY);
      if (!raw) return {};
      var data = window.Vault.open(raw);
      if (data && typeof data === 'object') return data;
      if (raw.charAt(0) === '{') {
        try { return JSON.parse(raw) || {}; } catch (e) { /* 损坏，重置 */ }
      }
    } catch (e) { /* 隐私模式 */ }
    return {};
  }
  function saveFavs() {
    try {
      if (window.GYPShare) {
        window.GYPShare.writeFavs(state.favs);
        window.GYPShare.announce(null, state.favs);
        return;
      }
      localStorage.setItem(FAV_KEY, window.Vault.seal(state.favs));
    } catch (e) { /* 忽略 */ }
  }
  function toggleFav(siteId) {
    if (state.favs[siteId]) delete state.favs[siteId];
    else state.favs[siteId] = true;
    saveFavs();
    return !!state.favs[siteId];
  }
  function favCount() {
    return Object.keys(state.favs).length;
  }
  function countsOf(id) {
    const c = state.counts[id];
    return {
      like: (c && c.like) || 0,
      dislike: (c && c.dislike) || 0,
      broken: (c && c.broken) || 0
    };
  }

  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ───────────────────── 渲染：分类栏 ───────────────────── */
  /** 分类按钮数据：全部 + 各行业（顶部横排与左侧竖排共用） */
  function categoryItems() {
    return [{ key: '__fav__', zh: t('cat_fav'), icon: '⭐', count: favCount() }].concat(
      [{ key: 'all', zh: t('cat_all'), icon: '🌐', count: SITES.length }],
      CATS.map(function (c) {
        return {
          key: c.key, zh: c.zh, en: c.en, ja: c.ja, ko: c.ko, icon: c.icon,
          count: SITES.filter(function (s) { return s.category === c.key; }).length
        };
      })
    );
  }

  function chipHtml(c) {
    return '<button class="cat-chip' + (state.category === c.key ? ' active' : '') + '" data-cat="' + c.key + '" title="' + esc(catName(c)) + ' · ' + c.count + '">' +
      '<span class="cat-icon">' + c.icon + '</span>' +
      '<span class="cat-name">' + esc(catName(c)) + '</span>' +
      '<span class="cat-count">' + c.count + '</span>' +
    '</button>';
  }

  /**
   * 滚动到分类栏（「网站目录」锚点 + 点击分类共用）
   * html 上已设 scroll-padding-top，浏览器会自动把分类栏停在吸顶导航下方，
   * 因此这里只需 block:'start'，分类栏与紧跟其后的结果区开头能同屏看到。
   */
  function scrollToCatSection() {
    var target = document.getElementById('catSection') || document.querySelector('.cat-section');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** 选中分类：两处分类栏（顶部横排 + 左侧竖排）同步高亮 */
  /** 场景化入口：按访客意图分流。
      场景是策展清单（data.js 的 SCENE_DATA），点一下切过去、再点一下取消。
      切换时清掉分类/地区/关键词——旧筛选残留会让交集直接变 0。 */
  function selectScene(id) {
    if (!window.SCENE_DATA || !window.SCENE_DATA[id]) return;
    var same = (state.scenario === id);
    state.scenario = same ? '' : id;
    state.category = 'all';
    state.region = 'all';
    state.keyword = '';
    $('#search').value = '';
    $('#regionSel').value = 'all';
    $$('.cat-chip').forEach(function (b) { b.classList.toggle('active', b.dataset.cat === 'all'); });
    paintScenario();
    renderGrid();
    var res = document.getElementById('results');
    if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** 场景按钮高亮 + 状态条（文案随语言切换，所以每次切语言都要重画） */
  function paintScenario() {
    var on = state.scenario;
    $$('.scene-item').forEach(function (b) {
      b.classList.toggle('on', !!on && b.dataset.sc === on);
    });
    var st = document.getElementById('sceneStatus');
    if (!st) return;
    if (!on) { st.hidden = true; st.textContent = ''; return; }
    st.hidden = false;
    st.innerHTML = esc(t('sc_active')).replace('{n}', esc(t('sc_' + on))) +
      ' <button type="button" class="scene-clear">' + esc(t('sc_clear')) + '</button>';
  }

  function bindScenes() {
    var grid = document.querySelector('.scene-grid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.scene-item');
      if (!btn) return;
      selectScene(btn.dataset.sc);
    });
    var st = document.getElementById('sceneStatus');
    if (st) {
      st.addEventListener('click', function (e) {
        if (!e.target.closest('.scene-clear')) return;
        state.scenario = '';
        paintScenario();
        renderGrid();
      });
    }
  }

  function selectCategory(key) {
    state.category = key;
    // 按钮数字是「该分类全部站点数」，点击后必须清掉其他筛选，
    // 否则旧的地区/关键词残留会让交集变 0（按钮显示 16、列表显示 0 的根因）
    state.region = 'all';
    state.keyword = '';
    // 场景是另一条筛选轴，选了分类就退掉场景，否则两个清单取交集也是空
    state.scenario = '';
    $('#search').value = '';
    $('#regionSel').value = 'all';
    $$('.cat-chip').forEach(function (b) { b.classList.toggle('active', b.dataset.cat === key); });
    paintScenario();
    renderGrid();
    // 定位到「分类栏」而不是结果列表顶部：
    // 结果区上方就是分类栏，若直接跳 #results 会把分类栏顶出视口，
    // 用户点「网站目录」看到的是一堆卡片、却看不到刚点的分类按钮。
    scrollToCatSection();
  }

  function renderCategories() {
    const bar = $('#catBar');
    bar.innerHTML = categoryItems().map(chipHtml).join('');

    if (!bar._bound) {
      bar._bound = true;
      bar.addEventListener('click', function (e) {
        const btn = e.target.closest('.cat-chip');
        if (!btn) return;
        selectCategory(btn.dataset.cat);
      });
    }
  }

  /* ───────────────────── 左侧竖向分类导航 ───────────────────── */
  /** 侧栏是否处于「手动固定展开」状态（跨会话记住） */
  function railPinned() {
    try { return localStorage.getItem('gyp:railPin') === '1'; } catch (e) { return false; }
  }

  function renderSideCats() {
    const rail = $('#sideCats');
    if (!rail) return;
    const pin = railPinned();
    rail.classList.toggle('pinned', pin);
    // 顶部开关：宽度不够时侧栏默认只留图标，点这里可强制展开看完整分类名
    rail.innerHTML =
      '<button type="button" class="side-cats-toggle" aria-expanded="' + (pin ? 'true' : 'false') +
        '" title="' + esc(t('rail_cats')) + '">' +
        '<span class="tl">' + esc(t('rail_cats')) + '</span>' +
        '<span class="tw" aria-hidden="true">▲</span>' +
      '</button>' +
      categoryItems().map(chipHtml).join('');

    if (!rail._bound) {
      rail._bound = true;
      rail.addEventListener('click', function (e) {
        const tog = e.target.closest('.side-cats-toggle');
        if (tog) {
          const next = !rail.classList.contains('pinned');
          rail.classList.toggle('pinned', next);
          tog.setAttribute('aria-expanded', next ? 'true' : 'false');
          try { localStorage.setItem('gyp:railPin', next ? '1' : '0'); } catch (err) { /* 隐私模式忽略 */ }
          return;
        }
        const btn = e.target.closest('.cat-chip');
        if (!btn) return;
        selectCategory(btn.dataset.cat);
      });
    }
  }

  /** 滚过首屏后左侧导航浮现，页面顶部时隐藏 */
  function bindSideCats() {
    const rail = $('#sideCats');
    if (!rail) return;
    function toggle() {
      rail.classList.toggle('show', window.scrollY > window.innerHeight * 0.8);
    }
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ───────────────────── 渲染：筛选器 ───────────────────── */
  function renderFilters() {
    const regions = ['全部'];
    SITES.forEach(function (s) { if (regions.indexOf(s.region) < 0) regions.push(s.region); });
    // 「全部」的 value 必须与 state.region 初始值 'all' 一致，
    // 否则选回「全部」时 region 会变成 '全部' 而永远匹配不到任何站点
    $('#regionSel').innerHTML = regions.map(function (r) {
      return '<option value="' + (r === '全部' ? 'all' : esc(r)) + '">' +
             (r === '全部' ? t('filter_all_region') : t('region_' + r)) + '</option>';
    }).join('');

    $('#sortSel').innerHTML =
      '<option value="hot">' + t('sort_hot') + '</option>' +
      '<option value="score">' + t('sort_score') + '</option>' +
      '<option value="name">' + t('sort_name') + '</option>';

    // 语言切换会重跑本函数，监听器只绑一次
    if (!$('#regionSel')._bound) {
      $('#regionSel')._bound = true;
      $('#regionSel').addEventListener('change', function (e) { state.region = e.target.value; renderGrid(); });
      $('#sortSel').addEventListener('change', function (e) { state.sort = e.target.value; renderGrid(); });
    }
  }

  /* ───────────────────── 筛选 ───────────────────── */
  function filtered() {
    const kw = state.keyword.trim().toLowerCase();
    // 场景清单（策展）：命中域名才留下
    const sceneSet = state.scenario && window.SCENE_DATA
      ? (window.SCENE_DATA[state.scenario] || {}).domains || null
      : null;
    let list = SITES.filter(function (s) {
      // 收藏分类：按本机收藏夹过滤（chip 计数是收藏数而非分类总数）
      if (state.category === '__fav__' && !state.favs[s.id]) return false;
      if (state.category !== 'all' && state.category !== '__fav__' && s.category !== state.category) return false;
      if (state.region !== 'all' && s.region !== state.region) return false;
      // 问题站点：被标记过「无法访问」的才显示
      if (state.onlyBroken && !(countsOf(s.id).broken > 0)) return false;
      if (sceneSet && sceneSet.indexOf(s.domain) < 0) return false;
      if (!kw) return true;
      return (s.name + ' ' + s.url + ' ' + s.desc + ' ' + s.region).toLowerCase().indexOf(kw) >= 0;
    });

    if (state.sort === 'name') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (state.sort === 'score') {
      // 口碑分 = (赞 - 踩) / 总票数，新站票少时回归到中性基准
      list.sort(function (a, b) { return score(b) - score(a); });
    } else {
      list.sort(function (a, b) { return hot(b) - hot(a); });
    }
    return list;
  }

  function score(s) {
    const c = countsOf(s.id);
    const total = c.like + c.dislike + c.broken;
    if (total === 0) return 0;
    return (c.like - c.dislike) / total;
  }
  /**
   * 热度分。站点在 data.js 里的原始顺序本身就是按知名度排的，
   * 所以用「距首位的距离」作基准分，票数只作微调——
   * 这样既保住调研时的知名度排序，又让真实投票能把某个站顶上来。
   */
  function hot(s) {
    const c = countsOf(s.id);
    const rank = s.rank;
    const vote = c.like * 2 - c.dislike * 2 + c.broken * 0.5;
    return -rank + vote;
  }

  /* ───────────────────── 渲染：卡片网格 ───────────────────── */
  function renderGrid() {
    const list = filtered();
    const grid = $('#grid');
    const total = list.length;

    $('#resultCount').textContent = total;
    $('#emptyState').hidden = total > 0;

    if (!total) {
      grid.innerHTML = '';
      // 「我的收藏」为空时给出明确引导，而不是通用的「没找到网站」
      // 注意：#emptyState 的第一个子元素是 .empty-icon（span），不能用 p:first-child
      var ep = $('#emptyState p');
      var es = $('#emptyState p.muted');
      if (ep) ep.textContent = t(state.category === '__fav__' ? 'fav_empty' : 'empty_t');
      if (es) es.textContent = t(state.category === '__fav__' ? 'fav_empty_sub' : 'empty_sub');
      return;
    }

    // 分批渲染，首屏先出，快速滚动时再补后续批次
    var html = '';
    for (var i = 0; i < list.length; i++) html += cardHtml(list[i]);
    grid.innerHTML = html;
    bindCards(grid);
  }

  function cardHtml(s) {
    const c = countsOf(s.id);
    const cat = CATS.find(function (x) { return x.key === s.category; }) || { zh: '', icon: '' };
    const voted = state.voted[s.id];
    // 三票全零且我没投过：只显图标不显「0」——一片 0/0/0 像坏站，
    // 图标 alone 干净；投出第一票后数字自然出现（renderGrid 重渲染）。
    const voteTotal = c.like + c.dislike + c.broken;
    const voteZero = (voteTotal === 0 && !voted);

    // 按钮不禁用：我投过的那一项高亮并标注「取消」，其余保持可点（用于改票）
    const buttons = VOTE_TYPES.map(function (v) {
      const mine = (voted === v.key);
      const title = mine ? t('vote_cancel') : t(v.i18n);
      return '<button class="vote-btn v-' + v.key + (mine ? ' mine' : '') + '" data-vote="' + v.key + '" data-id="' + esc(s.id) + '"' +
        ' title="' + esc(title) + '" aria-label="' + esc(title) + '"' +
        (mine ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
        '<span class="vb-icon">' + v.icon + '</span>' +
        '<span class="vb-num" data-count="' + v.key + '">' + c[v.key] + '</span>' +
        (mine ? '<span class="vb-flag">' + esc(t('vote_cancel')) + '</span>' : '') +
      '</button>';
    }).join('');

    const favOn = !!state.favs[s.id];
    const favTip = t(favOn ? 'fav_remove' : 'fav_add');
    const favTxt = t(favOn ? 'fav_txt_on' : 'fav_txt_off');
    return '<article class="site-card" data-id="' + esc(s.id) + '" style="--brand:' + s.brand + ';--brand-soft:' + s.brandSoft + '">' +
      '<button class="fav-star' + (favOn ? ' on' : '') + '" data-fav="' + esc(s.id) + '" title="' + esc(favTip) + '" aria-label="' + esc(favTip) + '" aria-pressed="' + (favOn ? 'true' : 'false') + '">' +
        '<span class="fs-ico">★</span><span class="fs-txt">' + esc(favTxt) + '</span>' +
      '</button>' +
      '<div class="site-shot" aria-hidden="true"></div>' +
      '<div class="site-body">' +
        '<div class="site-head">' +
          '<img class="site-favicon" src="' + esc(s.favicon) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
          '<div class="site-titles">' +
            '<h3 class="site-name" title="' + esc(s.name) + '">' + esc(s.name) + '</h3>' +
            '<span class="site-domain">' + esc(s.domain) + '</span>' +
          '</div>' +
        '</div>' +
        '<p class="site-desc">' + esc(s.desc) + '</p>' +
        '<div class="site-meta">' +
          '<span class="tag tag-cat">' + cat.icon + ' ' + esc(catName(cat)) + '</span>' +
          '<span class="tag tag-region">' + esc(t('region_' + s.region)) + '</span>' +
          '<span class="tag tag-lang">' + esc(t('lang_' + s.lang)) + '</span>' +
          (c.broken > 0 ? '<span class="tag tag-broken">⚠ ' + esc(t('badge_broken').replace('{n}', c.broken)) + '</span>' : '') +
        '</div>' +
        '<div class="site-actions">' +
          '<div class="site-cta">' +
            '<a class="open-btn" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer nofollow">' +
              esc(t('open_site')) + ' <span class="arrow">↗</span>' +
            '</a>' +
            '<button class="copy-btn" data-copy="' + esc(s.url) + '" title="' + esc(t('copy_link')) + '" aria-label="' + esc(t('copy_link')) + '">' +
              '<span class="cb-ico">⧉</span><span class="cb-txt">' + esc(t('copy_link')) + '</span>' +
            '</button>' +
          '</div>' +
          '<div class="vote-group' + (voteZero ? ' zero' : '') + '">' + buttons + '</div>' +
        '</div>' +
        '<div class="vote-flash" hidden></div>' +
      '</div>' +
    '</article>';
  }

  /**
   * 启动时从服务端同步：全站票数 + 我的投票记录。
   * 任何一步失败都静默降级——页面照常工作，只是数据停留在本机。
   */
  function syncFromServer() {
    if (!window.VotesSync) return;

    // 兜底：若 fetch 迟迟不返回（网络挂起），8 秒后强制放开投票。
    // 否则 state.synced 一直是 false，投票按钮会永久提示「正在同步」。
    setTimeout(function () { state.synced = true; }, 8000);

    // 本机旧票先留一份副本：服务端没有的要在迁移时补传
    var localVotes = {};
    Object.keys(state.voted || {}).forEach(function (id) {
      var v = state.voted[id];
      if (v === true) {
        // 老版本只记了「投过」没记「投了哪一项」——
        // 这类票无法还原选项，只能跳过（凭空猜一个会污染真实统计）
        return;
      }
      if (v) localVotes[id] = v;
    });

    window.VotesSync.fetchCounts().then(function (remote) {
      if (!remote) {
        state.synced = true;   // 服务端不可达，放开投票走本地降级
        return;
      }
      state.counts = mergeCounts(state.counts, remote);
      saveCounts();
      renderGrid();
      renderStats();
    }).catch(function () {
      state.synced = true;
    });

    // 服务端记录优先于本机：这样换设备后仍知道自己投过什么
    window.VotesSync.fetchMine().then(function (mine) {
      if (!mine) return;

      // 迁移：全站共享功能上线前，本机投票只存在 localStorage。
      // 那些票在服务端没有对应记录，属于"用户真实表达过的评价"，
      // 不该因为改架构就凭空消失 —— 逐条补传给服务端。
      //
      // 注意「服务端优先」：若某站本机与服务端都有票，以服务端的为准。
      // 本机那份是旧架构的残留，可能是过期数据；若以本机为准，
      // 点一下会变成「取消」而不是「投票」，票数会莫名减 1。
      var pending = Object.keys(localVotes).filter(function (id) {
        return !mine[id] && SITES.some(function (s) { return s.id === id; });
      });

      // 无论是否需要迁移，本机与服务端的记录都要合并，
      // 且服务端的优先（避免用旧的本机数据覆盖真实的新数据）。
      var merged = {};
      Object.keys(localVotes).forEach(function (id) { merged[id] = localVotes[id]; });
      Object.keys(mine).forEach(function (id) { merged[id] = mine[id]; });

      if (pending.length) {
        // 迁移是异步的，等它跑完再统一更新 state.voted
        migrateVotes(pending, localVotes, function (migrated) {
          Object.keys(migrated).forEach(function (id) { merged[id] = migrated[id]; });
          state.voted = merged;
          state.synced = true;
          saveCounts();
          Object.keys(merged).forEach(function (id) { markVotedUI(id); });
        });
        return;
      }

      state.voted = merged;
      state.synced = true;
      saveCounts();
      Object.keys(merged).forEach(function (id) { markVotedUI(id); });
    }).catch(function () {
      // 服务端不可用（离线/接口挂了）：放开投票，走本机降级路径，
      // 否则按钮会永久卡在「同步中」无法使用。
      state.synced = true;
    });
  }

  /**
   * 把本机旧票补传给服务端。
   * 逐条串行发送（避免并发写入造成 KV 聚合丢更新），
   * 传完再刷新一次全站票数。
   */
  function migrateVotes(ids, localVotes, onDone) {
    var done = 0;
    var failed = 0;
    var migrated = {};

    function next(i) {
      if (i >= ids.length) {
        // 迁移结束：拉一次最新票数，并清掉本机的迁移标记
        window.VotesSync.fetchCounts().then(function (remote) {
          if (remote) {
            state.counts = mergeCounts(state.counts, remote);
            saveCounts();
            renderGrid();
            renderStats();
          }
        });
        try {
          localStorage.setItem('gyp:voteMigrated', String(Date.now()));
        } catch (e) { /* 忽略 */ }
        if (done) {
          flash(document.querySelector('.vote-btn') || document.body,
                t('vote_migrated').replace('{n}', done), 'ok');
        }
        if (typeof onDone === 'function') onDone(migrated);
        return;
      }
      var id = ids[i];
      window.VotesSync.vote(id, localVotes[id]).then(function () {
        done++;
        migrated[id] = localVotes[id];
        next(i + 1);
      }).catch(function () {
        failed++;
        next(i + 1);
      });
    }
    next(0);
  }

  /** 把站点挂到一个卡片上；滚动进视口时才真正去请求截图 */
  function loadCard(card) {
    const site = SITES.find(function (s) { return s.id === card.dataset.id; });
    if (site) window.Thumbnails.attach(card, site);
  }

  /**
   * 视口懒加载：303 张卡片若一次性全量请求，
   * 截图服务会直接判限流，反而全部降级。
   * 只有滚进视口的卡片才发起请求。
   */
  function bindCards(grid) {
    if (!grid._bound) {
      grid._bound = true;
      grid.addEventListener('click', onVoteClick);
      grid.addEventListener('click', onCopyClick);
    }
    $$('.site-card', grid).forEach(function (card) {
      if (!('IntersectionObserver' in window)) { loadCard(card); return; }
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.disconnect();
          loadCard(en.target);
        });
      }, { rootMargin: '300px' });
      io.observe(card);
    });
  }

  /** 防刷拒绝文案：优先用当前语言的 reason 映射，缺失时回退模块自带中文 */
  function flashMsg(verdict) {
    var key = 'flash_' + String(verdict.reason || '').replace(/-/g, '_');
    var txt = t(key);
    return txt === key ? verdict.message : txt;
  }

  /* ───────────────────── 复制链接 ───────────────────── */
  /** 优先用 Clipboard API；非 HTTPS 或旧浏览器回退到临时 textarea + execCommand */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function onCopyClick(e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    var url = btn.dataset.copy;
    var txtEl = btn.querySelector('.cb-txt');
    var icoEl = btn.querySelector('.cb-ico');
    var old = txtEl ? txtEl.textContent : '';
    copyText(url).then(function () {
      btn.classList.add('done');
      if (txtEl) txtEl.textContent = t('copied');
      if (icoEl) icoEl.textContent = '✓';
      showToast(t('copied'));
      setTimeout(function () {
        btn.classList.remove('done');
        if (txtEl) txtEl.textContent = old;
        if (icoEl) icoEl.textContent = '⧉';
      }, 1800);
    }).catch(function () {
      showToast(t('copy_fail'));
    });
  }

  /** 轻提示：复用投票闪烁条的做法，定时自动消失 */
  var toastEl = null, toastTimer = null;
  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'gyp-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }

  /* ───────────────────── 投票交互 ───────────────────── */
  function onVoteClick(e) {
    // 星标：收藏/取消收藏（不经过防刷，本机偏好）
    const star = e.target.closest('.fav-star');
    if (star) {
      const id = star.dataset.fav;
      const on = toggleFav(id);
      star.classList.toggle('on', on);
      const label = t(on ? 'fav_remove' : 'fav_add');
      star.title = label;
      star.setAttribute('aria-label', label);
      star.setAttribute('aria-pressed', on ? 'true' : 'false');
      var fsTxt = star.querySelector('.fs-txt');
      if (fsTxt) fsTxt.textContent = t(on ? 'fav_txt_on' : 'fav_txt_off');
      updateFavChip();
      // 正在「我的收藏」视图下取消收藏，卡片应即时消失
      if (state.category === '__fav__') renderGrid();
      return;
    }

    const btn = e.target.closest('.vote-btn');
    if (!btn) return;
    // 请求在途时忽略连点，避免快速连击产生竞态
    if (btn.dataset.busy === '1') return;

    const siteId = btn.dataset.id;
    const action = btn.dataset.vote;

    // 判断「再点是取消还是投票」时，必须以服务端的记录为准。
    //
    // 隐患：state.voted 初始值来自本机 localStorage（共享功能上线前的旧票）。
    // 而服务端记录是异步后到的，在它到达之前，state.voted 里只有本机旧数据。
    // 若旧数据是 'like'、用户这次也点 like，就会被误判成「取消」——
    // 表现为「我明明是第一次点，却把票减掉了」。
    //
    // 解决：服务端数据到达前（synced 为 false），不把它当成本机旧票，
    // 而是等服务端同步完再允许投票。
    if (!state.synced) {
      flash(btn, t('vote_syncing'), 'warn');
      return;
    }
    const myVote = state.voted[siteId];

    // 先过本地防刷（自动化特征、蜜罐、时序、速率）
    const verdict = window.AntiAbuse.canVote(siteId, action);
    if (!verdict.pass) {
      flash(btn, flashMsg(verdict), 'warn');
      return;
    }

    // 语义判定：再点已投的那一项 = 取消；点其他项 = 改票；全新 = 投票
    const isCancel = (myVote === action);
    const isChange = (!!myVote && !isCancel);

    btn.dataset.busy = '1';
    const done = function () { delete btn.dataset.busy; };

    /** 服务端成功后统一走这里：更新数字、刷新按钮态、刷新图表 */
    const applyServer = function (counts) {
      if (counts) {
        // 直接采信服务端返回的票数，不要再叠加本地增量。
        //
        // 曾经的 bug：这里先 mergeCounts（拿到服务端已含本次变更的快照），
        // 又按 isCancel/isChange 手动加减一次，导致「点一次 +2、再点只 -1」。
        //
        // KV 最终一致性确实可能返回旧快照，但那种情况下偏差是 ±1 的短暂抖动，
        // 下次操作或下次进页面就会自愈；而在快照上叠加增量会造成永久性错账，
        // 两害相权取其轻。服务端返回 null（网络失败）时才走本地兜底。
        state.counts = mergeCounts(state.counts, counts);
        saveCounts();
      }
      if (isCancel) {
        window.AntiAbuse.clearVoted(siteId);
        delete state.voted[siteId];
      } else {
        window.AntiAbuse.commitVote(siteId, action);
        state.voted[siteId] = action;
      }
      renderGrid();
      renderStats();
    };

    /** 服务端不可用时的降级：本地加减，保证功能不中断 */
    const applyLocal = function () {
      const c = state.counts[siteId] || { like: 0, dislike: 0, broken: 0 };
      if (isCancel) {
        c[action] = Math.max(0, c[action] - 1);
        state.voted[siteId] = null;
        window.AntiAbuse.clearVoted(siteId);
      } else {
        if (isChange && myVote) c[myVote] = Math.max(0, c[myVote] - 1);
        c[action] += 1;
        state.voted[siteId] = action;
        window.AntiAbuse.commitVote(siteId, action);
      }
      state.counts[siteId] = c;
      saveCounts();
      renderGrid();
      renderStats();
    };

    // ── 取消 ──
    if (isCancel) {
      window.VotesSync.unvote(siteId).then(function (r) {
        if (r) { applyServer(r.counts); }
        else { applyLocal(); }
        done();
      }).catch(function () {
        applyLocal();
        done();
      });
      return;
    }

    // ── 投票 / 改票 ──
    window.VotesSync.vote(siteId, action).then(function (r) {
      if (r) { applyServer(r.counts); }
      else { applyLocal(); }
      done();
    }).catch(function (e) {
      if (e && e.status === 429) {
        flash(btn, t('flash_rate'), 'warn');
      } else {
        flash(btn, t('flash_fail'), 'warn');
      }
      done();
    });
  }

  /**
   * 合并票数：**服务端优先**。
   *
   * 不能用 Math.max：那样一旦服务端数字变小（取消投票后归零），
   * 本地的旧值会一直把它顶回去，显示永远降不下来。
   * 也不能无条件覆盖：服务端还没传播时的旧快照会把刚做的操作抹掉。
   *
   * 折中：服务端该站点有记录就以服务端为准（保证可增可减），
   * 服务端没有才保留本地值（保留离线期间的增量，不丢数据）。
   */
  function mergeCounts(local, remote) {
    const out = {};
    const keys = new Set(Object.keys(local || {}).concat(Object.keys(remote || {})));
    keys.forEach(function (id) {
      const a = (local && local[id]) || {};
      const b = (remote || {})[id];
      const hasRemote = !!(remote && Object.prototype.hasOwnProperty.call(remote, id) && b);
      const pick = function (key) {
        if (hasRemote) return Number(b[key]) || 0;
        return Number(a[key]) || 0;
      };
      out[id] = {
        like: pick('like'),
        dislike: pick('dislike'),
        broken: pick('broken')
      };
    });
    return out;
  }

  /**
   * 标记「我投过」：高亮对应按钮并显示「取消」角标，其余按钮保持可点（用于改票）。
   * value 可以是 true（旧数据无 action）或具体 action 字符串。
   */
  function markVotedUI(siteId) {
    const card = document.querySelector('.site-card[data-id="' + CSS.escape(siteId) + '"]');
    if (!card) return;
    const mine = state.voted[siteId];
    $$('.vote-btn', card).forEach(function (b) {
      var isMine = (typeof mine === 'string') ? (b.dataset.vote === mine) : !!mine;
      b.classList.toggle('mine', isMine);
      b.classList.toggle('voted', !!mine);
      b.disabled = false;
      var label = isMine ? t('vote_cancel') : t((VOTE_TYPES.find(function (v) {
        return v.key === b.dataset.vote;
      }) || {}).i18n || 'label_like');
      b.title = label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', isMine ? 'true' : 'false');
      var flag = b.querySelector('.vb-flag');
      if (isMine && !flag) {
        flag = document.createElement('span');
        flag.className = 'vb-flag';
        flag.textContent = t('vote_cancel');
        b.appendChild(flag);
      } else if (!isMine && flag) {
        flag.remove();
      }
    });
    card.classList.toggle('has-voted', !!mine);
  }

  function flash(btn, msg, kind) {
    const card = btn.closest('.site-card');
    const el = card && card.querySelector('.vote-flash');
    if (!el) return;
    el.textContent = msg;
    el.className = 'vote-flash ' + kind;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.hidden = true; }, 2400);
    btn.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1)' }],
      { duration: 280, easing: 'cubic-bezier(.34,1.56,.64,1)' }
    );
  }

  /* ───────────────────── 统计图表 ───────────────────── */
  let chartTimer = null;
  function scheduleChartRefresh() {
    clearTimeout(chartTimer);
    chartTimer = setTimeout(renderStats, 400);
  }

  function renderStats() {
    var total = { like: 0, dislike: 0, broken: 0 };
    var perCat = {};
    var topList = [];

    SITES.forEach(function (s) {
      const c = countsOf(s.id);
      total.like += c.like;
      total.dislike += c.dislike;
      total.broken += c.broken;

      if (!perCat[s.category]) perCat[s.category] = { like: 0, dislike: 0, broken: 0, n: 0 };
      perCat[s.category].like += c.like;
      perCat[s.category].dislike += c.dislike;
      perCat[s.category].broken += c.broken;
      perCat[s.category].n += 1;

      const sum = c.like + c.dislike + c.broken;
      if (sum > 0) topList.push({ s: s, c: c, sum: sum });
    });

    // 总览数字：统计区卡片 + 首屏指标（两处 id 不同，都要更新）
    $('#statLikeNum').textContent = total.like;
    $('#statDislikeNum').textContent = total.dislike;
    $('#statBrokenNum').textContent = total.broken;
    $('#statSites').textContent = SITES.length;

    var voteAll = total.like + total.dislike + total.broken;
    var health = voteAll === 0 ? 100 : Math.round(total.like / voteAll * 100);

    // 首屏指标：一票没有时显示「—」而不是 0 和 100%——
    // 「0 累计点赞 / 100% 好评率」既是死数据也是假数据。
    var heroLike = $('#statLike');
    if (heroLike) heroLike.textContent = voteAll === 0 ? '—' : total.like;
    var heroHealth = $('#healthPct');
    if (heroHealth) heroHealth.textContent = voteAll === 0 ? '—' : health + '%';

    $('#healthBar').style.width = health + '%';
    $('#healthPctNum').textContent = health + '%';
    $('#healthNote').textContent = voteAll === 0
      ? t('health_none')
      : t('health_based').replace('{n}', voteAll);

    // 分类分布条形图（横向堆叠）
    var rows = Object.keys(perCat).map(function (k) {
      return { cat: CATS.find(function (c) { return c.key === k; }) || { zh: k, icon: '' }, d: perCat[k] };
    }).sort(function (a, b) {
      return (b.d.like + b.d.dislike + b.d.broken) - (a.d.like + a.d.dislike + a.d.broken);
    });

    var maxSum = rows.length ? Math.max.apply(null, rows.map(function (r) { return r.d.like + r.d.dislike + r.d.broken; })) : 1;
    if (maxSum === 0) maxSum = 1;

    $('#catChart').innerHTML = rows.map(function (r) {
      var vt = r.d.like + r.d.dislike + r.d.broken || 1;
      var wl = r.d.like / vt * 100, wd = r.d.dislike / vt * 100, wb = r.d.broken / vt * 100;
      var wpx = (r.d.like + r.d.dislike + r.d.broken) / maxSum * 100;
      return '<div class="catbar-row">' +
        '<div class="catbar-name">' + r.cat.icon + ' ' + esc(catName(r.cat)) + '</div>' +
        '<div class="catbar-track" title="' + esc(t('bar_tip').replace('{l}', r.d.like).replace('{d}', r.d.dislike).replace('{b}', r.d.broken)) + '">' +
          '<div class="catbar-fill" style="width:' + Math.max(wpx, 3) + '%">' +
            '<i style="width:' + wl + '%;background:#34c759"></i>' +
            '<i style="width:' + wd + '%;background:#ff3b30"></i>' +
            '<i style="width:' + wb + '%;background:#ff9f0a"></i>' +
          '</div>' +
        '</div>' +
        '<div class="catbar-num">' + (r.d.like + r.d.dislike + r.d.broken) + '</div>' +
      '</div>';
    }).join('') || '<p class="muted">' + esc(t('no_data')) + '</p>';

    // 三类投票环形图
    $('#ringChart').innerHTML =
      ring(voteAll, total.like, total.dislike, total.broken) +
      '<div class="ring-legend">' +
        legend('#34c759', t('label_like'), total.like) +
        legend('#ff3b30', t('label_dislike'), total.dislike) +
        legend('#ff9f0a', t('label_broken'), total.broken) +
      '</div>';

    // 榜单：按好评率排序（同分比总票数，再比站点热度），而不是按总票数
    var rated = topList.map(function (r) {
      return { s: r.s, c: r.c, sum: r.sum, good: r.sum ? r.c.like / r.sum : 0, hot: r.s.rank || 999 };
    });
    rated.sort(function (a, b) {
      return (b.good - a.good) || (b.sum - a.sum) || (a.hot - b.hot);
    });
    var qualified = rated.filter(function (r) { return r.sum >= MIN_VOTES; });
    var board = qualified.length ? qualified : rated;          // 样本不足时退回全部已投票站点
    var lowSample = !qualified.length && rated.length > 0;     // 还没有站点达到进榜票数门槛
    var rows = board.slice(0, TOP_N);

    // 标题跟随实际条数：只有 3 条就写 TOP 3，不再写死 TOP 8
    var rankHead = null;
    $$('.chart-panel').forEach(function (p) {
      if (p.querySelector('#rankList')) rankHead = p.querySelector('h3');
    });
    if (rankHead) {
      rankHead.textContent = rows.length
        ? t('chart_rank_n').replace('{n}', rows.length)
        : t('chart_rank');
    }

    $('#rankList').innerHTML = rows.length ? (rows.map(function (r) {
      var good = Math.round(r.good * 100);
      return '<div class="rank-row">' +
        '<div class="rank-name"><img src="' + esc(r.s.favicon) + '" alt="" onerror="this.style.visibility=\'hidden\'">' + esc(r.s.name) + '</div>' +
        '<div class="rank-bar"><i style="width:' + good + '%"></i></div>' +
        '<div class="rank-pct">' + good + '%</div>' +
      '</div>';
    }).join('') + (lowSample ? '<p class="rank-note">' + esc(t('rank_note').replace('{n}', MIN_VOTES)) + '</p>' : ''))
      : '<p class="muted">' + esc(t('rank_empty')) + '</p>';
  }

  function ring(total, like, dislike, broken) {
    var pct = function (n) { return total ? (n / total * 100) : 0; };
    var deg = function (n) { return pct(n) * 3.6; };
    return '<div class="ring" style="--d1:' + deg(like) + 'deg;--d2:' + deg(like + dislike) + 'deg">' +
      '<div class="ring-in"><b>' + total + '</b><span>' + esc(t('total_votes')) + '</span></div>' +
    '</div>';
  }
  function legend(color, label, num) {
    return '<div class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' +
      '<span class="legend-label">' + label + '</span><b>' + num + '</b></div>';
  }

  /* ───────────────────── 防护面板 ───────────────────── */
  function renderProtection() {
    var info = window.AntiAbuse.protectionInfo();
    $('#fpLabel').textContent = info.fingerprint;
    $('#layerGrid').innerHTML = info.layers.map(function (l, i) {
      return '<div class="layer">' +
        '<span class="layer-icon">' + l.icon + '</span>' +
        '<div><b>' + esc(t('layer' + (i + 1) + '_t')) + '</b><p>' + esc(t('layer' + (i + 1) + '_d')) + '</p></div>' +
      '</div>';
    }).join('');
  }

  /* ───────────────────── 常见问题 FAQ（分组手风琴） ───────────────────── */
  function renderFaq() {
    var host = $('#faqList');
    if (!host || !window.SITE_FAQ) return;
    var G = window.SITE_FAQ.GROUPS, I = window.SITE_FAQ.ITEMS;

    // 已展开项按分组记忆，切 Tab 回来不丢
    var opened = window.__faqOpen || (window.__faqOpen = {});
    var cur = state.faqGroup;
    if (!cur || !G.some(function (g) { return g.id === cur; })) cur = G[0].id;
    state.faqGroup = cur;

    var tabs = $('#faqTabs');
    if (tabs) {
      tabs.innerHTML = G.map(function (g) {
        return '<button class="faq-tab' + (g.id === cur ? ' on' : '') + '" data-g="' + g.id + '" type="button">' +
          esc(t(g.labelKey)) + '</button>';
      }).join('');
      tabs.onclick = function (e) {
        var b = e.target.closest('.faq-tab');
        if (!b) return;
        state.faqGroup = b.dataset.g;
        renderFaq();
      };
    }

    // i18n 用 faq_q{n} / faq_a{n} 覆盖，缺失时回落 faq-data.js 里的中文原文
    host.innerHTML = I.filter(function (it) { return it.g === cur; }).map(function (it) {
      var n = I.indexOf(it) + 1;
      var open = opened[cur + ':' + n];
      // i18n 未提供该条翻译时回落 faq-data.js 里的中文原文
      var qk = 'faq_q' + n, ak = 'faq_a' + n;
      return '<div class="faq-item' + (open ? ' open' : '') + '">' +
        '<button class="faq-q" type="button" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span>' + esc(t(qk) === qk ? it.q : t(qk)) + '</span><span class="faq-arrow">▶</span>' +
        '</button>' +
        '<div class="faq-a">' + (t(ak) === ak ? it.a : t(ak)) + '</div>' +
      '</div>';
    }).join('');

    host.onclick = function (e) {
      var q = e.target.closest('.faq-q');
      if (!q) return;
      var item = q.parentNode;
      var n = Array.prototype.indexOf.call(host.children, item) + 1;
      var key = cur + ':' + n;
      opened[key] = !item.classList.contains('open');
      item.classList.toggle('open', opened[key]);
      q.setAttribute('aria-expanded', opened[key] ? 'true' : 'false');
    };
  }

  /* ───────────────────── 搜索 ───────────────────── */
  function bindSearch() {
    var input = $('#search');
    var form = $('#searchForm');
    var timer = null;

    function run() {
      state.keyword = input.value;
      clearTimeout(timer);
      renderGrid();
      document.querySelector('.results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 输入时防抖即时搜索
    input.addEventListener('input', function (e) {
      state.keyword = e.target.value;
      clearTimeout(timer);
      timer = setTimeout(renderGrid, 180);
    });
    // 回车立即执行并滚到结果区
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
      if (e.key === 'Escape') { input.value = ''; state.keyword = ''; renderGrid(); input.blur(); }
    });
    // 表单提交（点「搜索」按钮或隐式回车）统一走这里
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); run(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    });
  }

  /* ───────────────────── Cookie / 本地存储同意条 ───────────────────── */
  /**
   * Cookie 同意条：只在真正接入广告后才显示。
   * 开关与发布商 ID 统一由 assets/js/ads-config.js 管理，
   * 那里把 enabled 改成 true 并填上 clientId 即可，无需改本文件。
   * （仅首次访问出现，点「好的」后记住不再显示）
   */
  function adsEnabled() {
    return !!(window.GypAds && window.GypAds.isEnabled());
  }

  function bindConsent() {
    var bar = $('#consentBar');
    if (!bar || !adsEnabled()) return;
    var accepted = false;
    try { accepted = localStorage.getItem('gyp:consent') === '1'; } catch (e) { /* 忽略 */ }
    if (!accepted) bar.hidden = false;
    var btn = $('#consentOk');
    if (btn) btn.addEventListener('click', function () {
      try { localStorage.setItem('gyp:consent', '1'); } catch (e) { /* 忽略 */ }
      bar.hidden = true;
    });
  }

  /* ───────────────────── 网站反馈表单 ───────────────────── */
  /** 反馈通道：只走「留言后台」（Cloudflare Pages Functions + KV，部署后生效，
      管理员在 admin.html 用 ADMIN_KEY 查看）。
      应站长要求已取消邮件通道（Web3Forms / mailto），访客联系方式不落邮箱，保护隐私。
      后台不可用时提示稍后再试。 */
  var FEEDBACK = {
    endpoint: '/api/feedback'
  };

  /** 反馈分类下拉：跟随语言重填（语言切换时调用） */
  function renderFeedbackCat() {
    var sel = $('#fbCat');
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = '<option value="">' + esc(t('fb_cat_none')) + '</option>' +
      CATS.map(function (c) {
        return '<option value="' + c.key + '">' + esc(catName(c)) + '</option>';
      }).join('');
    if (keep) sel.value = keep;
  }

  function bindFeedback() {
    var form = $('#fbForm');
    if (!form) return;
    var err = $('#fbErr');
    var status = $('#fbStatus');
    renderFeedbackCat();

    function showErr(msg) { if (err) { err.textContent = msg; err.hidden = !msg; } }
    function showStatus(msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'fb-status ' + (kind || 'ok');
      status.hidden = !msg;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var site = $('#fbSite').value.trim();
      var phone = $('#fbPhone').value.trim();
      var email = $('#fbEmail').value.trim();

      if (!site) { showErr(t('fb_err_site')); $('#fbSite').focus(); return; }
      if (!phone && !email) { showErr(t('fb_err_contact')); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr(t('fb_err_email')); $('#fbEmail').focus(); return; }
      if (phone && !/^[+\d][\d\s\-()]{5,19}$/.test(phone)) { showErr(t('fb_err_phone')); $('#fbPhone').focus(); return; }
      showErr('');

      // 直接留言：POST 到留言后台（Cloudflare Pages Functions + KV）
      if (!FEEDBACK.endpoint) { showStatus(t('fb_fail'), 'err'); return; }
      showStatus(t('fb_sending'), 'ok');
      fetch(FEEDBACK.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: site,
          cat: $('#fbCat').value || '',
          msg: $('#fbMsg').value.trim(),
          phone: phone,
          email: email
        })
      }).then(function (r) {
        if (r.status === 429) { showStatus(t('fb_rate'), 'err'); return; }
        if (r.ok) { showStatus(t('fb_ok'), 'ok'); form.reset(); return; }
        showStatus(t('fb_fail'), 'err');
      }).catch(function () { showStatus(t('fb_fail'), 'err'); });
    });
  }

  /** 刷新分类栏里「我的收藏」chip 的计数 */
  function updateFavChip() {
    $$('.cat-chip').forEach(function (b) {
      if (b.dataset.cat === '__fav__') {
        var n = b.querySelector('.cat-count');
        if (n) n.textContent = favCount();
      }
    });
  }

  /* ───────────────────── 手气不错 ───────────────────── */
  function bindLucky() {
    var btn = $('#luckyBtn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () {
      if (!SITES.length) return;
      // 随机挑一个站，清掉筛选保证它可见，滚动过去并脉冲高亮
      var pick = SITES[Math.floor(Math.random() * SITES.length)];
      state.category = 'all';
      state.region = 'all';
      state.keyword = '';
      state.onlyBroken = false;
      // 场景是另一条筛选轴，不清掉它随机挑的站可能不在场景清单里，
      // 结果列表里找不到这张卡，脉冲就打不到目标上
      state.scenario = '';
      $('#search').value = '';
      $('#regionSel').value = 'all';
      var bs = $('#brokenSel');
      if (bs) bs.classList.remove('active');
      $$('.cat-chip').forEach(function (b) { b.classList.toggle('active', b.dataset.cat === 'all'); });
      paintScenario();
      renderGrid();
      var card = document.querySelector('.site-card[data-id="' + CSS.escape(pick.id) + '"]');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('lucky-pulse');
        void card.offsetWidth; // 强制重排，让动画可以重复触发
        card.classList.add('lucky-pulse');
        setTimeout(function () { card.classList.remove('lucky-pulse'); }, 2400);
      }
    });
  }

  /* ───────────────────── 问题站点筛选 ───────────────────── */
  function bindBrokenFilter() {
    var btn = $('#brokenSel');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () {
      state.onlyBroken = !state.onlyBroken;
      btn.classList.toggle('active', state.onlyBroken);
      renderGrid();
    });
  }

  /* ───────────────────── 回顶按钮 ───────────────────── */
  function bindBackTop() {
    var btn = $('#backTop');
    if (!btn) return;

    function toggle() {
      btn.classList.toggle('show', window.scrollY > window.innerHeight * 0.8);
    }
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ───────────────────── 暗色主题切换 ───────────────────── */
  function bindThemeToggle() {
    var btn = $('#themeToggle');
    if (!btn) return;
    var root = document.documentElement;

    // 恢复上次选择；默认亮色
    try {
      if (localStorage.getItem('gyp:theme') === 'dark') root.setAttribute('data-theme', 'dark');
    } catch (e) { /* 隐私模式下忽略 */ }

    function sync() {
      var dark = root.getAttribute('data-theme') === 'dark';
      btn.textContent = dark ? '☀️' : '🌙';
      btn.title = dark ? t('theme_to_light') : t('theme_to_dark');
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    }

    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark';
      if (dark) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('gyp:theme', dark ? 'light' : 'dark'); } catch (e) { /* 忽略 */ }
      sync();
    });
    sync();
  }

  /* ───────────────────── 启动 ───────────────────── */
  /* ───────────── 微交互 ───────────── */

  function reducedMotion() {
    return !!(window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** 数字滚动：easeOutCubic，首屏指标专用 */
  function countUp(el, target, suffix) {
    if (!el) return;
    suffix = suffix || '';
    if (reducedMotion() || !isFinite(target) || target <= 0) return;
    var dur = 900, t0 = null;
    el.textContent = '0' + suffix;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /** 按 / 聚焦搜索框（搜索框里按 / 不劫持，方便输入） */
  function bindSearchHotkey() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                t.tagName === 'SELECT' || t.isContentEditable)) return;
      var inp = document.getElementById('search');
      if (!inp) return;
      e.preventDefault();
      inp.focus();
      inp.select();
    });
  }

  /** 区块进场渐显：轻微上浮，只跑一次（尊重减少动效偏好） */
  function bindReveal() {
    if (reducedMotion() || !('IntersectionObserver' in window)) return;
    var els = Array.prototype.slice.call(
      document.querySelectorAll('.section-head, .hero-kicker, .hero-title, .hero-sub, .hero-metrics'));
    if (!els.length) return;
    els.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.06 });
    els.forEach(function (el) { io.observe(el); });
  }

  function init() {
    // 标记 JS 可用：静态精选块（给爬虫看的内容）随之隐藏，避免与渲染网格重复
    document.documentElement.classList.add('js-on');

    // 渲染「今日新发现」热点区块（数据来自 trending.js，缺失时自动隐藏）
    try {
      if (window.TrendingUI) window.TrendingUI.init();
    } catch (e) { /* 热点区块失败不影响主功能 */ }

    // 加载广告脚本（未获批时 GypAds.isEnabled() 为 false，不会请求任何第三方资源）
    try {
      if (window.GypAds) window.GypAds.init();
    } catch (e) { /* 广告加载失败不影响页面 */ }
    // 蜜罐：视觉隐藏但对自动化脚本可见
    var hp = document.createElement('div');
    hp.className = 'hp-trap';
    hp.setAttribute('aria-hidden', 'true');
    hp.innerHTML = '<label>请勿填写<input type="text" name="gyp_website" tabindex="-1" autocomplete="off"></label>' +
                   '<label>邮箱<input type="text" name="gyp_email" tabindex="-1" autocomplete="off"></label>';
    document.body.appendChild(hp);

    state.voted = window.AntiAbuse.votedMap();

    // ── 跨皮肤 / 跨标签页数据同步 ──
    // V1(index.html) 与 V2(index-v2.html) 共用同一份投票与收藏数据；
    // 首次加载会把历史键里的老数据合并回规范键，之后任一页面的变动实时同步到另一页面。
    try {
      if (window.GYPShare) {
        window.GYPShare.migrate();                 // 合并历史/变体键 → 规范键
        state.counts = loadCounts();
        state.favs = loadFavs();
        window.GYPShare.onChange(function (counts, favs) {
          state.counts = counts;
          state.favs = favs;
          state.voted = window.AntiAbuse.votedMap();
          Object.keys(state.voted).forEach(function (id) { markVotedUI(id); });
          renderGrid();
          renderStats();
          updateFavChip();
        });
      }
    } catch (e) { /* 同步层不可用时不影响基本使用 */ }

    // 语言切换时由 i18n 调用：重渲染所有含文案的动态区块
    // （分类栏/筛选器的监听器已有 _bound 守卫，不会重复绑定）
    window.__gypRefresh = function () {
      renderCategories();
      renderSideCats();
      renderFilters();
      renderFeedbackCat();
      renderGrid();
      renderStats();
      renderProtection();
      renderFaq();
      paintScenario();
      try {
        if (window.TrendingUI) window.TrendingUI.render();
      } catch (e) { /* 忽略 */ }
    };

    renderCategories();
    renderFilters();
    bindSearch();
    bindBackTop();
    bindThemeToggle();
    bindConsent();
    bindFeedback();
    bindLucky();
    bindBrokenFilter();
    bindScenes();
    renderSideCats();
    bindSideCats();
    renderGrid();
    renderStats();
    renderProtection();
    renderFaq();

    // 微交互：/ 聚焦搜索、区块渐显、首屏指标数字滚动（只此一次）
    bindSearchHotkey();
    bindReveal();
    countUp(document.getElementById('statSites'), SITES.length);
    countUp(document.getElementById('statLike'), parseInt(document.getElementById('statLike').textContent, 10));
    countUp(document.getElementById('healthPct'), parseInt(document.getElementById('healthPct').textContent, 10), '%');

    // 回填：把本机已投过的卡片标记为已投票
    Object.keys(state.voted).forEach(function (id) { markVotedUI(id); });

    // 从服务端拉全站票数与「我投过什么」，让数据在所有人之间共享
    syncFromServer();

    $('#year').textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();