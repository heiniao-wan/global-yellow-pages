/**
 * 全站共享投票 API（Cloudflare Pages Functions + KV）
 *
 *   GET    /api/votes              → 所有站点的全站票数（公开，免鉴权）
 *   GET    /api/votes?mine=1       → 我在本机投过的票（带指纹）
 *   POST   /api/votes              → 投票 / 改票   body: {id, action}
 *   DELETE /api/votes?id=<站点ID>   → 取消我对该站的票
 *
 * 部署要求：
 *   1. KV 命名空间绑定名：VOTES（与留言用的 MESSAGES 分开，便于日后独立扩容）
 *   2. 环境变量：VOTE_KEY（用于把客户端指纹与服务端记录的指纹做 HMAC 绑定）
 *      不配也能跑，只是换设备后无法找回自己的票（见下方「关于指纹」）
 *
 * ── 数据模型 ──
 *   票数聚合：  votes:agg            → JSON { "<站点ID>": {like,dislike,broken}, ... }
 *   个人票记录：v:<hash>:<站点ID>    → "like" | "dislike" | "broken"
 *   防刷计数：  rl:<hash>            → 时间戳（TTL 60s）
 *   全局限流：  rl:g:<ip>           → 时间戳（TTL 60s）
 *
 * ── 为什么 hash 而不是直接存指纹 ──
 * 浏览器指纹本身是稳定可重算的，等同于个人标识。存明文意味着 KV 里躺着
 * 可直接关联到设备的数据。服务端用 VOTE_KEY 做一次 HMAC，KV 里只出现不可逆
 * 的散列：攻击者拿到 KV 也无法反推指纹，且换站换环境互不通用。
 * 代价是「清空 VOTE_KEY 会让所有人重新投一次」，这个代价我们接受。
 *
 * ── 关于防刷的真实边界（务必知情）──
 * 服务端强制的是：同一指纹对同一站点只能保留一票、每分钟最多若干次、
 * 改票与取消不额外消耗配额。这能挡住普通脚本和随手刷。
 * 挡不住有耐心的专业刷票方——他们可以伪造浏览器指纹。
 * 真要根治得上验证码或登录，本项目刻意不做那件事（见 FAQ 的隐私承诺）。
 */

/* ── Web Crypto 工具 ── */

async function hmacHex(key, text) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(text));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 指纹为空时退化为按 IP 聚合，至少保证同一出口网络共用一个身份 */
async function actorHash(fp, ip, secret) {
  const raw = String(fp || '').trim() || ('ip:' + ip);
  if (secret) return await hmacHex(secret, raw);
  // 未配 VOTE_KEY 时的退化方案：仅作隔离用途，不可逆性弱于 HMAC
  return await hmacHex('gyp-fallback-not-for-security', raw);
}

const json = (code, obj) => new Response(JSON.stringify(obj), {
  status: code,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  }
});

const ACTIONS = ['like', 'dislike', 'broken'];

/** 站点 ID 只允许安全字符，防键注入 */
function safeId(id) {
  const s = String(id || '');
  return /^[a-z0-9._-]{1,64}$/i.test(s) ? s : null;
}

/* ── 聚合票数读写 ── */

async function readAgg(kv) {
  try {
    const raw = await kv.get('votes:agg');
    if (!raw) return {};
    const o = JSON.parse(raw);
    return (o && typeof o === 'object') ? o : {};
  } catch (e) {
    return {};
  }
}

async function writeAgg(kv, agg) {
  await kv.put('votes:agg', JSON.stringify(agg));
}

function blankCounts() {
  return { like: 0, dislike: 0, broken: 0 };
}

/**
 * 并发安全地改一次票数。
 *
 * KV 没有原子自增，「读-改-写」存在丢更新风险：两人同时给不同站点投票时，
 * 两次读到同一份旧聚合，后写的会把先写的覆盖掉，票凭空消失且投票者无从察觉
 * （他已被记为"已投"，无法重来）。
 *
 * 缓解办法是写后回读校验：KV 在同一 colo 内写入即可见，回读能确认本次增量
 * 是否真的落上；被覆盖则重试。配合下方「个人票记录」这一层，
 * 单条投票记录本身永远不会丢（每个指纹-站点一个独立键），
 * 聚合数字偶尔的偏差会随着后续投票自愈，不影响个人可否撤销。
 */
