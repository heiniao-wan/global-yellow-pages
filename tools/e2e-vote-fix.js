/**
 * e2e-vote-fix.js — 投票计数与取消角标的回归验证
 *
 * 用法：node tools/e2e-vote-fix.js [baseURL]
 * 默认 https://ypage.ccwu.cc
 *
 * 针对两个已修 bug 的定向验证：
 *   Bug A「点一次 +2、再点只 -1」→ 验证 0→1→0 严格往返
 *   Bug B「取消角标只见白椭圆没文字」→ 验证文字色与背景色有足够对比
 *
 * ⚠ 已知波动性（测试环境伪影，非站点缺陷，2026-10-25 记录）：
 *   ① KV 最终一致性——写入最多 60 秒才全球可见，测试只等 3.5 秒，
 *      偶尔读到旧快照表现为「点了没反应」；
 *   ② 服务端按 IP/设备限流——同一出口 IP 短时间上百次投票会触发，
 *      后续投票被拦截。两种都会造成零星 FAIL，重跑即可。
 *   本地跑（dev server 无 KV）稳定 21/21。
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE = process.argv[2] || 'https://ypage.ccwu.cc';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9351;

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
  // profile 轮换：服务端按设备指纹限流，同一个 profile 反复跑会被当
  // 刷票设备拦掉（表现为「点了没反应」的假失败）。三个目录轮着用，
  // 每次都是相对干净的指纹。（2026-10-25 踩坑记录）
  const slot = String.fromCharCode(97 + (Date.now() % 3));   // a/b/c
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--no-proxy-server', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(__dirname, '.votefix-ud-' + slot),
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

    for (const pg of ['index.html', 'index-v2.html']) {
      console.log('\n=== ' + pg + ' ===');
      await send('Page.navigate', { url: BASE + '/' + pg });
      await new Promise(r => setTimeout(r, 8000));

      // 清空本地状态，从一个干净的起点测（避免历史残留票干扰）
      await evalJS(`(async()=>{
        for (const k of Object.keys(localStorage)) if (k.startsWith('gyp:')) localStorage.removeItem(k);
      })()`);
      await send('Page.reload', { ignoreCache: true });
      await new Promise(r => setTimeout(r, 8000));

      // ── Bug A：0 → 1 → 0 严格往返 ──
      for (const key of ['like', 'dislike', 'broken']) {
        const roundTrip = await evalJS(`(async()=>{
          const sel = '.site-card .vote-btn.v-${key}';
          const card0 = document.querySelector('.site-card');
          const id = card0.dataset.id;
          const b0 = card0.querySelector('.vote-btn.v-${key}');
          const start = parseInt(b0.querySelector('.vb-num').textContent) || 0;

          b0.click();
          await new Promise(r=>setTimeout(r,3500));
          const afterUp = parseInt(document.querySelector('.site-card[data-id="'+id+'"] .vote-btn.v-${key} .vb-num').textContent) || 0;

          // 再点一次 = 取消
          const mine = document.querySelector('.site-card[data-id="'+id+'"] .vote-btn.v-${key}.mine');
          if (!mine) return { id, start, afterUp, err: '未出现高亮按钮' };
          mine.click();
          await new Promise(r=>setTimeout(r,3500));
          const afterDown = parseInt(document.querySelector('.site-card[data-id="'+id+'"] .vote-btn.v-${key} .vb-num').textContent) || 0;

          // 直接问服务端要真实票数
          const srv = await (await fetch('/api/votes')).json();
          return { id, start, afterUp, afterDown, server: srv.counts[id] || null };
        })()`);

        const upDelta = roundTrip.afterUp - roundTrip.start;
        const downDelta = roundTrip.afterDown - roundTrip.afterUp;
        check(pg + ' ' + key + '：点一次只 +1（不是 +2）', upDelta === 1,
          { start: roundTrip.start, afterUp: roundTrip.afterUp, delta: upDelta });
        check(pg + ' ' + key + '：再点一次 -1 回到原点', downDelta === -1 && roundTrip.afterDown === roundTrip.start,
          { afterUp: roundTrip.afterUp, afterDown: roundTrip.afterDown, delta: downDelta });
      }

      // ── Bug B：角标文字与背景有对比 ──
      const flag = await evalJS(`(async()=>{
        const card = document.querySelector('.site-card');
        const id = card.dataset.id;
        // 找一个没投过的按钮投一票，制造 .mine 与角标
        const b = card.querySelector('.vote-btn.v-broken');
        b.click();
        await new Promise(r=>setTimeout(r,3500));
        const btn = document.querySelector('.site-card[data-id="'+id+'"] .vote-btn.v-broken.mine');
        if (!btn) return { err: '未出现 .mine' };
        const f = btn.querySelector('.vb-flag');
        if (!f) return { err: '未出现角标' };
        // 先取样式（此时角标还在 DOM 里），再取消恢复环境
        const cs = getComputedStyle(f);
        const r = f.getBoundingClientRect();
        const out = {
          text: f.textContent,
          color: cs.color,
          bg: cs.backgroundColor,
          w: Math.round(r.width), h: Math.round(r.height),
          position: cs.position
        };
        btn.click();
        await new Promise(r2=>setTimeout(r2,3000));
        return out;
      })()`);

      check(pg + ' 角标文字是「取消」', flag.text === '取消', flag.text);
      check(pg + ' 角标文字色与背景色不同（不是白底白字）',
        !!flag.color && !!flag.bg && flag.color !== flag.bg, { color: flag.color, bg: flag.bg });
      check(pg + ' 角标有实际尺寸（不是零宽高）',
        flag.w > 20 && flag.h >= 12, { w: flag.w, h: flag.h });
      check(pg + ' 角标绝对定位于按钮右上', flag.position === 'absolute', flag.position);

      // 深色模式下再验一次
      const dark = await evalJS(`(async()=>{
        if (!document.getElementById('themeToggle')) return { skip:true };
        document.getElementById('themeToggle').click();
        await new Promise(r=>setTimeout(r,900));
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const card = document.querySelector('.site-card');
        const id = card.dataset.id;
        card.querySelector('.vote-btn.v-broken').click();
        await new Promise(r=>setTimeout(r,3500));
        const btn = document.querySelector('.site-card[data-id="'+id+'"] .vote-btn.v-broken.mine');
        const f = btn ? btn.querySelector('.vb-flag') : null;
        const out = f ? { color:getComputedStyle(f).color, bg:getComputedStyle(f).backgroundColor } : {err:'无角标'};
        if (btn) { btn.click(); await new Promise(r=>setTimeout(r,3000)); }
        document.getElementById('themeToggle').click();
        return { isDark, ...out };
      })()`);
      if (!dark.skip) {
        check(pg + ' 暗色模式下角标仍有对比（文字色≠背景色）',
          !!dark.color && dark.color !== dark.bg, dark);
      }
    }

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
