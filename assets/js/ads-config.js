/**
 * ads-config.js — 广告接入配置
 *
 * 为什么要单独一个文件：申请 AdSense 时只需要改这里，
 * 不必去动首页 HTML 或主逻辑代码，降低改坏站点的风险。
 *
 * ── 申请流程与本文件的对应关系 ──
 *   第 1 步：在 https://adsense.google.com 申请账号
 *   第 2 步：拿到发布商 ID（形如 pub-1234567890123456）
 *             → 填到下面 clientId
 *   第 3 步：把 ads.txt 里的占位行替换成 Google 给的那一行
 *   第 4 步：把 enabled 改成 true
 *   第 5 步：等待审核（通常 1-2 周）
 *
 * ── 关于「代码可见但脚本不加载」──
 * AdSense 审核时会检查页面里有没有 adsbygoogle 代码。
 * 但没获批之前加载 adsbygoogle.js 是浪费带宽，还会拖慢首屏。
 * 所以这里的做法是：
 *   · 广告位容器（.ad-slot）始终渲染在页面里 —— 审核看得到版位
 *   · adsbygoogle 脚本由 loadAdsenseScript() 按需注入 —— 获批才真正拉取
 *   · 审核前不注入任何第三方脚本，页面速度不受影响
 */
window.GypAds = (function () {
  'use strict';

  /** 获批后改成 true。false 时只保留广告位容器，不加载任何广告脚本 */
  var enabled = false;

  /** 发布商 ID：ca-pub-1234567890123456（获批后填） */
  var clientId = '';

  /** 加载 adsbygoogle.js 并推送广告位 */
  var loaded = false;

  function loadAdsenseScript() {
    if (loaded || !enabled || !clientId) return;
    loaded = true;

    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
            encodeURIComponent(clientId);
    (document.head || document.documentElement).appendChild(s);

    // 脚本加载完成后，把页面上的广告位推给 AdSense
    s.addEventListener('load', function () {
      try {
        var slots = document.querySelectorAll('.ad-slot ins.adsbygoogle');
        for (var i = 0; i < slots.length; i++) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) { /* 广告加载失败不影响页面 */ }
    });
  }

  return {
    isEnabled: function () { return !!(enabled && clientId); },
    getClientId: function () { return clientId; },
    load: loadAdsenseScript,
    /** 页面加载完成后调用 */
    init: function () {
      if (!this.isEnabled()) return;
      loadAdsenseScript();
    }
  };
})();
