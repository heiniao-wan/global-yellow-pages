/**
 * e2e-search.js — 搜索增强端到端验证（本地/线上通用）
 *
 * 用法：node tools/e2e-search.js [baseURL]
 * 默认 http://127.0.0.1:8901
 *
 * 覆盖：拼音索引就绪、拼音搜中文站名、分类名搜整类、热门搜索词下拉与点选
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:8901';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9337;

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
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--no-proxy-server', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(__dirname, '.search-ud'), 'about:blank'];
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
    await send('Network.enable');
    // dev server 不发缓存头，Chrome 启发式缓存会拿到旧 app.js
    await send('Network.setCacheDisabled', { cacheDisabled: true });

    /** 输入关键词并等防抖跑完，返回结果统计 */
    const search = async (kw) => {
      await evalJS(`(() => {
        const i = document.querySelector('#search');
        i.value = ${JSON.stringify(kw)};
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.focus();
        return true;
      })()`);
      await new Promise(r => setTimeout(r, 450));
      return evalJS(`(() => {
        const cards = document.querySelectorAll('#grid .card, #grid .site-card, #grid article');
        const names = [...document.querySelectorAll('#grid h3')].slice(0, 6).map(h => h.textContent.trim());
        return { n: cards.length, names, count: document.querySelector('#resultCount').textContent };
      })()`);
    };

    for (const page2 of ['index.html', 'index-v2.html']) {
      console.log('\n=== ' + page2 + ' ===');
      await send('Page.navigate', { url: BASE + '/' + page2 });
      await new Promise(r => setTimeout(r, 3200));

      const ready = await evalJS(`(() => ({
        sites: window.SITE_DATA.length,
        withPy: window.SITE_DATA.filter(s => s.py).length,
        pySample: (window.SITE_DATA.find(s => s.name === '什么值得买') || {}).py || ''
      }))()`);
      check(page2 + ' 拼音索引已生成', ready.withPy >= 120, JSON.stringify(ready));
      check(page2 + ' 拼音样例正确（什么值得买→smzdm）',
        /smzdm/.test(ready.pySample), ready.pySample);

      // ① 拼音搜中文站名
      const t1 = await search('tengxun');
      check(page2 + ' 拼音 tengxun 有结果', t1.n > 0, 'n=' + t1.n);
      check(page2 + ' 拼音结果含腾讯系站点',
        t1.names.some(x => x.indexOf('腾讯') >= 0), JSON.stringify(t1.names));

      // ② 首字母搜
      const t2 = await search('smzdm');
      check(page2 + ' 首字母 smzdm 命中什么值得买',
        t2.names.some(x => x.indexOf('什么值得买') >= 0), JSON.stringify(t2.names));

      // ③ 分类名搜整类（"设计"应命中「设计与效率工具」全类）
      const t3 = await search('设计');
      check(page2 + ' 分类名「设计」命中整类（≥20）', t3.n >= 20, 'n=' + t3.n);

      // ④ 热门搜索词：清空后聚焦应出现热词
      const hot = await evalJS(`(() => {
        const i = document.querySelector('#search');
        i.value = '';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.focus();
        return true;
      })()`);
      await new Promise(r => setTimeout(r, 350));
      const hotInfo = await evalJS(`(() => {
        const box = document.querySelector('#searchSuggest');
        const btns = [...document.querySelectorAll('.sg-hot')].map(b => b.textContent.trim());
        return { hidden: box.hidden, n: btns.length, words: btns, head: (document.querySelector('.sg-hot-head') || {}).textContent || '' };
      })()`);
      check(page2 + ' 空关键词聚焦弹出热门词', hotInfo.hidden === false && hotInfo.n === 6, JSON.stringify(hotInfo));
      check(page2 + ' 热门词带标题', hotInfo.head.trim().length > 0, hotInfo.head);

      // 点第一个热词 → 输入框填词且有结果
      const clicked = await evalJS(`(() => {
        document.querySelector('.sg-hot').click();
        return true;
      })()`);
      await new Promise(r => setTimeout(r, 500));
      const afterHot = await evalJS(`(() => ({
        kw: document.querySelector('#search').value,
        n: document.querySelectorAll('#grid .card, #grid .site-card, #grid article').length,
        hidden: document.querySelector('#searchSuggest').hidden
      }))()`);
      check(page2 + ' 点热词后填入关键词并有结果',
        afterHot.kw && afterHot.n > 0 && afterHot.hidden === true, JSON.stringify(afterHot));
    }
  } catch (e) {
    fail++;
    console.log('  ERROR ' + (e && e.message));
  } finally {
    try { proc.kill(); } catch (e) { /* 忽略 */ }
    console.log('\n────────────────────────');
    console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
    console.log('────────────────────────');
    process.exit(fail ? 1 : 0);
  }
})();
