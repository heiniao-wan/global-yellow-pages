/* 站点分析 · Cloudflare Web Analytics
 * ---------------------------------------------------------------
 * 为什么选它：无 Cookie、不做跨站追踪、不采集个人数据，不触发
 * GDPR/CCPA 的同意横幅要求，也不违反 AdSense 关于隐私的政策。
 *
 * 启用方式（二选一，不要同时做，否则同一访问会被记两次）：
 *   A. 自动模式：Cloudflare 控制台 →「分析」→「Web Analytics」→ 添加站点
 *      → 选「自动设置」。此时下面的 CF_TOKEN 保持为空即可，
 *      本脚本会直接返回，不产生任何请求。
 *   B. 手动模式：同一页面选「手动设置」，复制 token 填进 CF_TOKEN。
 *
 * 留空时本脚本什么都不做，不会报错、不会阻塞页面。
 */
(function () {
  var CF_TOKEN = '';  // ← 手动模式时把 Cloudflare 给的 token 填在这里

  if (!CF_TOKEN) return;

  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', '{"token":"' + CF_TOKEN + '"}');
  document.head.appendChild(s);
})();