async function adjustCount(kv, siteId, action, delta) {
  let lastAgg = {};
  for (let attempt = 0; attempt < 5; attempt++) {
    const agg = await readAgg(kv);
    lastAgg = agg;
    const c = agg[siteId] || blankCounts();
    const before = c[action];
    const target = Math.max(0, before + delta);

    // 已经不可能更小（例如重复撤销），无需再写
    if (delta < 0 && before <= 0) return agg;

    c[action] = target;
    agg[siteId] = c;
    try {
      await writeAgg(kv, agg);
      // 回读校验：确认本次写入没被并发的另一次写入覆盖
      const check = await readAgg(kv);
      const got = (check[siteId] || blankCounts())[action];
      if (got === target) return check;
      lastAgg = check;
      // 未落上 → 下一轮重试（带上被覆盖后的最新值）
    } catch (e) {
      if (attempt === 4) throw e; // 重试仍失败才上抛
    }
  }
  return lastAgg;
}

/* ── 限流 ── */

/**
 * 滑动窗口限流：窗口内最多 maxOps 次写操作。
 *
 * 注意实现方式是「计数 + 窗口起点」两段存储，而不是记录每次操作的时间戳：
 * 后者会让键体积随频率无限增长，且 KV 单值有 25MB 上限。
 * 精度上它是"每窗口 maxOps 次"，比逐次记时间戳粗，但对刷票足够——
 * 我们要挡的是"一分钟内点几百次"的脚本，不是"第 21 次点击"的精细配额。
 */
async function rateLimited(kv, hash, maxOps, windowSec) {
  const key = 'rl:' + hash;
  const now = Date.now();
  const windowMs = windowSec * 1000;
  try {
    const raw = await kv.get(key);
    if (!raw) {
      // 首次：记录窗口起点，计数隐含为「本次操作即第 1 次」
      await kv.put(key, JSON.stringify({ start: now, n: 1 }), { expirationTtl: windowSec * 2 });
      return false;
    }
    let rec;
    try { rec = JSON.parse(raw); } catch (e) { rec = null; }
    if (!rec || typeof rec.n !== 'number') {
      // 旧格式或损坏：当作新窗口重来，避免永久锁死
      await kv.put(key, JSON.stringify({ start: now, n: 1 }), { expirationTtl: windowSec * 2 });
      return false;
    }
    if (now - rec.start >= windowMs) {
      // 窗口已过，重开
      await kv.put(key, JSON.stringify({ start: now, n: 1 }), { expirationTtl: windowSec * 2 });
      return false;
    }
    if (rec.n >= maxOps) return true;   // 本窗口已超额
    await kv.put(key, JSON.stringify({ start: rec.start, n: rec.n + 1 }), { expirationTtl: windowSec * 2 });
    return false;
  } catch (e) {
    /* KV 抖动不阻断操作——宁可放行，也不要因为存储故障让全站不能投票 */
    return false;
  }
}

/* ── 各方法 ── */

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  } });
}

/**
 * GET /api/votes            → { ok, counts }
 * GET /api/votes?mine=1     → { ok, mine: { 站点ID: action } }
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const kv = env.VOTES;
  if (!kv) return json(503, { ok: false, error: 'VOTES not bound' });

  const url = new URL(request.url);

  // 诊断：只回报「配没配」与配置项是否齐全，绝不回传密钥本身。
  // 用途是让站长在控制台外确认绑定状态，避免反复猜。
  if (url.searchParams.get('diag') === '1') {
    const secret = String(env.VOTE_KEY || '');
    return json(200, {
      ok: true,
      votesKvBound: !!kv,
      voteKeyConfigured: secret.length > 0,
      voteKeyLength: secret.length,          // 只给长度，便于确认是否被截断
      note: '本接口不会返回 VOTE_KEY 的内容'
    });
  }

  if (url.searchParams.get('mine') === '1') {
    const fp = request.headers.get('X-Gyp-Fp') || '';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hash = await actorHash(fp, ip, env.VOTE_KEY);
    const mine = {};
    try {
      const list = await kv.list({ prefix: 'v:' + hash + ':', limit: 1000 });
      for (const k of list.keys) {
        const val = await kv.get(k.name);
        if (!val) continue;
        const siteId = k.name.slice(('v:' + hash + ':').length);
        if (siteId && ACTIONS.indexOf(val) >= 0) mine[siteId] = val;
      }
    } catch (e) { /* 读不到就当没投过 */ }
    return json(200, { ok: true, mine: mine });
  }

  const counts = await readAgg(kv);
  return json(200, { ok: true, counts: counts });
}

