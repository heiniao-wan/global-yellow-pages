/**
 * e2e-copy.js — 卡片「复制链接」功能验证
 *
 * 用法：node tools/e2e-copy.js [baseURL]
 * 默认 http://127.0.0.1:8901
 *
 * 覆盖：V1/V2 两版按钮渲染、点击后剪贴板拿到正确 URL、
 *       成功态文案与 toast、失败兜底、四语切换后文案同步
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
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); })
      .on('error', rej);
  });
}

(async () => {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(__dirname, '.copy-ud'),
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
      if (r.result && r.result.exceptionDetails) {
        throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 200));
      }
      return r.result && r.result.result && r.result.result.value;
    };

    // 授予剪贴板权限，否则 headless 下 writeText 会失败
    await send('Browser.grantPermissions', {
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
      origin: BASE
    }).catch(() => {});
    await send('Page.enable');
    await send('Runtime.enable');

    for (const pg of ['index.html', 'index-v2.html']) {
      console.log('\n=== ' + pg + ' ===');
      await send('Page.navigate', { url: BASE + '/' + pg });
      // 等网格真正渲染完：首页多了 36 条静态精选内容，
      // 固定等待 3.2 秒不够，会在卡片生成前就断言。
      await evalJS(`new Promise(res => {
        const t0 = Date.now();
        (function wait() {
          const cards = document.querySelectorAll('.site-card').length;
          const btns = document.querySelectorAll('.site-card .copy-btn').length;
          if ((cards > 0 && btns === cards) || Date.now() - t0 > 20000) return res(1);
          setTimeout(wait, 200);
        })();
      })`);
      await new Promise(r => setTimeout(r, 500));

      // 按钮渲染
      const btns = await evalJS(`(() => {
        const all = document.querySelectorAll('.site-card .copy-btn');
        const first = all[0];
        return {
          n: all.length,
          url: first ? first.dataset.copy : '',
          txt: first ? first.querySelector('.cb-txt').textContent : '',
          ico: first ? first.querySelector('.cb-ico').textContent : '',
          cta: !!document.querySelector('.site-cta')
        };
      })()`);
      check(pg + ' 每张卡片都有复制按钮', btns.n > 0 && btns.n === await evalJS(`document.querySelectorAll('.site-card').length`), JSON.stringify(btns.n));
      check(pg + ' data-copy 是站点官网 URL', /^https?:\/\//.test(btns.url), btns.url);
      check(pg + ' 默认文案为「复制」', btns.txt === '复制', btns.txt);
      check(pg + ' 图标为 ⧉', btns.ico === '⧉', btns.ico);
      check(pg + ' 按钮与打开按钮同容器 .site-cta', btns.cta);

      // 点击 → 验证成功路径
      // 说明：http://127.0.0.1 非安全上下文，navigator.clipboard 不存在，
      // 故注入一个可记录调用的假 clipboard，验证的是「按钮 → 复制逻辑 → 成功态」整条链路，
      // 而非系统剪贴板本身（后者在真实 HTTPS 站点上由浏览器保证）。
      const copied = await evalJS(`(() => {
        window.__clip = [];
        const real = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); } },
        });
        window.__isSecure = window.isSecureContext;
        const btn = document.querySelectorAll('.site-card .copy-btn')[0];
        btn.click();
        return new Promise(res => setTimeout(() => {
          const t = document.querySelector('.gyp-toast');
          const r = {
            clip: window.__clip[0] || '',
            done: btn.classList.contains('done'),
            txt: btn.querySelector('.cb-txt').textContent,
            ico: btn.querySelector('.cb-ico').textContent,
            toast: t ? t.textContent : '',
            toastOn: !!(t && t.classList.contains('on')),
            secure: window.__isSecure
          };
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: real });
          res(r);
        }, 700));
      })()`);
      check(pg + ' 点击后写入的正是该站 URL', copied.clip === btns.url,
        'got=' + String(copied.clip).slice(0, 40) + ' want=' + btns.url);
      if (pg === 'index.html') {
        console.log('  INFO  当前页面 isSecureContext = ' + copied.secure +
          '（http 本地为 false，故走 execCommand 回退；线上 HTTPS 为 true 走 Clipboard API）');
      }
      check(pg + ' 按钮进入成功态（.done + ✓）', copied.done && copied.ico === '✓', JSON.stringify({ done: copied.done, ico: copied.ico }));
      check(pg + ' 文案变为「已复制」', copied.txt === '已复制', copied.txt);
      check(pg + ' 弹出 toast 提示', copied.toastOn && /已复制/.test(copied.toast), JSON.stringify({ t: copied.toast, on: copied.toastOn }));

      // 1.8 秒后自动复原
      const reverted = await evalJS(`(() => {
        const btn = document.querySelectorAll('.site-card .copy-btn')[0];
        return new Promise(res => setTimeout(() => res({
          done: btn.classList.contains('done'),
          txt: btn.querySelector('.cb-txt').textContent
        }), 2000));
      })()`);
      check(pg + ' 约 1.8 秒后自动复原', reverted.done === false && reverted.txt === '复制', JSON.stringify(reverted));

      // 失败兜底：把 clipboard 打成 reject
      const failCase = await evalJS(`(() => {
        const orig = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error('nope')) },
        });
        document.querySelectorAll('.site-card .copy-btn')[0].click();
        return new Promise(res => setTimeout(() => {
          const t = document.querySelector('.gyp-toast');
          const r = { toast: t ? t.textContent : '', on: !!(t && t.classList.contains('on')) };
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: orig });
          res(r);
        }, 600));
      })()`);
      check(pg + ' 复制失败时提示兜底文案', failCase.on && /复制失败/.test(failCase.toast), JSON.stringify(failCase));

      // 四语同步
      const lang = await evalJS(`(() => {
        const sel = document.getElementById('langSel');
        sel.value = 'en'; sel.dispatchEvent(new Event('change'));
        const en = document.querySelectorAll('.site-card .copy-btn')[0].querySelector('.cb-txt').textContent;
        sel.value = 'ja'; sel.dispatchEvent(new Event('change'));
        const ja = document.querySelectorAll('.site-card .copy-btn')[0].querySelector('.cb-txt').textContent;
        sel.value = 'ko'; sel.dispatchEvent(new Event('change'));
        const ko = document.querySelectorAll('.site-card .copy-btn')[0].querySelector('.cb-txt').textContent;
        sel.value = 'zh'; sel.dispatchEvent(new Event('change'));
        return { en, ja, ko };
      })()`);
      check(pg + ' 英文文案 = Copy', lang.en === 'Copy', lang.en);
      check(pg + ' 日文文案 = コピー', lang.ja === 'コピー', lang.ja);
      check(pg + ' 韩文文案 = 복사', lang.ko === '복사', lang.ko);
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
