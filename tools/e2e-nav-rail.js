/**
 * E2E：验证三项导航/侧栏改动
 *   1. 点「网站目录」后，分类栏（不只是结果列表）确实出现在视口顶部
 *   2. 左侧竖排目录显示分类文字（宽屏默认显示；中等宽度可 hover / 点开关展开）
 *   3. V2(index-v2.html) 也有左侧竖排目录
 *
 * 用法：node tools/e2e-nav-rail.js          本地静态服务器
 *      node tools/e2e-nav-rail.js --live    直接测 https://ypage.ccwu.cc
 * 需要：本机 Chrome；跑完自动清理临时 profile / 静态服务器
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PY = 'C:\\Python\\Python312\\python.exe';
const ROOT = path.resolve(__dirname, '..');
const CDP_PORT = 9223;
const HTTP_PORT = 8897;
const LIVE = process.argv.includes('--live');
const BASE = LIVE ? 'https://ypage.ccwu.cc' : `http://127.0.0.1:${HTTP_PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  close() { try { this.ws.close(); } catch (e) { /* ignore */ } }
}

async function waitReady(cdp, sid, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await cdp.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sid);
    if (r.result && r.result.value === 'complete') return true;
    await sleep(300);
  }
  return false;
}

async function evaluate(cdp, sid, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

/* 检查分类栏是否「看得见」：顶边不被吸顶导航盖住，且整块在视口内 */
const CAT_VISIBLE_JS = `(() => {
  const sec = document.getElementById('catSection');
  if (!sec) return { err: '没有 #catSection' };
  const r = sec.getBoundingClientRect();
  const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60;
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    navH: navH, vh: window.innerHeight,
    belowNav: r.top >= navH - 4,
    inViewport: r.top >= 0 && r.top < window.innerHeight * 0.6,
    barVisible: (() => {
      const bar = document.getElementById('catBar');
      if (!bar) return false;
      const br = bar.getBoundingClientRect();
      return br.top < window.innerHeight && br.bottom > 0 && br.height > 0;
    })(),
  };
})()`;

/* 侧栏分类名是否真的渲染出可见文字 */
const RAIL_TEXT_JS = `(() => {
  const rail = document.getElementById('sideCats');
  if (!rail) return { err: '页面没有 #sideCats' };
  const names = Array.from(rail.querySelectorAll('.cat-chip .cat-name'));
  const visible = names.filter(n => {
    const r = n.getBoundingClientRect();
    return n.offsetParent !== null && r.width > 0 && r.height > 0;
  });
  return {
    chips: rail.querySelectorAll('.cat-chip').length,
    names: names.length,
    visibleNames: visible.length,
    sample: visible.slice(0, 3).map(n => n.textContent),
    railWidth: Math.round(rail.getBoundingClientRect().width),
    hasToggle: !!rail.querySelector('.side-cats-toggle'),
  };
})()`;

(async function main() {
  if (!fs.existsSync(CHROME)) { console.error('找不到 Chrome：' + CHROME); process.exit(2); }

  const server = LIVE ? null : spawn(PY, ['-m', 'http.server', String(HTTP_PORT)], { cwd: ROOT, stdio: 'ignore' });
  if (server) await sleep(1200);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gyp-rail-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900',
  ];
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (LIVE && proxy) args.push('--proxy-server=' + proxy, '--ignore-certificate-errors');
  args.push('about:blank');
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });

  const results = [];
  const record = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? '✅ ' : '❌ ') + name + (detail ? '  → ' + detail : '')); };

  try {
    const version = await (async () => {
      for (let i = 0; i < 60; i++) {
        try { return await getJSON(`http://127.0.0.1:${CDP_PORT}/json/version`); } catch (e) { await sleep(500); }
      }
      throw new Error('Chrome 调试端口未就绪');
    })();

    const cdp = await CDP.connect(version.webSocketDebuggerUrl);
    const openTab = async () => {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});",
      }, sessionId);
      return { sid: sessionId, targetId };
    };
    const goto = async (sid, url, wait = 2400) => {
      await cdp.send('Page.navigate', { url }, sid);
      await waitReady(cdp, sid);
      await sleep(wait);
    };
    const setViewport = async (sid, w, h) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 1, mobile: false,
      }, sid);
      await sleep(600);
    };

    const pages = [['V1', '/index.html'], ['V2', '/index-v2.html']];

    // ── 用例 1 & 3：1440 宽下，点「网站目录」后分类栏可见；侧栏有文字 ──
    for (const [label, page] of pages) {
      const { sid, targetId } = await openTab();
      await setViewport(sid, 1440, 900);
      await goto(sid, BASE + page);

      const rail = await evaluate(cdp, sid, RAIL_TEXT_JS);
      record(`${label} 左侧目录渲染`, !rail.err && rail.chips >= 10,
        rail.err || `${rail.chips} 个分类 / 侧栏宽 ${rail.railWidth}px / 开关 ${rail.hasToggle ? '有' : '无'}`);
      record(`${label} 侧栏显示分类文字`, rail.visibleNames >= 10,
        `可见文字 ${rail.visibleNames}/${rail.names} 例：${(rail.sample || []).join('、')}`);

      // 点顶部导航「网站目录」
      await evaluate(cdp, sid, `document.querySelector('.topnav a[href="#catSection"]').click(); 'clicked'`);
      await sleep(1800); // 等 smooth 滚动结束
      const cat = await evaluate(cdp, sid, CAT_VISIBLE_JS);
      record(`${label} 点「网站目录」后分类栏可见`,
        !cat.err && cat.belowNav && cat.inViewport && cat.barVisible,
        cat.err || `分类栏 top=${cat.top}（导航高 ${cat.navH}）分类按钮可见=${cat.barVisible}`);

      // 点侧栏里的分类，滚动后分类栏仍应在视口内
      await evaluate(cdp, sid, `(() => {
        const chips = document.querySelectorAll('#sideCats .cat-chip');
        chips[Math.min(3, chips.length - 1)].click();
        return 'clicked';
      })()`);
      await sleep(1800);
      const cat2 = await evaluate(cdp, sid, CAT_VISIBLE_JS);
      const activeCat = await evaluate(cdp, sid, `(() => {
        const a = document.querySelector('#sideCats .cat-chip.active');
        return a ? a.querySelector('.cat-name').textContent : null;
      })()`);
      record(`${label} 点侧栏分类后仍能看到目录`,
        !cat2.err && cat2.belowNav && cat2.inViewport && !!activeCat,
        cat2.err || `当前分类「${activeCat}」/ 分类栏 top=${cat2.top}`);
      await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    }

    // ── 用例 2：中等宽度 1280，默认收起只留图标；点开关后展开显示文字 ──
    const { sid: sid2 } = await openTab();
    await setViewport(sid2, 1280, 800);
    await goto(sid2, BASE + '/index.html');
    const collapsed = await evaluate(cdp, sid2, RAIL_TEXT_JS);
    record('1280 宽下侧栏默认收起为图标', collapsed.railWidth <= 48,
      `侧栏宽 ${collapsed.railWidth}px / 可见文字 ${collapsed.visibleNames}`);

    await evaluate(cdp, sid2, `document.querySelector('#sideCats .side-cats-toggle').click(); 'pinned'`);
    await sleep(700);
    const expanded = await evaluate(cdp, sid2, RAIL_TEXT_JS);
    record('1280 宽下点开关可展开显示文字', expanded.visibleNames >= 10 && expanded.railWidth >= 100,
      `侧栏宽 ${expanded.railWidth}px / 可见文字 ${expanded.visibleNames} 例：${(expanded.sample || []).join('、')}`);

    // 固定状态应跨刷新保留
    await goto(sid2, BASE + '/index.html', 2000);
    const persisted = await evaluate(cdp, sid2, RAIL_TEXT_JS);
    record('展开状态刷新后仍保留', persisted.visibleNames >= 10,
      `可见文字 ${persisted.visibleNames} / 侧栏宽 ${persisted.railWidth}px`);
    await evaluate(cdp, sid2, `localStorage.removeItem('gyp:railPin'); 'cleared'`);

    // 窄屏应完全隐藏，避免占地方
    await setViewport(sid2, 1000, 800);
    const narrow = await evaluate(cdp, sid2, `(() => {
      const rail = document.getElementById('sideCats');
      return getComputedStyle(rail).display;
    })()`);
    record('窄屏（1000）隐藏侧栏', narrow === 'none', `display=${narrow}`);

    cdp.close();
  } finally {
    try { if (server) server.kill(); } catch (e) { /* ignore */ }
    try { chrome.kill(); } catch (e) { /* ignore */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  const failed = results.filter(r => !r.pass);
  console.log('\n结果：' + (results.length - failed.length) + '/' + results.length + ' 通过（' + (LIVE ? '线上' : '本地') + '）');
  if (failed.length) { console.log('失败项：' + failed.map(f => f.name).join('、')); process.exit(1); }
  console.log('ALL PASS');
})().catch(e => { console.error('运行失败：', e.message); process.exit(2); });
