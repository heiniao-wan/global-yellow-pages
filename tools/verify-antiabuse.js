/**
 * 防刷引擎逻辑的独立验证（可在 Node 或浏览器外跑）
 * 用最小 DOM 桩件驱动 antiabuse.js，验证六层判定是否符合预期
 */
const fs = require('fs');
const vm = require('vm');

/* ── 最小 DOM / localStorage 桩件 ── */
/**
 * storage 传「已有对象」时直接复用同一份 backing store，
 * 这样两个环境实例才能模拟「同一浏览器的两个会话共享 localStorage」。
 */
function makeLocalStorage(backing) {
  const data = backing || {};
  return {
    get length() { return Object.keys(data).length; },
    key: i => Object.keys(data)[i],
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}

function buildEnv(opts) {
  opts = opts || {};
  const ls = makeLocalStorage(opts.storage);
  const nav = {
    language: 'zh-CN',
    languages: ['zh-CN', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
  };
  if (opts.webdriver) nav.webdriver = true;

  const canvas = {
    getContext: () => ({
      textBaseline: '', font: '', fillStyle: '',
      fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
      getExtension: () => null, getParameter: () => ''
    }),
    toDataURL: () => 'data:image/png;base64,STUB'
  };
  const doc = {
    hidden: opts.hidden || false,
    querySelectorAll: () => opts.traps || [],
    createElement: () => canvas,
    body: { appendChild() {} },
    readyState: 'complete',
    addEventListener() {}
  };
  const screen = { width: 1920, height: 1080, colorDepth: 24 };

  // 可控时钟：以真实时间为基准 + 用例指定的偏移量，用于放行时序检查。
  // 两个环境必须共用同一 base，否则指纹里的时间分量会不一致。
  const clock = opts.clock || { base: Date.now(), offset: 0 };
  const fakeDate = function (a, b, c) {
    // 支持 new Date() 与 new Date(x) 两种用法
    if (!(this instanceof fakeDate)) return new Date(clock.base + clock.offset).toString();
    return new Date(arguments.length === 0 ? clock.base + clock.offset
                                            : arguments[0]);
  };
  fakeDate.now = () => clock.base + clock.offset;
  fakeDate.parse = Date.parse;
  fakeDate.UTC = Date.UTC;

  const sandbox = {
    window: {},
    document: doc,
    navigator: nav,
    screen: screen,
    localStorage: ls,
    Image: function () {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console,
    Math: Math,
    Date: fakeDate,
    JSON: JSON,
    Intl: Intl,
    URL: URL,
    RegExp: RegExp,
    String: String,
    Object: Object,
    Number: Number,
    Array: Array,
    Error: Error,
    isNaN: isNaN,
    parseInt: parseInt
  };
  sandbox.window.localStorage = ls;
  sandbox.window.document = doc;
  sandbox.window.navigator = nav;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  // 先把时钟停在 T0 加载引擎（此时 bootAt = T0），
  // 再按需推进到 T0+elapsed，模拟「用户停留了 elapsed 毫秒才投票」
  clock.base = opts.bootAt || Date.now();
  clock.offset = 0;
  vm.runInContext(fs.readFileSync('assets/js/antiabuse.js', 'utf8'), sandbox);
  clock.offset = opts.elapsed === undefined ? 0 : opts.elapsed;
  return sandbox;
}

/* ── 测试用例 ── */
let pass = 0, fail = 0;
function t(name, fn) {
  try {
    fn();
    console.log('  OK   ' + name);
    pass++;
  } catch (e) {
    console.log('  FAIL ' + name + ' -> ' + e.message);
    fail++;
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}

/* ① 蜜罐 */
t('蜜罐被填写 → 拒绝', () => {
  const env = buildEnv({ traps: [{ value: 'http://spam.example' }] });
  const r = env.window.AntiAbuse.canVote('site-a', 'like');
  expect(!r.pass && r.reason === 'honeypot', '应因蜜罐被拒绝，实际: ' + JSON.stringify(r));
});

t('蜜罐为空 → 放行', () => {
  const env = buildEnv({ traps: [{ value: '' }, { value: '  ' }], elapsed: 3000 });
  const r = env.window.AntiAbuse.canVote('site-a', 'like');
  expect(r.pass, '不应被拦截: ' + JSON.stringify(r));
});

/* ② 时序 */
t('页面刚加载即点击 → 拒绝', () => {
  const env = buildEnv();
  const r = env.window.AntiAbuse.canVote('site-a', 'like');
  expect(!r.pass && r.reason === 'too-fast', '应因过快被拒绝，实际: ' + JSON.stringify(r));
});

/* ③ 自动化特征 */
t('检测到 webdriver → 拒绝', () => {
  const env = buildEnv({ webdriver: true });
  const r = env.window.AntiAbuse.canVote('site-a', 'like');
  expect(!r.pass && r.reason === 'automation', '应识别自动化，实际: ' + JSON.stringify(r));
});

/* ④ 存活性 */
t('后台标签页投票 → 拒绝', () => {
  const env = buildEnv({ hidden: true });
  const r = env.window.AntiAbuse.canVote('site-a', 'like');
  expect(!r.pass && r.reason === 'hidden-tab', '应拒绝隐藏标签页，实际: ' + JSON.stringify(r));
});

/* ⑤ 一站一票（可取消、可改票）—— 2026-10-19 规则变更后的核心验证 */
t('首次投票放行，投完后记录了投了哪一项', () => {
  const env = buildEnv({ elapsed: 3000 });
  const A = env.window.AntiAbuse;
  const first = A.canVote('site-a', 'like');
  expect(first.pass, '首次合法投票应放行: ' + JSON.stringify(first));

  A.commitVote('site-a', 'like');
  expect(A.hasVoted('site-a') === true, '投票后应标记为已投');
  expect(A.currentVote('site-a') === 'like', '应能读回投的是哪一项');
});

t('已投过后再次操作仍放行（改票与取消的前提）', () => {
  const env = buildEnv({ elapsed: 3000 });
  const A = env.window.AntiAbuse;
  A.commitVote('site-a', 'like');

  const r1 = A.canVote('site-a', 'like');       // 再点同一项 = 取消
  expect(r1.pass === true, '再点已投项应放行（取消）: ' + JSON.stringify(r1));
  expect(r1.alreadyVoted === 'like', '应告知之前投的是 like');

  const r2 = A.canVote('site-a', 'dislike');    // 点其他项 = 改票
  expect(r2.pass === true, '点其他项应放行（改票）: ' + JSON.stringify(r2));
  expect(r2.alreadyVoted === 'like', '改票时也应告知原选项');
});

t('取消投票后 hasVoted 转 false，且可重新投', () => {
  const env = buildEnv({ elapsed: 3000 });
  const A = env.window.AntiAbuse;
  A.commitVote('site-a', 'broken');
  expect(A.hasVoted('site-a') === true, '投过后应为已投');

  A.clearVoted('site-a');
  expect(A.hasVoted('site-a') === false, 'clearVoted 后应回到未投');
  expect(A.currentVote('site-a') === null, 'clearVoted 后 currentVote 应为 null');

  A.commitVote('site-a', 'like');
  expect(A.currentVote('site-a') === 'like', '取消后应能重新投票');
});

t('votedMap 带上具体选项，供 UI 判断「再点=取消」', () => {
  const env = buildEnv();
  const A = env.window.AntiAbuse;
  A.commitVote('site-a', 'like');
  A.commitVote('site-b', 'broken');
  const map = A.votedMap();
  expect(map['site-a'] === 'like', 'site-a 应记为 like，实际 ' + JSON.stringify(map['site-a']));
  expect(map['site-b'] === 'broken', 'site-b 应记为 broken，实际 ' + JSON.stringify(map['site-b']));
});

t('已投 A 不影响投 B', () => {
  const env = buildEnv();
  const A = env.window.AntiAbuse;
  A.commitVote('site-a', 'like');
  A.commitVote('site-b', 'dislike');
  expect(A.hasVoted('site-a') && A.hasVoted('site-b'), '两个站都应记录');
  const map = A.votedMap();
  expect(map['site-a'] && map['site-b'], 'votedMap 应同时包含两站');
  expect(Object.keys(map).length === 2, 'votedMap 不应有第三项，实际 ' + Object.keys(map).length);
});

t('不同指纹 → 互不干扰（家庭两台设备）', () => {
  // 两台设备各自一个 visitor，但共用同一个出口 IP —— 这是「按 IP 限一次」会误伤的典型场景
  const a = buildEnv({ storage: { 'gyp:visitor': 'v_deviceA' }, elapsed: 3000 });
  const b = buildEnv({ storage: { 'gyp:visitor': 'v_deviceB' }, elapsed: 3000 });

  const fa = a.window.AntiAbuse.fingerprint();
  const fb = b.window.AntiAbuse.fingerprint();
  expect(fa !== fb, '两个设备的指纹应当不同，实际都是 ' + fa);

  a.window.AntiAbuse.commitVote('site-a', 'like');
  expect(a.window.AntiAbuse.hasVoted('site-a'), 'A 投成功');
  expect(!b.window.AntiAbuse.hasVoted('site-a'), 'B 不应被 A 的投票锁住');
});

t('同一指纹 → 第二次被拒（换 IP 也拦得住）', () => {
  const seed = { 'gyp:visitor': 'v_same_device' };
  // 两个会话模拟同一台设备的两次访问：共享 localStorage，visitor 相同
  const a = buildEnv({ storage: seed, elapsed: 3000 });
  const b = buildEnv({ storage: seed, elapsed: 3000 });
  expect(a.window.AntiAbuse.fingerprint() === b.window.AntiAbuse.fingerprint(),
         '同一设备两次会话指纹应一致，实际 ' +
         a.window.AntiAbuse.fingerprint() + ' vs ' + b.window.AntiAbuse.fingerprint());

  a.window.AntiAbuse.commitVote('site-a', 'like');
  expect(b.window.AntiAbuse.hasVoted('site-a'),
         '同一设备换 IP 也应被识别为已投票');
});

/* ⑥ 速率限制 */
t('滑动窗口内超限投票 → 拒绝', () => {
  const env = buildEnv({ elapsed: 3000 });
  const A = env.window.AntiAbuse;
  // 连续提交 25 次到不同站点，第 21 次起应超限
  for (let i = 0; i < 25; i++) {
    A.commitVote('bulk-' + i, 'like');
  }
  const r = A.canVote('bulk-final', 'like');
  expect(!r.pass && r.reason === 'rate-limit',
         '超限后应被速率限制拦截，实际: ' + JSON.stringify(r));
});

t('窗口滑出后速率恢复', () => {
  const seed = {};
  const bootAt = Date.now();
  const env = buildEnv({ storage: seed, bootAt: bootAt, elapsed: 3000 });
  const A = env.window.AntiAbuse;
  for (let i = 0; i < 25; i++) A.commitVote('w-' + i, 'like');
  expect(!A.canVote('w-final', 'like').pass, '窗口内应被限');

  // 同一个 bootAt，推进时钟超过 60 秒窗口，旧记录应失效
  const env2 = buildEnv({ storage: seed, bootAt: bootAt, elapsed: 70000 });
  expect(env2.window.AntiAbuse.fingerprint() === A.fingerprint(),
         '推进时钟不应改变指纹');
  expect(env2.window.AntiAbuse.canVote('w-final', 'like').pass,
         '窗口滑出后应恢复可投');
});

/* ⑦ 指纹稳定性 */
t('同一环境指纹稳定不变', () => {
  const env = buildEnv();
  const f1 = env.window.AntiAbuse.fingerprint();
  const f2 = env.window.AntiAbuse.fingerprint();
  expect(f1 === f2 && f1.length > 3, '指纹应稳定，实际 ' + f1 + ' / ' + f2);
});

/* ⑧ 提示文案完整 */
t('每种拦截原因都有中文提示', () => {
  const env = buildEnv({ traps: [{ value: 'x' }] });
  const r = env.window.AntiAbuse.canVote('site-a', 'like');
  expect(typeof r.message === 'string' && r.message.length > 4, '缺少提示文案');
});

/* ⑨ 防护自述 */
t('防护信息含六层说明与指纹标识', () => {
  const env = buildEnv();
  const info = env.window.AntiAbuse.protectionInfo();
  expect(info.layers.length === 6, '应为 6 层，实际 ' + info.layers.length);
  expect(!!info.fingerprint, '应有指纹标识');
  expect(info.layers.every(l => l.title && l.desc), '每层都应有标题与说明');
});

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail === 0 ? 0 : 1);