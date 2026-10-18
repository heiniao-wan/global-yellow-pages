/**
 * E2E：验证 V1(index.html) 与 V2(index-v2.html) 的投票 / 收藏数据是否共享
 *
 * 用法：node tools/e2e-vote-share.js
 * 需要：本机 Chrome；会临时起一个 8899 静态服务器 + 独立 Chrome 用户目录（跑完清理）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PY = 'C:\\Python\\Python312\\python.exe';
const ROOT = path.resolve(__dirname, '..');
const CDP_PORT = 9222;
const HTTP_PORT = 8899;
// 默认跑本地静态服务器；传 --live 则直接测线上站点
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

// ---------- CDP 客户端 ----------
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

async function waitReady(cdp, sid, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: 'document.readyState', returnByValue: true,
    }, sid);
    if (r.result && r.result.value === 'complete') return true;
    await sleep(300);
  }
  return false;
}

async function evaluate(cdp, sid, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
  return r.result.value;
}

(async function main() {
  if (!fs.existsSync(CHROME)) { console.error('找不到 Chrome：' + CHROME); process.exit(2); }

  // 1) 静态服务器（仅本地模式需要）
  const server = LIVE ? null : spawn(PY, ['-m', 'http.server', String(HTTP_PORT)], { cwd: ROOT, stdio: 'ignore' });
  if (server) await sleep(1200);

  // 2) Chrome（独立 profile，保证 localStorage 干净且在两个页面间共享）
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gyp-e2e-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1400,900',
  ];
  // 线上模式需要走与 curl 相同的本地代理，否则 Chrome 连不上外网
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (LIVE && proxy) args.push('--proxy-server=' + proxy, '--ignore-certificate-errors');
  args.push('about:blank');
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });

  let ok = true;
  try {
    const version = await (async () => {
      for (let i = 0; i < 60; i++) {
        try { return await getJSON(`http://127.0.0.1:${CDP_PORT}/json/version`); } catch (e) { await sleep(500); }
      }
      throw new Error('Chrome 调试端口未就绪');
    })();

    const cdp = await CDP.connect(version.webSocketDebuggerUrl);
    const openTab = async (url) => {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});",
      }, sessionId);
      if (url) { await cdp.send('Page.navigate', { url }, sessionId); }
      return sessionId;
    };

    const goto = async (sid, url, wait = 2600) => {
      await cdp.send('Page.navigate', { url }, sid);
      await waitReady(cdp, sid);
      await sleep(wait);
    };

    // ---- 0. 先验：历史/变体键能否被合并回来 ----
    const sid0 = await openTab(null);
    await goto(sid0, BASE + '/index.html');
    await evaluate(cdp, sid0, `localStorage.setItem('gyp:counts', JSON.stringify({'google-0': {like: 7, dislike: 1, broken: 0}})); 'seeded'`);
    await goto(sid0, BASE + '/index-v2.html');
    const migrated = await evaluate(cdp, sid0, `(() => {
      const card = document.querySelector('.site-card[data-id="google-0"]');
      return {
        shown: card ? card.querySelector('[data-count="like"]').textContent : null,
        canonical: localStorage.getItem('gyp:counts:') ? '存在' : '无',
        legacyLeft: localStorage.getItem('gyp:counts') === null ? '已清理' : '仍在',
      };
    })()`);
    console.log('[迁移] 旧键 gyp:counts → V2：', JSON.stringify(migrated));
    const migrateOk = Number(migrated.shown) === 7 && migrated.canonical === '存在';
    // 清干净，避免干扰后续用例
    await evaluate(cdp, sid0, `['gyp:counts:','gyp:counts','gyp:favs:','gyp:favs'].forEach(k=>localStorage.removeItem(k)); 'cleared'`);

    // ---- A. V1 页面投票 + 收藏 ----
    const sid = sid0;
    await cdp.send('Page.navigate', { url: BASE + '/index.html' }, sid);
    await waitReady(cdp, sid);
    await sleep(2600); // 满足 dwell(800ms) 与首屏渲染

    const a = await evaluate(cdp, sid, `(() => {
      const btn = document.querySelector('.site-card .vote-btn[data-vote="like"]');
      const star = document.querySelector('.site-card .fav-star');
      if (!btn) return { err: 'V1 没有渲染出投票按钮' };
      const id = btn.dataset.id;
      btn.click();
      if (star) star.click();
      return { siteId: id, starId: star ? star.dataset.fav : null };
    })()`);
    if (a.err) throw new Error(a.err);
    await sleep(800);

    const afterV1 = await evaluate(cdp, sid, `(() => {
      const raw = localStorage.getItem('gyp:counts:');
      const favRaw = localStorage.getItem('gyp:favs:');
      const c = raw && window.Vault ? window.Vault.open(raw) : null;
      const f = favRaw && window.Vault ? window.Vault.open(favRaw) : null;
      const btn = document.querySelector('.site-card .vote-btn[data-vote="like"]');
      return {
        siteId: btn ? btn.dataset.id : null,
        shown: btn ? btn.querySelector('[data-count="like"]').textContent : null,
        stored: c && btn ? c[btn.dataset.id] : null,
        favCount: f ? Object.keys(f).filter(k => f[k]).length : 0,
        rawLen: raw ? raw.length : 0,
      };
    })()`);
    console.log('[V1] 投票后：', JSON.stringify(afterV1));
    const votedId = afterV1.siteId;

    // ---- B. 同一浏览器打开 V2 ----
    await cdp.send('Page.navigate', { url: BASE + '/index-v2.html' }, sid);
    await waitReady(cdp, sid);
    await sleep(2600);

    const onV2 = await evaluate(cdp, sid, `(() => {
      const card = document.querySelector('.site-card[data-id="' + ${JSON.stringify(votedId)} + '"]');
      const raw = localStorage.getItem('gyp:counts:');
      const favRaw = localStorage.getItem('gyp:favs:');
      const c = raw && window.Vault ? window.Vault.open(raw) : null;
      const f = favRaw && window.Vault ? window.Vault.open(favRaw) : null;
      // 统计面板里的总票数
      const statText = (document.querySelector('#statTotal') || {}).textContent || null;
      return {
        url: location.pathname,
        cardFound: !!card,
        shownLike: card ? card.querySelector('[data-count="like"]').textContent : null,
        storedLike: c && c[${JSON.stringify(votedId)}] ? c[${JSON.stringify(votedId)}].like : 0,
        votedDisabled: card ? !!card.querySelector('.vote-btn[data-vote="like"]').disabled : null,
        favOnCount: document.querySelectorAll('.fav-star.on').length,
        favStored: f ? Object.keys(f).filter(k => f[k]).length : 0,
        statTotal: statText,
        cards: document.querySelectorAll('.site-card').length,
      };
    })()`);
    console.log('[V2] 打开后：', JSON.stringify(onV2));

    // ---- C. 实时同步：V1 里投票，已打开的 V2 标签页是否立刻跟着变 ----
    const sid2 = await openTab(null);
    await goto(sid2, BASE + '/index-v2.html');
    const before = await evaluate(cdp, sid2, `(() => {
      const c = document.querySelector('.site-card[data-id="' + ${JSON.stringify(votedId)} + '"] [data-count="like"]');
      return c ? c.textContent : null;
    })()`);

    // 把 V1 标签页切到前台（后台标签页会被「存活性检测」拒绝投票），再回到 V1 投一票
    await cdp.send('Page.bringToFront', {}, sid);
    await sleep(600);
    const second = await evaluate(cdp, sid, `(() => {
      const btns = Array.from(document.querySelectorAll('.vote-btn[data-vote="like"]')).filter(b => !b.disabled);
      const target = btns.find(b => b.dataset.id !== ${JSON.stringify(votedId)}) || btns[0];
      if (!target) return { err: '没有可投票的按钮' };
      const id = target.dataset.id;
      const verdict = window.AntiAbuse.canVote(id, 'like');
      if (!verdict.pass) return { siteId: id, blocked: verdict.reason };
      target.click();
      return { siteId: id };
    })()`);
    console.log('       V1 第二票：', JSON.stringify(second));
    await sleep(2000); // 等广播 / storage 事件传播

    // 关键：V2 标签页不刷新，直接读它在后台是否已自动更新
    const after = await evaluate(cdp, sid2, `(() => {
      const card = document.querySelector('.site-card[data-id="' + ${JSON.stringify(second.siteId)} + '"]');
      return card ? card.querySelector('[data-count="like"]').textContent : null;
    })()`);
    const v2Url = await evaluate(cdp, sid2, 'location.pathname');
    console.log('[实时] V1 给 ' + second.siteId + ' 投票后，未刷新的 V2(' + v2Url + ') 读数：', before, '→', after);
    const liveOk = Number(after) >= 1;

    // ---- D. 结论 ----
    const shared = Number(onV2.shownLike) === Number(afterV1.shown) && Number(onV2.shownLike) > 0;
    const favShared = onV2.favOnCount > 0;
    console.log('\n结论：');
    console.log('  历史键迁移:', migrateOk ? '✅ 是' : '❌ 否（V2 读到 ' + migrated.shown + '）');
    console.log('  票数共享  :', shared ? '✅ 是' : '❌ 否（V1=' + afterV1.shown + ' / V2=' + onV2.shownLike + '）');
    console.log('  收藏共享  :', favShared ? '✅ 是' : '❌ 否（V2 高亮 ' + onV2.favOnCount + ' 个）');
    console.log('  实时同步  :', liveOk ? '✅ 是' : '❌ 否');
    ok = shared && favShared && migrateOk && liveOk;
    cdp.close();
  } catch (e) {
    console.error('测试异常：', e.message);
    ok = false;
  } finally {
    try { chrome.kill(); } catch (e) { /* ignore */ }
    try { if (server) server.kill(); } catch (e) { /* ignore */ }
    try { spawnSync('cmd', ['/c', 'rmdir', '/s', '/q', profile], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
  }
  console.log(ok ? '\nE2E 通过' : '\nE2E 未通过');
  process.exit(ok ? 0 : 1);
})();
