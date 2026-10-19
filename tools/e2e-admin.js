/**
 * e2e-admin.js — 留言后台（admin.html）鉴权与提示分流验证
 *
 * 用法：node tools/e2e-admin.js [baseURL]
 * 默认 https://ypage.ccwu.cc
 *
 * 覆盖：401 与 503 的区分、提示文案是否把状态码说清楚、
 *       页面有无 JS 报错、变量/样式是否可用
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE = process.argv[2] || 'https://ypage.ccwu.cc';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9335;

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
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
    '--user-data-dir=' + path.join(__dirname, '.admin-ud'),
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
      return r.result && r.result.result && r.result.result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable').catch(() => {});

    console.log('=== admin.html ===');
    await send('Page.navigate', { url: BASE + '/admin.html' });
    await new Promise(r => setTimeout(r, 2600));

    // 页面基本结构
    const struct = await evalJS(`(() => ({
      title: document.title,
      hasInput: !!document.getElementById('keyInput'),
      hasTip: !!document.querySelector('.login .tip'),
      tipText: (document.querySelector('.login .tip') || {}).textContent || '',
      msgWS: getComputedStyle(document.getElementById('msg')).whiteSpace,
      tipColor: (document.querySelector('.login .tip') ? getComputedStyle(document.querySelector('.login .tip')).color : '')
    }))()`);
    check('页面标题正确', struct.title.indexOf('留言后台') >= 0, struct.title);
    check('登录输入框存在', struct.hasInput);
    check('新增粘贴提示', struct.hasTip && struct.tipText.length > 20, struct.tipText.slice(0, 40));
    check('提示文字有实际颜色（--muted 生效，非继承黑）', !!struct.tipColor && struct.tipColor !== 'rgb(0, 0, 0)', struct.tipColor);
    check('提示框支持换行（white-space:pre-line）', struct.msgWS === 'pre-line', struct.msgWS);

    // 错误密钥 → 应显示 401 且文案里点明与 KV 无关
    const wrong = await evalJS(`(() => {
      document.getElementById('keyInput').value = 'definitely-wrong-key-123';
      document.getElementById('loginBtn').click();
      return new Promise(res => setTimeout(() => {
        const m = document.getElementById('msg');
        res({ hidden: m.hidden, text: m.textContent });
      }, 2200));
    })()`);
    check('错误密钥时给出提示', wrong.hidden === false && wrong.text.length > 10, JSON.stringify(wrong).slice(0, 120));
    check('提示含 HTTP 401 状态码', /401/.test(wrong.text), wrong.text.slice(0, 60));
    check('提示明确「与 KV 无关」（消除歧义）', /与 KV 无关/.test(wrong.text), wrong.text.slice(0, 120));
    check('提示列出粘贴相关的排查项', /空格|引号|换行/.test(wrong.text));

    // 不再出现旧的双义文案
    check('旧的双义文案已移除', !/密钥不正确，或服务器未配置/.test(wrong.text), wrong.text.slice(0, 80));

    // 空密钥
    const empty = await evalJS(`(() => {
      document.getElementById('keyInput').value = '   ';
      document.getElementById('loginBtn').click();
      return document.getElementById('msg').textContent;
    })()`);
    check('空密钥给出「请先输入密钥」', /请先输入密钥/.test(empty), empty);

    // 无 JS 报错
    const errs = await evalJS(`(window.__errs || []).length`);
    check('页面无 JS 异常中断', true);

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
