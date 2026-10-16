/**
 * AntiAbuse — 恶意点击防护引擎
 *
 * 设计目标：学习 Google AdSense 的防无效点击体系。
 * AdSense 并不依赖单一信号，而是把多个弱信号加权成一次投票的可信度评分。
 * 本引擎在纯前端环境下实现同一套思路：
 *
 *   ① 蜜罐字段      —— 真人看不见、机器人爱填的隐藏表单
 *   ② 交互时序校验  —— 页面加载到点击的间隔，快于人类反应极限即判机器
 *   ③ 浏览器指纹   —— Canvas 指纹 + 硬件特征，识别改 IP 换设备的专业刷票
 *   ④ 速率限制     —— 滑动窗口内限制单指纹的投票频次
 *   ⑤ 一次性投票   —— 站点指纹 × 站点ID 联合唯一键，一票定终身不可改
 *   ⑥ 存活性检测   —— 页面是否真的在前台可见且有真实焦点交互
 *
 * 重要说明（务必知情）：
 * 纯前端防护无法做到 100% 可靠，因为校验逻辑本身暴露在客户端，
 * 攻击者可以改代码绕过。这里的 IP 字段在静态站点下取不到真实公网 IP，
 * 因此以指纹为主、IP 为辅。未来接入服务端后，把同样的信号上报做服务端
 * 强制校验，才是真正的铁闸。
 */

/** 一票定终身的本地锁键前缀 */
const VOTE_KEY = 'gyp:voted:';
/** 滑动窗口计数的存储键 */
const RATE_KEY = 'gyp:rate:';
/** 本机访客标识 */
const VISITOR_KEY = 'gyp:visitor';

/* ────────────────────────── 存储封装 ────────────────────────── */
/** localStorage 在隐私模式 / 部分浏览器下会抛错，统一走安全读写 */
const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  },
  del(k) {
    try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ }
  }
};

/* ────────────────────────── 访客标识 ────────────────────────── */

/** 常见桌面浏览器的隐私/自动化特征 */
function isAutomation() {
  return !!(
    window.navigator.webdriver ||
    window.__playwright__ ||
    window.__nightmare ||
    window.callPhantom ||
    window._phantom ||
    (navigator.languages && navigator.languages.length === 0)
  );
}

/** 简易哈希，把长字符串压成短指纹 */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** 读取 Cookie 中的访客 ID，没有则新建 */
function getVisitorId() {
  let id = store.get(VISITOR_KEY);
  if (id) return id;
  id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  store.set(VISITOR_KEY, id);
  return id;
}

/**
 * 生成浏览器指纹：把若干稳定特征拼接后哈希。
 * 这些特征在同一次会话内不变，但跨设备 / 跨浏览器会变，
 * 因此「换 IP 但指纹不变」仍会被识别为同一刷票源。
 */
function buildFingerprint() {
  const parts = [];

  // Canvas 指纹：渲染一段文字与图形，取像素哈希。不同 GPU / 字体渲染结果不同。
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 90, 24);
      ctx.fillStyle = '#069';
      ctx.fillText('fingerprint-canvas', 2, 4);
      ctx.beginPath();
      ctx.arc(40, 40, 20, 0, Math.PI * 2);
      ctx.fill();
      parts.push(c.toDataURL().slice(-120));
    }
  } catch (e) { /* 画布被禁用则跳过该项 */ }

  // 屏幕与硬件特征
  parts.push(String(screen.width) + 'x' + screen.height + 'x' + (screen.colorDepth || 24));
  parts.push(String(navigator.hardwareConcurrency || 'na'));
  parts.push(String(navigator.deviceMemory || 'na'));
  parts.push(String(navigator.maxTouchPoints || 0));

  // 语言与时区：跨地区刷票工具常漏掉这两项
  parts.push((navigator.language || '') + '|' + ((navigator.languages || []).join(',')));
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const off = new Date().getTimezoneOffset();
    parts.push(tz + '#' + off);
  } catch (e) { parts.push('tz-na'); }

  // 平台与 UA 主版本
  parts.push(navigator.platform || '');
  parts.push((navigator.userAgent || '').replace(/Chrome\/[\d.]+/, 'Chrome/x').replace(/Version\/[\d.]+/, 'Version/x'));

  // WebGL 渲染器：可识别虚拟机与云浏览器的 GPU 特征
  try {
    const gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) + '|' + String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)));
    }
  } catch (e) { /* WebGL 不可用则跳过 */ }

  return hash32(parts.join('::') + '::' + getVisitorId());
}

/* ────────────────────────── 引擎主体 ────────────────────────── */

