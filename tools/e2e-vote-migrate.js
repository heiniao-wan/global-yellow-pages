/**
 * e2e-vote-migrate.js — 本机旧票迁移到服务端 的验证
 *
 * 用法：node tools/e2e-vote-migrate.js [baseURL]
 * 默认 http://127.0.0.1:8903
 *
 * 场景：全站共享功能上线前，用户在 localStorage 里投过票。
 * 这些票在服务端没有记录，改造后应当自动补传，而不是凭空消失。
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:8903';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9371;

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
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
    '--user-data-dir=' + path.join(__dirname, '.migrate-ud'),
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
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 250));
      return r.result && r.result.result && r.result.result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('\n=== 场景：本机有旧票，服务端没有 ===');
    await send('Page.navigate', { url: BASE + '/index.html' });
    await new Promise(r => setTimeout(r, 7000));

    // 造一个「本机有票、服务端没有」的状态：
    // 直接往 localStorage 写旧格式的投票记录（模拟改造前的样子）
    const setup = await evalJS(`(() => {
      const sites = (window.SITE_DATA || []).slice(0, 3);
      if (!sites.length) return { err: '没有站点数据' };
      // 旧格式：gyp:voted:<指纹>:<站点ID> → {action, at, fp}
      const fp = window.AntiAbuse.fingerprint();
      sites.forEach((s, i) => {
        localStorage.setItem('gyp:voted:' + fp + ':' + s.id,
          JSON.stringify({ action: i === 0 ? 'like' : (i === 1 ? 'dislike' : 'broken'), at: Date.now(), fp: fp }));
      });
      // 旧的计数缓存
      const counts = {};
      sites.forEach((s, i) => { counts[s.id] = { like: i === 0 ? 1 : 0, dislike: i === 1 ? 1 : 0, broken: i === 2 ? 1 : 0 }; });
      localStorage.setItem('gyp:counts:', localStorage.getItem('gyp:counts:') || '');
      return { ids: sites.map(s => s.id), fp };
    })()`);
    check('已构造 3 条本机旧票', !setup.err && setup.ids.length === 3, setup);

    // 先确认服务端确实没有这 3 个站点的票
    const before = await evalJS(`(async()=>{
      const r = await (await fetch('/api/votes')).json();
      const ids = ${JSON.stringify(setup.ids || [])};
      return ids.map(id => ({ id, server: (r.counts[id]||{}).like || 0 }));
    })()`);
    check('迁移前服务端没有这些票', before.every(b => b.server === 0), before);

    // 重新加载页面 → 触发 syncFromServer → 应当自动补传
    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 9000));

    const after = await evalJS(`(async()=>{
      const r = await (await fetch('/api/votes')).json();
      const mine = await (await fetch('/api/votes?mine=1')).json();
      const ids = ${JSON.stringify(setup.ids || [])};
      return {
        server: ids.map(id => ({ id, c: r.counts[id] || null })),
        mine: mine.mine,
        marked: ids.map(id => !!mine.mine[id])
      };
    })()`);

    const total = after.server.reduce((n, s) => n + ((s.c && (s.c.like + s.c.dislike + s.c.broken)) || 0), 0);
    check('迁移后服务端出现了这 3 条票', total === 3, { total, detail: after.server });
    check('服务端记录了每条票的具体选项',
      after.server.every(s => s.c && (s.c.like + s.c.dislike + s.c.broken) === 1),
      after.server);
    check('「我投过什么」里能查到这 3 条', after.marked.filter(Boolean).length === 3, after.marked);

    // 再刷新一次：不应重复累加
    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 8000));
    const again = await evalJS(`(async()=>{
      const r = await (await fetch('/api/votes')).json();
      const ids = ${JSON.stringify(setup.ids || [])};
      return ids.map(id => ({ id, c: r.counts[id] || null }));
    })()`);
    const total2 = again.reduce((n, s) => n + ((s.c && (s.c.like + s.c.dislike + s.c.broken)) || 0), 0);
    check('重复刷新不会重复累加（幂等）', total2 === 3, { total: total2, detail: again });

    console.log('\n=== 场景：老版本只记「投过」不记选项 ===');
    const legacy = await evalJS(`(() => {
      const sites = (window.SITE_DATA || [])[3];
      if (!sites) return { err: '无站点' };
      const fp = window.AntiAbuse.fingerprint();
      // 老格式：值是 true，没有具体选项
      localStorage.setItem('gyp:voted:' + fp + ':' + sites.id, '1');
      return { id: sites.id };
    })()`);
    check('已构造老格式记录', !legacy.err, legacy);

    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 8000));

    const legacyAfter = await evalJS(`(async()=>{
      const r = await (await fetch('/api/votes')).json();
      const c = r.counts[${JSON.stringify(legacy.id || '')}] || null;
      return { c, total: c ? (c.like + c.dislike + c.broken) : 0 };
    })()`);
    check('无法还原选项的旧票被跳过（不污染统计）', legacyAfter.total === 0, legacyAfter);

    console.log('\n────────────────────────');
    console.log('  通过 ' + pass + ' / 失败 ' + fail);
    console.log('────────────────────────');
  } catch (e) {
    console.log('  ERROR ' + e.message);
    fail++;
  } finally {
    try { proc.kill(); } catch (e) {}
    process.exit(fail ? 1 : 0);
  }
})();
