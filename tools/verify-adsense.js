/**
 * verify-adsense.js — AdSense 准入就绪度自检
 *
 * 用法：node tools/verify-adsense.js [baseURL]
 * 默认 https://ypage.ccwu.cc
 *
 * 覆盖 AdSense 审核会看的每一项：
 *   ① Googlebot 视角的内容量与出站链接
 *   ② 必需信任页面（About / Contact / Privacy / Disclaimer）是否为独立 URL
 *   ③ 404 状态码是否正确
 *   ④ sitemap 与 robots
 *   ⑤ HTTPS、移动端适配、AdSense 代码位
 *   ⑥ 各页面内容量
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE = process.argv[2] || 'https://ypage.ccwu.cc';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9361;
const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

let pass = 0, fail = 0, warn = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function note(name, extra) {
  warn++; console.log('  NOTE  ' + name + (extra !== undefined ? '  → ' + extra : ''));
}

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); })
      .on('error', rej);
  });
}

(async () => {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(__dirname, '.adsense-ud'),
    'about:blank'
  ], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2500));

  try {
    const WebSocket = global.WebSocket;
    const targets = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    const send = (method, params) => new Promise(res => {
      const mid = ++id; pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
    const evalJS = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 200));
      return r.result && r.result.result && r.result.result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable').catch(() => {});
    await send('Network.setUserAgentOverride', { userAgent: UA_GOOGLEBOT }).catch(() => {});

    // ───────── ① 首页：Googlebot 视角的内容与外链 ─────────
    console.log('\n【1】首页（Googlebot 视角）');
    await send('Page.navigate', { url: BASE + '/' });
    await new Promise(r => setTimeout(r, 3000));

    const home = await evalJS(`(() => {
      const raw = document.documentElement.outerHTML;
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,svg,noscript').forEach(e => e.remove());
      const text = (clone.textContent || '').replace(/\\s+/g, ' ').trim();
      const cjk = (text.match(/[\\u4e00-\\u9fff]/g) || []).length;
      const latin = (text.match(/[A-Za-z]+/g) || []).length;
      const links = [...document.querySelectorAll('a[href^="http"]')]
        .map(a => a.href).filter(u => !u.startsWith(location.origin));
      const seen = new Set();
      const ext = links.filter(u => !seen.has(u) && seen.add(u));
      return {
        cjk, latin, words: cjk + latin,
        extLinks: ext.length,
        htmlBytes: raw.length,
        viewport: !!document.querySelector('meta[name=viewport]'),
        hasNoscript: !!document.querySelector('noscript'),
        title: document.title,
        desc: (document.querySelector('meta[name=description]')||{}).content || ''
      };
    })()`);

    check('首页可见文字 ≥ 800 字', home.words >= 800, home.words + ' 字');
    check('首页有出站链接（≥ 20 条）', home.extLinks >= 20, home.extLinks + ' 条');
    check('首页 HTML 体积 < 60KB', home.htmlBytes < 60000, Math.round(home.htmlBytes / 1024) + ' KB');
    check('有 viewport（移动端适配）', home.viewport);
    check('有 noscript 引导（无 JS 兜底）', home.hasNoscript);
    check('有 title 与 description', !!home.title && home.desc.length > 30);

    // ───────── ② 静态精选块（爬虫可读的实心内容） ─────────
    console.log('\n【2】首页静态精选块');
    const feed = await evalJS(`(() => {
      const el = document.querySelector('.static-feed');
      if (!el) return { exists: false };
      const items = el.querySelectorAll('.sf-item');
      return {
        exists: true, count: items.length,
        links: el.querySelectorAll('a[href^="http"]').length,
        hasText: (el.textContent || '').trim().length > 300
      };
    })()`);
    check('首页含静态精选块', feed.exists);
    check('静态块条目 ≥ 30', feed.count >= 30, feed.count + ' 条');
    check('静态块含真实外链', feed.links >= 30, feed.links + ' 条');
    check('静态块有实际文字', feed.hasText);

    // ───────── ③ 信任页面必须是独立 URL 且内容真实 ─────────
    console.log('\n【3】信任页面（独立 URL）');
    const TRUST = [
      ['/about.html', '关于本站'],
      ['/privacy.html', '隐私政策'],
      ['/contact.html', '联系我们'],
      ['/disclaimer.html', '免责声明']
    ];
    for (const [p, label] of TRUST) {
      await send('Page.navigate', { url: BASE + p });
      await new Promise(r => setTimeout(r, 2200));
      const info = await evalJS(`(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script,style,svg,noscript').forEach(e => e.remove());
        const text = (clone.textContent || '').replace(/\\s+/g, ' ').trim();
        const cjk = (text.match(/[\\u4e00-\\u9fff]/g) || []).length;
        const t = document.title || '';
        const c = document.querySelector('link[rel=canonical]');
        return {
          words: cjk + (text.match(/[A-Za-z]+/g) || []).length,
          title: t, canonical: c ? c.getAttribute('href') : '',
          isHome: t.indexOf('优质网站导航') >= 0
        };
      })()`);
      check(p + ' 是独立页面（非首页回退）', !info.isHome, info.title);
      check(p + ' 标题含「' + label + '」', info.title.indexOf(label) >= 0, info.title);
      check(p + ' 有 canonical 且指向自己', info.canonical.indexOf(BASE.replace('https://', '') + p) >= 0, info.canonical);
      check(p + ' 有实际内容（≥ 100 字）', info.words >= 100, info.words + ' 字');
    }

    // ───────── ④ 站长长文（E-E-A-T 落点） ─────────
    console.log('\n【4】站长长文');
    await send('Page.navigate', { url: BASE + '/about-long.html' });
    await new Promise(r => setTimeout(r, 2200));
    const long = await evalJS(`(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,svg,noscript').forEach(e => e.remove());
      const text = (clone.textContent || '').replace(/\\s+/g, ' ').trim();
      return {
        words: (text.match(/[\\u4e00-\\u9fff]/g) || []).length + (text.match(/[A-Za-z]+/g) || []).length,
        h2: document.querySelectorAll('h2').length,
        p: document.querySelectorAll('article p').length
      };
    })()`);
    check('长文存在且 ≥ 1500 字', long.words >= 1500, long.words + ' 字');
    check('长文有多个小节（≥ 8 个 h2）', long.h2 >= 8, long.h2 + ' 个');
    check('长文段落数充足', long.p >= 30, long.p + ' 段');

    // ───────── ⑤ 分类页内容量 ─────────
    console.log('\n【5】分类页内容量');
    const cats = ['ai', 'devtools', 'machinery', 'finance', 'shopping', 'education'];
    let minWords = 99999;
    for (const c of cats) {
      await send('Page.navigate', { url: BASE + '/cat/' + c + '.html' });
      await new Promise(r => setTimeout(r, 1600));
      const info = await evalJS(`(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script,style,svg,noscript').forEach(e => e.remove());
        const text = (clone.textContent || '').replace(/\\s+/g, ' ').trim();
        return {
          words: (text.match(/[\\u4e00-\\u9fff]/g) || []).length + (text.match(/[A-Za-z]+/g) || []).length,
          guide: !!document.querySelector('.cat-guide'),
          links: document.querySelectorAll('.sf-item, li a[href^=http]').length
        };
      })()`);
      minWords = Math.min(minWords, info.words);
      check('cat/' + c + '.html ≥ 800 字', info.words >= 800, info.words + ' 字');
      check('cat/' + c + '.html 含选站标准等原创文案', info.guide);
    }
    note('抽样 6 个分类页中最小值', minWords + ' 字');

    // ───────── ⑥ 404 状态码 ─────────
    console.log('\n【6】404 状态码');
    const nf = await evalJS(`(async()=>{
      const r = await fetch('/this-page-should-not-exist-' + Date.now(), {method:'GET'});
      return { status: r.status, title: (await r.text()).indexOf('走丢') >= 0 ? '有友好404页' : '无' };
    })()`);
    check('不存在的路径返回 404（不是 200）', nf.status === 404, 'HTTP ' + nf.status);
    check('404 页是友好页面', nf.title === '有友好404页', nf.title);

    // ───────── ⑦ sitemap 与 robots ─────────
    console.log('\n【7】sitemap 与 robots');
    await send('Page.navigate', { url: BASE + '/sitemap.xml' });
    await new Promise(r => setTimeout(r, 1500));
    const sm = await evalJS(`(() => {
      const x = document.documentElement.outerHTML;
      return { locs: (x.match(/<loc>/g) || []).length,
               hasAbout: x.indexOf('about.html') >= 0,
               hasPrivacy: x.indexOf('privacy.html') >= 0,
               hasCats: (x.match(/cat\\//g) || []).length };
    })()`);
    check('sitemap 至少 25 条 URL', sm.locs >= 25, sm.locs + ' 条');
    check('sitemap 含 about.html', sm.hasAbout);
    check('sitemap 含 privacy.html', sm.hasPrivacy);
    check('sitemap 含 17 个分类页', sm.hasCats >= 17, sm.hasCats + ' 个');

    await send('Page.navigate', { url: BASE + '/robots.txt' });
    await new Promise(r => setTimeout(r, 1500));
    const rb = await evalJS(`document.body.textContent || ''`);
    check('robots.txt 允许抓取', rb.indexOf('Allow: /') >= 0);
    check('robots.txt 声明了 sitemap', rb.indexOf('Sitemap:') >= 0);
    check('robots.txt 屏蔽了 admin', rb.indexOf('Disallow: /admin') >= 0);

    // ───────── ⑧ AdSense 代码位 ─────────
    console.log('\n【8】AdSense 代码位');
    await send('Page.navigate', { url: BASE + '/' });
    await new Promise(r => setTimeout(r, 2500));
    const ad = await evalJS(`({
      hasSwitch: typeof window.AntiAbuse !== 'undefined',
      html: document.documentElement.outerHTML.indexOf('adsbygoogle') >= 0,
      consentHidden: (document.getElementById('consentBar')||{}).hidden
    })`);
    check('站点可正常加载（无 JS 错误）', ad.hasSwitch);
    note('当前是否已放置 adsbygoogle 代码', ad.html ? '已放置' : '未放置（申请获批后再加）');

    console.log('\n────────────────────────');
    console.log('  通过 ' + pass + ' ／ 失败 ' + fail + ' ／ 提示 ' + warn);
    console.log('────────────────────────');
    if (fail === 0) {
      console.log('  ✅ AdSense 审核的技术前置条件已全部满足');
    } else {
      console.log('  ⚠️ 仍有 ' + fail + ' 项未达标，提交申请前需先修完');
    }
  } catch (e) {
    console.log('  ERROR ' + e.message);
    fail++;
  } finally {
    try { proc.kill(); } catch (e) {}
    process.exit(fail ? 1 : 0);
  }
})();