const AntiAbuse = (function () {
  /** 页面加载时刻，用于时序校验 */
  const bootAt = Date.now();

  /** 速率限制配置：窗口 60 秒内最多 20 次投票 */
  const RATE_WINDOW_MS = 60 * 1000;
  const RATE_LIMIT = 20;

  /** 真人点击的最小合理停留时间：快于 800ms 视为脚本 */
  const MIN_DWELL_MS = 800;

  /** 缓存指纹，首次调用后复用 */
  let cachedFingerprint = null;
  function fingerprint() {
    if (!cachedFingerprint) cachedFingerprint = buildFingerprint();
    return cachedFingerprint;
  }

  /* ── ① 蜜罐 ── */
  /**
   * 蜜罐：一个视觉上隐藏但对机器人可见的输入框。
   * 真人看不见也不会去填；自动化脚本按 name/label 扫描表单时通常会填。
   * 填了就是机器，直接拒绝。
   */
  function checkHoneypot() {
    const traps = document.querySelectorAll('input[name="gyp_website"], textarea[name="gyp_email"]');
    for (let i = 0; i < traps.length; i++) {
      if (traps[i].value && traps[i].value.trim() !== '') {
        return { pass: false, reason: 'honeypot' };
      }
    }
    return { pass: true };
  }

  /* ── ② 交互时序 ── */
  function checkDwell() {
    const dwell = Date.now() - bootAt;
    if (dwell < MIN_DWELL_MS) return { pass: false, reason: 'too-fast', dwell };
    return { pass: true, dwell };
  }

  /* ── ③ 存活性 ── */
  function checkAlive() {
    // 页面完全不可见时投票，高度可疑（脚本后台执行）
    if (document.hidden) return { pass: false, reason: 'hidden-tab' };
    return { pass: true };
  }

  /* ── ④ 自动化特征 ── */
  function checkAutomation() {
    if (isAutomation()) return { pass: false, reason: 'automation' };
    return { pass: true };
  }

  /* ── ⑤ 速率限制 ── */
  /**
   * 滑动窗口计数。记录本指纹最近每次投票的时间戳，
   * 超出窗口的记录被丢弃，窗口内超过上限则拒绝。
   */
  function checkRate() {
    const key = RATE_KEY + fingerprint();
    let stamps = [];
    try { stamps = JSON.parse(store.get(key) || '[]'); } catch (e) { stamps = []; }
    if (!Array.isArray(stamps)) stamps = [];

    const now = Date.now();
    stamps = stamps.filter(t => now - t < RATE_WINDOW_MS);

    if (stamps.length >= RATE_LIMIT) {
      store.set(key, JSON.stringify(stamps));
      return { pass: false, reason: 'rate-limit', count: stamps.length };
    }
    return { pass: true, count: stamps.length, _stamps: stamps, _key: key };
  }

  /* ── ⑥ 一票定终身 ── */
  /**
   * 投票键 = 指纹 × 站点ID。
   * 这是需求里「每个 IP 只允许点击一次」的真正落点——
   * 换成指纹后，家庭/公司共用 NAT 的用户不会互相锁票，
   * 而同一台设备反复投票会被立刻拦住。
   */
  function voteKey(siteId) {
    return VOTE_KEY + fingerprint() + ':' + siteId;
  }
  function hasVoted(siteId) {
    return store.get(voteKey(siteId)) !== null;
  }
  function markVoted(siteId, action) {
    store.set(voteKey(siteId), JSON.stringify({
      action: action,
      at: Date.now(),
      fp: fingerprint()
    }));
  }

  /** 取出用户已投过的全部站点 → 用于页面初始化时置灰按钮 */
  function votedMap() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(VOTE_KEY) === 0) {
          const siteId = k.slice((VOTE_KEY + fingerprint() + ':').length);
          if (siteId) out[siteId] = true;
        }
      }
    } catch (e) { /* 忽略 */ }
    return out;
  }

  /**
   * 投票总闸。所有检查通过才返回 pass。
   * @param {string} siteId 站点唯一 ID
   * @param {string} action like | dislike | broken
   */
  function canVote(siteId, action) {
    const signals = [
      checkAutomation(),
      checkHoneypot(),
      checkAlive(),
      checkDwell(),
      checkRate()
    ];

    for (let i = 0; i < signals.length; i++) {
      if (!signals[i].pass) {
        return { pass: false, reason: signals[i].reason, message: REASON_TEXT[signals[i].reason] || '操作过于异常，请稍后再试。' };
      }
    }

    if (hasVoted(siteId)) {
      return { pass: false, reason: 'already-voted', message: '你已经评价过这个站点了，每个站点只能评价一次。' };
    }

    return { pass: true, fingerprint: fingerprint() };
  }

  /** 记一次成功投票（仅在 canVote 通过后调用） */
  function commitVote(siteId, action) {
    markVoted(siteId, action);
    const rate = checkRate();
    if (rate._stamps) {
      rate._stamps.push(Date.now());
      store.set(rate._key, JSON.stringify(rate._stamps));
    }
  }

  /** 供页面展示的防护自述文案 */
  function protectionInfo() {
    return {
      fingerprint: fingerprint(),
      visitor: getVisitorId(),
      layers: [
        { icon: '🎯', title: '蜜罐字段', desc: '机器人会填隐藏表单，真人看不见' },
        { icon: '⏱️', title: '交互时序', desc: '点击快于人类反应极限直接拦下' },
        { icon: '🧬', title: '浏览器指纹', desc: '换 IP 也认得出同一台设备' },
        { icon: '🚦', title: '速率限制', desc: '每分钟最多 20 次，超出即拦截' },
        { icon: '🔒', title: '一票定终身', desc: '每站仅可评价一次，不可修改' },
        { icon: '👁️', title: '存活性检测', desc: '后台标签页的投票不予采信' }
      ]
    };
  }

  const REASON_TEXT = {
    'honeypot': '检测到自动化行为，投票已拦截。',
    'automation': '检测到自动化环境，投票已拦截。',
    'hidden-tab': '请在页面前台操作，投票已拦截。',
    'too-fast': '操作速度异常，请稍候再试。',
    'rate-limit': '操作过于频繁，请稍后再试。',
    'already-voted': '你已经评价过这个站点了，每个站点只能评价一次。'
  };

  return {
    canVote: canVote,
    commitVote: commitVote,
    hasVoted: hasVoted,
    votedMap: votedMap,
    fingerprint: fingerprint,
    visitor: getVisitorId,
    protectionInfo: protectionInfo
  };
})();

window.AntiAbuse = AntiAbuse;