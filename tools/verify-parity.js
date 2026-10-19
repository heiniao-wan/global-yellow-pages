/**
 * verify-parity.js — V1 / V2 两套皮肤的关键逻辑一致性校验
 *
 * 背景：index.html 与 index-v2.html 共用同一份数据与交互逻辑，
 * 只在配色和部分文案上不同。历史上多次出现「V1 改了、V2 忘了同步」，
 * 导致两个页面行为不一致（最近一次：投票按钮渲染，V2 还在用 disabled）。
 *
 * 做法：把「两版必须完全一致的代码块」逐个抽出来做文本比对，
 * 不一致就报错并指出是哪一块。这个脚本要比人工检查可靠得多。
 *
 * 运行：node tools/verify-parity.js
 */
const fs = require('fs');
const path = require('path');

const V1 = fs.readFileSync(path.join(__dirname, '../assets/js/app.js'), 'utf8');
const V2 = fs.readFileSync(path.join(__dirname, '../assets/js/app-v2.js'), 'utf8');
const C1 = fs.readFileSync(path.join(__dirname, '../assets/css/style.css'), 'utf8');
const C2 = fs.readFileSync(path.join(__dirname, '../assets/css/style-v2.css'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); }
}

/**
 * 抽取一段代码：从 startMarker 处开始，一直取到「下一个顶层注释块」
 * （行首两个空格 + * 或 //）之前。这样不依赖具体措辞，
 * 改注释文字也不会让校验失效。
 */
function slice(text, startMarker) {
  const a = text.indexOf(startMarker);
  if (a < 0) return null;
  const rest = text.slice(a);
  // 顶层注释：行首恰好两个空格 + // 或 /*，且不是更深缩进的续行
  const m = /\n {0,4}(?:\/\/|\/\*[^ ])/.exec(rest);
  if (!m) return rest;
  return rest.slice(0, m.index + 1);
}

/** CSS 专用：按「选择器块」切，遇到下一个同层级选择器（行首非空白）为止 */
function sliceCss(text, startMarker) {
  const a = text.indexOf(startMarker);
  if (a < 0) return null;
  // 先定位本选择器块的结束（第一个行首为 } 的行）
  const rest = text.slice(a);
  const end = /^\}/m.exec(rest);
  if (!end) return rest;
  return rest.slice(0, end.index + 2);
}

/** 找出第一处不同的位置，便于定位 */
function firstDiff(x, y) {
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (x[i] !== y[i]) {
      const line = x.slice(0, i).split('\n').length;
      return '第 ' + line + ' 行附近不同：\n      V1: ' +
        JSON.stringify(x.slice(i - 40, i + 60)) + '\n      V2: ' +
        JSON.stringify(y.slice(i - 40, i + 60));
    }
  }
  if (x.length !== y.length) return '长度不同：V1=' + x.length + ' V2=' + y.length;
  return null;
}

console.log('\n【JS 逻辑块】');

// 只校验「行为逻辑」块——这些必须逐字一致，否则两个页面的行为会分叉。
// 纯渲染细节（配色、装饰）允许两版不同，不在此列。
const JS_BLOCKS = [
  ['投票按钮渲染', 'const buttons = VOTE_TYPES.map'],
  ['投票点击处理', "const btn = e.target.closest('.vote-btn');"],
  ['mergeCounts', 'function mergeCounts(local, remote)'],
  ['markVotedUI', 'function markVotedUI(siteId)'],
  ['syncFromServer', 'function syncFromServer()'],
  ['flashMsg 映射', 'function flashMsg(verdict)']
];

for (const [name, startMark, endMark] of JS_BLOCKS) {
  const a = slice(V1, startMark);
  const b = slice(V2, startMark);
  if (a === null || b === null) {
    check(name, false, a === null ? 'V1 里找不到该块' : 'V2 里找不到该块（多半是没同步过去）');
    continue;
  }
  check(name, a === b, a === b ? '' : firstDiff(a, b));
}

console.log('\n【CSS 样式块】');

// 只校验「交互状态」样式——配色两版本就不同，但状态表达必须一致，
// 否则会出现「V1 看得出取消了、V2 看不出」这类割裂。
const CSS_BLOCKS = [
  ['取消角标样式', '.vote-btn .vb-flag {'],
  ['已投票态样式', '.site-card.has-voted .vote-group'],
  ['复制按钮样式', '.site-cta {']
];

for (const [name, startMark, endMark] of CSS_BLOCKS) {
  const a = sliceCss(C1, startMark);
  const b = sliceCss(C2, startMark);
  if (a === null || b === null) {
    check(name, false, a === null ? 'V1 里找不到该块' : 'V2 里找不到该块');
    continue;
  }
  check(name, a === b, a === b ? '' : firstDiff(a, b));
}

console.log('\n【共享脚本引用】');

for (const f of ['index.html', 'index-v2.html']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + f), 'utf8');
  const need = ['assets/js/data.js', 'assets/js/faq-data.js', 'assets/js/votes-sync.js',
    'assets/js/antiabuse.js', 'assets/js/vault.js', 'assets/js/share.js',
    'assets/js/thumbs.js', 'assets/js/i18n.js', 'assets/js/app', 'assets/css/rail.css'];
  const missing = need.filter(p => !html.includes(p));
  check(f + ' 引入了全部共享脚本/样式', missing.length === 0,
    missing.length ? '缺：' + missing.join(', ') : '');
}

console.log('\n【HTML 结构对齐】');

const H_BLOCKS = [
  ['顶栏导航', '<nav class="topnav">'],
  ['分类栏容器', '<section class="cat-section"'],
  ['FAQ 区块', '<section class="faq"'],
  ['反馈区块', '<section class="feedback"'],
  ['左侧分类栏', 'class="side-cats"']
];

for (const f of ['index.html', 'index-v2.html']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + f), 'utf8');
  for (const [name, s1] of H_BLOCKS) {
    check(f + ' 的' + name + '存在', slice(html, s1) !== null);
  }
  // 两页的 section 数量应当一致
  const c1 = (fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').match(/<section/g) || []).length;
  const c2 = (fs.readFileSync(path.join(__dirname, '../index-v2.html'), 'utf8').match(/<section/g) || []).length;
  check('两版 <section> 数量一致', c1 === c2, 'index.html=' + c1 + ' index-v2.html=' + c2);
}

console.log('\n────────────────────────');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('────────────────────────');
process.exit(fail ? 1 : 0);
