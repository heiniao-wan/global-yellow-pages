/**
 * lighthouse.js — 用 Chrome 内置 Lighthouse 评估站点性能
 *
 * 为什么要用 Lighthouse 而不是直接看 FCP：
 * PSI API 有每日配额（沙箱 IP 共享，常被限流），
 * 而 Chrome 155 内置了同一套 Lighthouse，评的是 Google 的标准。
 *
 * 用法：node tools/lighthouse.js [url]
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const TARGET = process.argv[2] || 'https://ypage.ccwu.cc/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9397;

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

(async () => {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.cwd(), '.shots', 'lh-ud'),
    'about:blank'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 3000));

  try {
    const list = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
    const pg = list.find(x => x.type === 'page');
    const ws = new WebSocket(pg.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    let id = 0;
    const pend = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    });
    const send = (method, params) => new Promise(r => {
      const i = ++id;
      pend.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evalJS = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) {
        return { EXC: JSON.stringify(r.result.exceptionDetails).slice(0, 200) };
      }
      return r.result && r.result.result && r.result.result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    const url = 'devtools://devtools/bundled/lighthouse/lighthouse.html?url='
      + encodeURIComponent(TARGET)
      + '&preset=perf&formFactor=mobile&throttlingMethod=simulate';
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 5000));

    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const v = await evalJS(`(function(){
        var t = (document.body && document.body.innerText) || '';
        if (t.indexOf('Largest Contentful Paint') < 0) return null;
        return t.slice(0, 3000);
      })()`);
      if (v && v.EXC) { console.log('异常:', v.EXC); break; }
      if (v) { console.log(v); break; }
      if (i === 49) console.log('超时：Lighthouse 未在 150 秒内出结果');
    }
  } catch (e) {
    console.log('ERROR', e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
    process.exit(0);
  }
})();
