/**
 * e2e-faq.js — FAQ 区块端到端验证（本地/线上通用）
 *
 * 用法：node tools/e2e-faq.js [baseURL]
 * 默认 http://127.0.0.1:8901
 *
 * 覆盖：V1/V2 两版渲染、Tab 切换、手风琴展开、切换语言后文案同步、顶栏锚点
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:8901';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}

(async () => {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(__dirname, '.faq-ud'), 'about:blank'];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2500));

  const WebSocket = global.WebSocket;

  try {
    if (!WebSocket) throw new Error('需要 Node 22+（使用内置 WebSocket）');
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
      const mid = ++id;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
    const evalJS = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
      return r.result && r.result.result && r.result.result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    for (const page2 of ['index.html', 'index-v2.html']) {
      console.log('\n=== ' + page2 + ' ===');
      await send('Page.navigate', { url: BASE + '/' + page2 });
      await new Promise(r => setTimeout(r, 3200));

      const sec = await evalJS(`(() => {
        const s = document.querySelector('.faq');
        if (!s) return null;
        const q = s.getBoundingClientRect();
        return { h: Math.round(q.height), tabs: document.querySelectorAll('.faq-tab').length,
                 items: document.querySelectorAll('.faq-item').length,
                 vis: q.top < window.innerHeight * 3 };
      })()`);
      check(page2 + ' FAQ 区块存在且有高度', !!sec && sec.h > 80, sec ? 'h=' + sec.h : 'not found');
      check(page2 + ' 三个 Tab 渲染', !!sec && sec.tabs === 3, 'tabs=' + (sec && sec.tabs));
      check(page2 + ' 首屏内出现 4 条问答', !!sec && sec.items === 4, 'items=' + (sec && sec.items));

      // 手风琴展开
      const acc = await evalJS(`(() => {
        const item = document.querySelector('.faq-item');
        const q = item.querySelector('.faq-q');
        q.click();
        const open1 = item.classList.contains('open');
        const ansVisible = item.querySelector('.faq-a').offsetHeight > 10;
        const txt = item.querySelector('.faq-a').textContent.trim().length;
        return { open1, ansVisible, txt };
      })()`);
      check(page2 + ' 点击后展开答案', acc.open1 && acc.ansVisible && acc.txt > 20, JSON.stringify(acc));

      // Tab 切换
      const tab = await evalJS(`(() => {
        document.querySelectorAll('.faq-tab')[1].click();
        const t = [...document.querySelectorAll('.faq-tab')].findIndex(b => b.classList.contains('on'));
        const items = document.querySelectorAll('.faq-item').length;
        const txt = document.querySelector('.faq-item').textContent;
        return { t, items, hasVote: txt.includes('投票') || txt.includes('vote') };
      })()`);
      check(page2 + ' 切到第 2 组 Tab', tab.t === 1 && tab.items === 4, JSON.stringify(tab));
      check(page2 + ' 投票组内容正确', tab.hasVote, JSON.stringify(tab));

      // 切语言 → FAQ 文案应同步
      const lang = await evalJS(`(() => {
        const sel = document.getElementById('langSel');
        sel.value = 'en';
        sel.dispatchEvent(new Event('change'));
        const h2 = document.querySelector('.faq h2').textContent;
        const nav = document.querySelector('.topnav a[href="#faq"]').textContent;
        const q1 = document.querySelector('.faq-item').textContent;
        return { h2, nav, q1 };
      })()`);
      check(page2 + ' 切英文后 FAQ 标题同步', /question/i.test(lang.h2), lang.h2);
      check(page2 + ' 切英文后顶栏同步', /faq/i.test(lang.nav), lang.nav);
      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(lang.q1);
      check(page2 + ' 切英文后问答同步（无中日韩残留）', hasCJK === false && /[A-Za-z]{4}/.test(lang.q1), lang.q1.slice(0, 40));

      // 还原中文，避免污染后续
      await evalJS(`(() => { const s=document.getElementById('langSel'); s.value='zh'; s.dispatchEvent(new Event('change')); })()`);
    }

    // 顶栏锚点
    await send('Page.navigate', { url: BASE + '/index.html' });
    await new Promise(r => setTimeout(r, 2600));
    const anchor = await evalJS(`(() => {
      const a = document.querySelector('.topnav a[href="#faq"]');
      if (!a) return null;
      a.click();
      return new Promise(res => setTimeout(() => {
        const r = document.getElementById('faq').getBoundingClientRect();
        res({ ok: r.top > -50 && r.top < 260, top: Math.round(r.top) });
      }, 1400));
    })()`);
    check('顶栏「常见问题」点击后定位到 FAQ 区', !!anchor && anchor.ok, JSON.stringify(anchor));

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
