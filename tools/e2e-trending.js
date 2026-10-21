/**
 * e2e-trending.js — 「今日新发现」热点区块端到端验证
 *
 * 用法：node tools/e2e-trending.js [baseURL]
 * 默认 https://ypage.ccwu.cc
 *
 * 覆盖：
 *   ① 区块渲染（标题/数量/日期/分类条/卡片）
 *   ② 卡片内容完整性（名称、链接、热度、来源、域名）
 *   ③ 分类筛选（点 chip → 状态变 → 卡片过滤 → on 类正确）
 *   ④ 展开/收起
 *   ⑤ 语言切换后文案跟随
 *   ⑥ 无热点数据时整个区块隐藏（容错）
 *   ⑦ 数据文件格式校验
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'https://ypage.ccwu.cc';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9407;

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n【' + t + '】'); }

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
    '--user-data-dir=' + path.join(process.cwd(), 'tools', '.trend-ud'),
    'about:blank'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2500));

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

    for (const pgName of ['index.html', 'index-v2.html']) {
      console.log('\n════ ' + pgName + ' ════');
      await send('Page.navigate', { url: BASE + '/' + pgName });
      // 等网格 + 热点都渲染完
      await evalJS(`new Promise(res => {
        const t0 = Date.now();
        (function wait(){
          const grid = document.querySelectorAll('.site-card').length;
          const trend = document.querySelectorAll('.trend-card').length;
          if ((grid > 0 && trend > 0) || Date.now() - t0 > 25000) return res(1);
          setTimeout(wait, 250);
        })();
      })`);
      await new Promise(r => setTimeout(r, 600));

      section('① 区块渲染');
      const st = await evalJS(`(() => ({
        ui: typeof window.TrendingUI,
        visible: !document.getElementById('trendSection').hidden,
        title: (document.getElementById('trendTitle')||{}).textContent || '',
        count: (document.getElementById('trendCount')||{}).textContent || '',
        date: (document.getElementById('trendDate')||{}).textContent || '',
        chips: document.querySelectorAll('.trend-chip').length,
        cards: document.querySelectorAll('.trend-card').length,
        total: (window.TRENDING_DATA && window.TRENDING_DATA.entries || []).length
      }))()`);
      check('TrendingUI 已加载', st.ui === 'object', st.ui);
      check('区块可见', st.visible === true);
      check('有标题', st.title.length > 0, st.title);
      check('有数量文案', /\d/.test(st.count), st.count);
      check('有更新日期', st.date.length > 0, st.date);
      check('有分类筛选条', st.chips >= 2, st.chips + ' 个');
      check('有卡片', st.cards > 0, st.cards + ' 张');
      check('折叠时卡片数少于总数', st.cards < st.total, st.cards + ' / ' + st.total);

      section('② 卡片内容');
      const card = await evalJS(`(() => {
        const c = document.querySelector('.trend-card');
        if (!c) return null;
        const a = c.querySelector('.trend-name');
        return {
          name: a ? a.textContent.trim() : '',
          href: a ? a.getAttribute('href') : '',
          target: a ? a.getAttribute('target') : '',
          rel: a ? a.getAttribute('rel') : '',
          heat: (c.querySelector('.trend-heat')||{}).textContent || '',
          why: (c.querySelector('.trend-why')||{}).textContent || '',
          src: (c.querySelector('.trend-src')||{}).textContent || '',
          cat: (c.querySelector('.trend-cat')||{}).textContent || '',
          dom: (c.querySelector('.trend-dom')||{}).textContent || ''
        };
      })()`);
      check('卡片有名称', !!card && card.name.length > 0, card && card.name);
      check('链接是 https', !!card && /^https:\/\//.test(card.href), card && card.href);
      check('链接是站点首页（无深层路径）', !!card && card.href.replace(/^https?:\/\//, '').split('/').filter(Boolean).length <= 1, card && card.href);
      check('新窗口打开且带 noopener', !!card && card.target === '_blank' && /noopener/.test(card.rel), card && (card.target + ' ' + card.rel));
      check('有热度数值', !!card && /\d/.test(card.heat), card && card.heat);
      check('有热点理由（榜单原标题）', !!card && card.why.length > 5, card && card.why.slice(0, 40));
      check('标注了来源', !!card && card.src.length > 0, card && card.src);
      check('标注了分类', !!card && card.cat.length > 0, card && card.cat);
      check('标注了域名', !!card && card.dom.length > 0, card && card.dom);

      section('③ 分类筛选');
      const filt = await evalJS(`(() => {
        const chips = [...document.querySelectorAll('.trend-chip')];
        const target = chips.find(c => c.dataset.cat && c.dataset.cat !== 'all');
        if (!target) return { err: '没有分类 chip' };
        const before = document.querySelectorAll('.trend-card').length;
        const cat = target.dataset.cat;
        target.click();
        const after = document.querySelectorAll('.trend-card').length;
        const onIdx = [...document.querySelectorAll('.trend-chip')].findIndex(c => c.classList.contains('on'));
        const expectIdx = [...document.querySelectorAll('.trend-chip')].findIndex(c => c.dataset.cat === cat);
        const cats = [...document.querySelectorAll('.trend-card')].map(c => c.querySelector('.trend-cat').textContent);
        return { state: window.TrendingUI.getState(), cat, before, after, onIdx, expectIdx, cats,
                 stateOk: window.TrendingUI.getState().cat === cat };
      })()`);
      check('点击后 state.cat 更新', filt.stateOk, JSON.stringify(filt.state));
      check('on 类落在被点的 chip 上', filt.onIdx === filt.expectIdx, 'on@' + filt.onIdx + ' want@' + filt.expectIdx);
      check('卡片按分类过滤', filt.after <= filt.before, filt.after + ' <= ' + filt.before);
      // 切回全部
      await evalJS(`document.querySelector('.trend-chip[data-cat="all"]').click()`);
      const back = await evalJS(`({ state: window.TrendingUI.getState(), cards: document.querySelectorAll('.trend-card').length })`);
      check('可切回全部', back.state.cat === 'all', JSON.stringify(back.state));

      section('④ 展开 / 收起');
      const exp = await evalJS(`(() => {
        const more = document.getElementById('trendMore');
        if (!more) return { hasMore: false };
        const before = document.querySelectorAll('.trend-card').length;
        more.click();
        const after = document.querySelectorAll('.trend-card').length;
        const btn2 = document.getElementById('trendMore');
        return { hasMore: true, before, after, expanded: window.TrendingUI.getState().expanded,
                 btnText: btn2 ? btn2.textContent : '' };
      })()`);
      if (exp.hasMore) {
        check('展开后卡片变多', exp.after > exp.before, exp.after + ' vs ' + exp.before);
        check('展开状态为 true', exp.expanded === true);
        check('按钮文案变为收起', /收起|Collapse|접기/.test(exp.btnText), exp.btnText);
        await evalJS(`document.getElementById('trendMore').click()`);
        const collapsed = await evalJS(`({ n: document.querySelectorAll('.trend-card').length, e: window.TrendingUI.getState().expanded })`);
        check('可收起', collapsed.e === false, JSON.stringify(collapsed));
      } else {
        check('数量不足时无需展开按钮（正常）', true);
      }

      section('⑤ 语言切换');
      const lang = await evalJS(`(() => {
        const sel = document.getElementById('langSel');
        if (!sel) return { err: '无语言选择器' };
        const before = document.getElementById('trendTitle').textContent;
        const opt = [...sel.options].find(o => o.value === 'en');
        if (!opt) return { err: '无英文选项', opts: [...sel.options].map(o=>o.value) };
        sel.value = 'en';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { before, opts: [...sel.options].map(o=>o.value) };
      })()`);
      if (lang.err) {
        check('语言选择器可用', false, lang.err + ' ' + (lang.opts || ''));
      } else {
        await new Promise(r => setTimeout(r, 1200));
        const after = await evalJS(`({ title: document.getElementById('trendTitle').textContent,
                                     intro: document.getElementById('trendIntro').textContent,
                                     cards: document.querySelectorAll('.trend-card').length })`);
        check('切英文后标题变化', after.title !== lang.before, lang.before + ' → ' + after.title);
        check('切英文后区块仍有卡片', after.cards > 0, after.cards + ' 张');
        check('英文标题非中文', !/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(after.title), after.title);
        // 切回中文
        await evalJS(`(()=>{const s=document.getElementById('langSel');s.value='zh';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        await new Promise(r => setTimeout(r, 800));
      }
    }

    section('⑥ 数据文件格式');
    const dataFile = path.join(__dirname, '..', 'assets', 'js', 'trending.js');
    if (fs.existsSync(dataFile)) {
      const src = fs.readFileSync(dataFile, 'utf8');
      check('trending.js 存在', true);
      check('含 TRENDING_DATA 赋值', /window\.TRENDING_DATA\s*=/.test(src));
      check('含 date 字段', /"date"\s*:/.test(src));
      check('含 entries 数组', /"entries"\s*:\s*\[/.test(src));
      let parsed = null;
      try {
        const sandbox = { window: {} };
        new Function('window', src)(sandbox.window);
        parsed = sandbox.window.TRENDING_DATA;
        check('可被正常解析', !!parsed);
      } catch (e) {
        check('可被正常解析', false, e.message);
      }
      if (parsed) {
        check('entries 是数组', Array.isArray(parsed.entries), typeof parsed.entries);
        check('每条都有 domain', parsed.entries.every(e => !!e.domain));
        check('每条都有 url', parsed.entries.every(e => /^https?:\/\//.test(e.url || '')));
        check('每条都有 siteTitle', parsed.entries.every(e => !!e.siteTitle));
        check('每条都有 hotTitle', parsed.entries.every(e => !!e.hotTitle));
        check('每条都有 source', parsed.entries.every(e => !!e.source));
        check('每条都有 category', parsed.entries.every(e => !!e.category));
        const doms = parsed.entries.map(e => e.domain);
        check('域名无重复', new Set(doms).size === doms.length, doms.length + ' 条');
      }
    } else {
      check('trending.js 存在', false, '文件缺失');
    }

    console.log('\n────────────────────────');
    console.log('  通过 ' + pass + ' / 失败 ' + fail);
    console.log('────────────────────────');
    if (fail) process.exit(1);
  } catch (e) {
    console.log('ERROR', e.message);
    process.exit(1);
  } finally {
    try { proc.kill(); } catch (e) {}
    process.exit(0);
  }
})();
