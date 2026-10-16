/**
 * Thumbnails — 首页截图服务（纯前端多级降级）
 *
 * 为什么必须降级：免费截图服务各有各的失败原因——
 *   · 目标站屏蔽了截图服务的出口 IP
 *   · 站点需要登录 / 有反爬 / 有 WAF
 *   · 服务方额度用尽或线路不通（国内访问 WordPress 线路经常直接失败）
 *   · 站点本身已经打不开（这恰恰是「无法访问」投票最有价值的时候）
 * 所以准备多条独立通道，任一成功即止；全失败则降级为 favicon + 品牌色占位卡。
 *
 * 通道优先级（按国内实测稳定性排序）：
 *   ① Microlink API  —— 独立 SaaS，返回 JSON 里带截图直链，国内可达
 *   ② mShots         —— 微软 Azure 上的开源服务，免费无限，但国内线路不稳
 *   ③ Google favicon —— 图标服务，可用即说明域名能解析
 *   ④ 占位卡         —— 站点名首字母 + 品牌色，纯 CSS，无需网络
 */

const Thumbnails = (function () {

  /** ① Microlink：先取 JSON，再从 data.screenshot.url 拿图片直链 */
  function microlinkApi(url) {
    return 'https://api.microlink.io/?url=' + encodeURIComponent(url) +
      '&screenshot=true&meta=false&waitForTimeout=8000';
  }

  /** ② mShots：path 直接拼 URL，无需 key。参数 w 只能出现一次。 */
  function shotMsShots(url, w, h) {
    return 'https://s.wordpress.com/mshots/v1/' +
      encodeURIComponent(url) + '?w=' + w + '&h=' + h;
  }

  /** 取 JSON 里 Microlink 的截图直链，失败返回 null */
  function fetchMicrolink(url, timeoutMs) {
    return fetch(microlinkApi(url), { signal: AbortSignal.timeout(timeoutMs || 12000) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || j.status !== 'success' || !j.data || !j.data.screenshot) return null;
        return j.data.screenshot.url || null;
      })
      .catch(function () { return null; });
  }

  /**
   * 探测图片可用性。成功时返回已解码的 img 对象，
   * 直接复用给页面渲染，避免二次网络请求（那是截图大面积降级的主因）。
   */
  function probe(src, timeoutMs) {
    return new Promise(function (resolve) {
      const img = new Image();
      let settled = false;
      const done = function (ok) {
        if (settled) return;
        settled = true;
        img.onload = null;
        img.onerror = null;
        resolve(ok ? img : null);
      };
      img.referrerPolicy = 'no-referrer';
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        // 部分服务失败时返回 1x1 或极小尺寸的占位像素，这种不算成功
        done(img.naturalWidth > 40 && img.naturalHeight > 40);
      };
      img.onerror = function () { done(false); };
      setTimeout(function () { done(false); }, timeoutMs || 7000);
      img.src = src;
    });
  }

  /**
   * 依次尝试各条通道，返回第一条可用的图。
   * @returns {Promise<{img:HTMLImageElement|null, level:string}>}
   */
  async function resolve(site) {
    const url = site.url;
    let img;

    // ① Microlink：国内实测最稳的一路
    const direct = await fetchMicrolink(url);
    if (direct) {
      img = await probe(direct, 8000);
      if (img) return { img: img, level: 'microlink' };
    }

    // ② mShots：备用通道
    img = await probe(shotMsShots(url, 640, 400), 6000);
    if (img) return { img: img, level: 'mshots' };

    // ③ favicon
    if (site.favicon) {
      img = await probe(site.favicon, 4000);
      if (img) return { img: img, level: 'favicon' };
    }

    // ④ 什么都不给，交给占位卡
    return { img: null, level: 'placeholder' };
  }

  /**
   * 并发闸门：截图服务对突发请求敏感，303 张卡同时发起会被判限流。
   * 全局限 4 个并发，超出的排队。
   */
  var MAX_CONCURRENT = 4;
  var active = 0;
  var queue = [];

  function schedule(task) {
    return new Promise(function (resolve) {
      queue.push({ task: task, resolve: resolve });
      pump();
    });
  }

  function pump() {
    while (active < MAX_CONCURRENT && queue.length) {
      var item = queue.shift();
      active++;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve)
        .catch(function () { item.resolve(null); })
        .then(function () { active--; pump(); });
    }
  }

  /**
   * 为一张站点卡片渲染截图区域。
   * 先显示品牌色骨架屏，边加载边替换，失败落占位卡。
   */
  function attach(cardEl, site) {
    const holder = cardEl.querySelector('.site-shot');
    if (!holder) return;

    holder.innerHTML =
      '<div class="shot-skeleton" style="--brand:' + site.brand + ';--brand-soft:' + site.brandSoft + '">' +
        '<div class="shot-url">' + escapeHtml(site.domain) + '</div>' +
      '</div>';

    schedule(function () { return resolve(site); }).then(function (r) {
      if (!r || !r.img) { renderPlaceholder(holder, site); return; }
      const img = r.img;
      img.alt = site.name + ' 首页截图';
      img.className = 'shot-img';
      holder.innerHTML = '';
      holder.classList.add('is-shot');
      if (r.level === 'favicon') holder.classList.add('is-favicon');
      holder.appendChild(img);
    });
  }

  /** 占位卡：首字母 + 品牌渐变，纯 CSS */
  function renderPlaceholder(holder, site) {
    holder.classList.remove('is-shot');
    holder.classList.add('is-placeholder');
    const initial = (site.name || '?').trim().charAt(0).toUpperCase();
    holder.innerHTML =
      '<div class="shot-fallback" style="--brand:' + site.brand + ';--brand-soft:' + site.brandSoft + '">' +
        '<div class="fb-mark">' + escapeHtml(initial) + '</div>' +
        '<div class="fb-domain">' + escapeHtml(site.domain) + '</div>' +
        '<div class="fb-note">截图不可用</div>' +
      '</div>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { resolve: resolve, attach: attach, escapeHtml: escapeHtml };
})();

window.Thumbnails = Thumbnails;