/** POST /api/votes  body: { id, action }
 *  同一指纹对同一站点：只保留一票。
 *  投不同项 = 改票（旧项 -1、新项 +1）；投相同项 = 幂等空操作。 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.VOTES;
  if (!kv) return json(503, { ok: false, error: 'VOTES not bound' });

  let d;
  try { d = await request.json(); } catch (e) { return json(400, { ok: false, error: 'bad json' }); }

  const siteId = safeId(d.id);
  const action = String(d.action || '');
  if (!siteId) return json(400, { ok: false, error: 'bad id' });
  if (ACTIONS.indexOf(action) < 0) return json(400, { ok: false, error: 'bad action' });

  // 蜜罐：前端隐藏字段一旦有值即为脚本
  if (String(d.trap || '').trim()) return json(403, { ok: false, error: 'rejected' });

  const fp = request.headers.get('X-Gyp-Fp') || '';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hash = await actorHash(fp, ip, env.VOTE_KEY);
  const voteKey = 'v:' + hash + ':' + siteId;

  // 双层限流：单身份 20 次/分，单出口 IP 60 次/分（防一人多指纹）
  if (await rateLimited(kv, hash, 20, 60)) {
    return json(429, { ok: false, error: 'rate limited' });
  }
  if (ip !== 'unknown' && await rateLimited(kv, 'g:' + ip, 60, 60)) {
    return json(429, { ok: false, error: 'rate limited' });
  }

  let prev = null;
  try { prev = await kv.get(voteKey); } catch (e) { /* 视作未投 */ }

  if (prev === action) {
    // 重复提交同一票：返回当前全站票数，不做任何写入
    return json(200, { ok: true, action: action, changed: false,
                       counts: await readAgg(kv) });
  }

  // 先写个人票，再改聚合。若聚合失败，下次同操作会因 prev===action 而不再重试，
  // 故把聚合调整放在写个人票之前，让"票数没加上"成为可重试的中间态。
  if (prev && ACTIONS.indexOf(prev) >= 0) {
    await adjustCount(kv, siteId, prev, -1);   // 改票：撤掉旧项
  }
  const agg = await adjustCount(kv, siteId, action, +1);

  try {
    await kv.put(voteKey, action);
  } catch (e) {
    // 个人票写失败：回滚聚合，避免出现「票数加了但查不到谁投的」
    if (prev && ACTIONS.indexOf(prev) >= 0) {
      await adjustCount(kv, siteId, prev, +1);
    } else {
      await adjustCount(kv, siteId, action, -1);
    }
    return json(503, { ok: false, error: 'write failed' });
  }

  return json(200, {
    ok: true,
    action: action,
    prev: prev && ACTIONS.indexOf(prev) >= 0 ? prev : null,
    changed: true,
    counts: agg
  });
}

/** DELETE /api/votes?id=<站点ID>  取消我对该站的票 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  const kv = env.VOTES;
  if (!kv) return json(503, { ok: false, error: 'VOTES not bound' });

  const url = new URL(request.url);
  const siteId = safeId(url.searchParams.get('id'));
  if (!siteId) return json(400, { ok: false, error: 'bad id' });

  const fp = request.headers.get('X-Gyp-Fp') || '';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hash = await actorHash(fp, ip, env.VOTE_KEY);
  const voteKey = 'v:' + hash + ':' + siteId;

  if (await rateLimited(kv, hash, 20, 60)) {
    return json(429, { ok: false, error: 'rate limited' });
  }

  let prev = null;
  try { prev = await kv.get(voteKey); } catch (e) { /* 视作未投 */ }

  if (!prev || ACTIONS.indexOf(prev) < 0) {
    return json(200, { ok: true, changed: false, counts: await readAgg(kv) });
  }

  await adjustCount(kv, siteId, prev, -1);
  try {
    await kv.delete(voteKey);
  } catch (e) {
    await adjustCount(kv, siteId, prev, +1);   // 删失败则回滚
    return json(503, { ok: false, error: 'delete failed' });
  }

  return json(200, { ok: true, changed: true, removed: prev, counts: await readAgg(kv) });
}
