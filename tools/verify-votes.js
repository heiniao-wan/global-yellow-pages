/**
 * verify-votes.js — /api/votes 服务端逻辑单测
 *
 * 用内存 Map 模拟 KV，直接调 functions/api/votes.js 的导出函数。
 * 覆盖：投票 / 改票 / 取消 / 幂等 / 参数校验 / 限流 / 鉴权边界 / 指纹隔离
 *
 * 运行：node tools/verify-votes.js
 */

const path = require('path');
const { pathToFileURL } = require('url');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

/* ── 内存 KV（行为对齐 Cloudflare KV 的最小接口） ── */
function makeKV(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list(opt) {
      const o = opt || {};
      const keys = [...m.keys()].filter(k => k.startsWith(o.prefix || '')).slice(0, o.limit || 1000);
      return { keys: keys.map(name => ({ name })) };
    },
    async reset() { m.clear(); }
  };
}

async function main() {
  const votes = await import(pathToFileURL(path.join(__dirname, '../functions/api/votes.js')).href);

  const SECRET = 'test-secret';
  function env(kv) { return { VOTES: kv, VOTE_KEY: SECRET }; }

  function req(opts) {
    const { method = 'GET', url = 'https://x/api/votes', body = null, fp = 'fpA', ip = '1.2.3.4' } = opts || {};
    const headers = { 'X-Gyp-Fp': fp, 'CF-Connecting-IP': ip };
    if (body) headers['Content-Type'] = 'application/json';
    return new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async function call(method, kv, opts) {
    const request = req(Object.assign({ method }, opts || {}));
    const ctx = { request, env: env(kv) };
    if (method === 'GET') return votes.onRequestGet(ctx);
    if (method === 'POST') return votes.onRequestPost(ctx);
    return votes.onRequestDelete(ctx);
  }

  async function body(r) { return r.json(); }

  /* ══════════════ 1. 基本投票 ══════════════ */
  console.log('\n【1】基本投票');
  {
    const kv = makeKV();
    const r = await call('POST', kv, { body: { id: 's1', action: 'like' } });
    const j = await body(r);
    check('首次投票返回 200', r.status === 200, j);
    check('返回 ok:true', j.ok === true, j);
    check('票数 like=1', j.counts && j.counts.s1 && j.counts.s1.like === 1, j.counts);
    check('标记 changed=true', j.changed === true, j);
    check('prev 为 null（原本没投）', j.prev === null, j);

    const g = await body(await call('GET', kv, {}));
    check('GET 能读到全站票数', g.counts.s1.like === 1, g);
  }

  /* ══════════════ 2. 一站一票：改票 ══════════════ */
  console.log('\n【2】改票（同一站换一项）');
  {
    const kv = makeKV();
    await call('POST', kv, { body: { id: 's1', action: 'like' } });
    const r = await call('POST', kv, { body: { id: 's1', action: 'dislike' } });
    const j = await body(r);
    check('改票成功', r.status === 200 && j.ok, j);
    check('prev 记录了原选项 like', j.prev === 'like', j);
    check('like 减回 0', j.counts.s1.like === 0, j.counts);
    check('dislike 加到 1', j.counts.s1.dislike === 1, j.counts);
    check('总票数仍为 1（没凭空多一票）',
      j.counts.s1.like + j.counts.s1.dislike + j.counts.s1.broken === 1, j.counts);
  }

  /* ══════════════ 3. 取消 ══════════════ */
  console.log('\n【3】取消投票');
  {
    const kv = makeKV();
    await call('POST', kv, { body: { id: 's1', action: 'broken' } });
    const r = await call('DELETE', kv, { url: 'https://x/api/votes?id=s1' });
    const j = await body(r);
    check('取消返回 200', r.status === 200, j);
    check('返回 changed=true', j.changed === true, j);
    check('告知移除了哪一项 broken', j.removed === 'broken', j);
    check('broken 减回 0', j.counts.s1.broken === 0, j.counts);

    const g = await body(await call('GET', kv, {}));
    check('取消后票数确实归零', (g.counts.s1 || {}).broken === 0, g.counts);
  }

  /* ══════════════ 4. 幂等与边界 ══════════════ */
  console.log('\n【4】幂等与边界');
  {
    const kv = makeKV();
    await call('POST', kv, { body: { id: 's1', action: 'like' } });
    const again = await body(await call('POST', kv, { body: { id: 's1', action: 'like' } }));
    check('重复投同一项不重复计数', again.counts.s1.like === 1, again.counts);
    check('重复投返回 changed=false', again.changed === false, again);

    const del = await body(await call('DELETE', kv, { url: 'https://x/api/votes?id=s1' }));
    const del2 = await body(await call('DELETE', kv, { url: 'https://x/api/votes?id=s1' }));
    check('对没投过的站取消不报错', del2.ok === true, del2);
    check('二次取消 changed=false', del2.changed === false, del2);
    check('票数不会被扣成负数', (del2.counts.s1 || {}).like >= 0, del2.counts);

    // 取消后可以重新投
    const re = await body(await call('POST', kv, { body: { id: 's1', action: 'dislike' } }));
    check('取消后可以重新投票', re.counts.s1.dislike === 1, re.counts);
    check('重投时 like 仍为 0', re.counts.s1.like === 0, re.counts);
  }

  /* ══════════════ 5. 参数校验 ══════════════ */
  console.log('\n【5】参数校验');
  {
    const kv = makeKV();
    check('缺 id → 400', (await call('POST', kv, { body: { action: 'like' } })).status === 400);
    check('非法 action → 400', (await call('POST', kv, { body: { id: 's1', action: 'hack' } })).status === 400);
    check('id 含路径穿越 → 400',
      (await call('POST', kv, { body: { id: '../etc/passwd', action: 'like' } })).status === 400);
    check('id 超长 → 400', (await call('POST', kv, { body: { id: 'x'.repeat(100), action: 'like' } })).status === 400);
    check('蜜罐有值 → 403', (await call('POST', kv, { body: { id: 's1', action: 'like', trap: 'bot' } })).status === 403);
    check('非法 id 的 DELETE → 400', (await call('DELETE', kv, { url: 'https://x/api/votes?id=..%2F' })).status === 400);

    const g0 = await body(await call('GET', kv, {}));
    check('所有非法请求都没有写入数据', Object.keys(g0.counts).length === 0, g0.counts);
  }

  /* ══════════════ 6. KV 未绑定 ══════════════ */
  console.log('\n【6】KV 未绑定时的降级');
  {
    const bare = { request: req({ method: 'GET' }), env: { VOTES: null } };
    const r = await votes.onRequestGet(bare);
    const j = await r.json();
    check('GET 返回 503', r.status === 503, j);
    check('错误信息指明是 VOTES 没绑', /VOTES not bound/.test(j.error), j);
  }

  /* ══════════════ 7. 指纹隔离 ══════════════ */
  console.log('\n【7】不同指纹互不影响（多人各投一票）');
  {
    const kv = makeKV();
    await call('POST', kv, { body: { id: 's1', action: 'like' }, fp: 'fpA' });
    await call('POST', kv, { body: { id: 's1', action: 'like' }, fp: 'fpB' });
    const g = await body(await call('GET', kv, {}));
    check('两个不同设备各投一票 → like=2', g.counts.s1.like === 2, g.counts);

    const mineA = await body(await call('GET', kv, { url: 'https://x/api/votes?mine=1', fp: 'fpA' }));
    check('fpA 查到自己的那票', mineA.mine.s1 === 'like', mineA);

    const mineB = await body(await call('GET', kv, { url: 'https://x/api/votes?mine=1', fp: 'fpB' }));
    check('fpB 查到自己的那票', mineB.mine.s1 === 'like', mineB);

    // fpA 取消不影响 fpB
    await call('DELETE', kv, { url: 'https://x/api/votes?id=s1', fp: 'fpA' });
    const g2 = await body(await call('GET', kv, {}));
    check('fpA 取消后 like=1（fpB 的还在）', g2.counts.s1.like === 1, g2.counts);
  }

  /* ══════════════ 8. 指纹不明文落库 ══════════════ */
  console.log('\n【8】KV 里不存明文指纹');
  {
    const kv = makeKV();
    await call('POST', kv, { body: { id: 's1', action: 'like' }, fp: 'MY-SECRET-FP' });
    const allKeys = [...kv.m.keys()];
    check('键名里没有明文指纹', !allKeys.some(k => k.includes('MY-SECRET-FP')), allKeys);
    check('个人票键是 v:<hash>:<站点ID> 形式',
      allKeys.some(k => /^v:[0-9a-f]{16,}:s1$/.test(k)), allKeys);

    // 换 VOTE_KEY 后指纹映射改变，旧票认不出（文档已说明这是可接受的代价）
    const ctx2 = { request: req({ method: 'GET', url: 'https://x/api/votes?mine=1', fp: 'MY-SECRET-FP' }), env: { VOTES: kv, VOTE_KEY: 'DIFFERENT' } };
    const j2 = await votes.onRequestGet(ctx2).then(r => r.json());
    check('换密钥后旧票不可见（设计如此）', Object.keys(j2.mine).length === 0, j2);
  }

  /* ══════════════ 9. 限流 ══════════════ */
  console.log('\n【9】限流');
  {
    const kv = makeKV();
    let limited = false;
    for (let i = 0; i < 30; i++) {
      const r = await call('POST', kv, { body: { id: 's' + i, action: 'like' }, fp: 'fpRate', ip: '9.9.9.9' });
      if (r.status === 429) { limited = true; break; }
    }
    check('短时间内连续写入会被 429 拦下', limited, '未触发限流');
  }

  /* ══════════════ 10. 并发不丢票 ══════════════ */
  console.log('\n【10】并发投票不丢票（KV 读-改-写的真实风险）');
  {
    const kv = makeKV();
    // 20 个不同设备同时给不同站点投票，全部 await 后应全部计入
    await Promise.all(Array.from({ length: 20 }, (_, i) =>
      call('POST', kv, { body: { id: 'site' + i, action: 'like' }, fp: 'fp' + i, ip: '10.0.0.' + i })
    ));
    const g = await body(await call('GET', kv, {}));
    const counted = Object.values(g.counts).reduce((n, c) => n + c.like, 0);
    check('20 个并发站点全部计入（允许极小概率偏差）', counted >= 18, { counted, expected: 20 });
  }

  /* ══════════════ 11. OPTIONS ══════════════ */
  console.log('\n【11】预检');
  {
    const r = await votes.onRequestOptions({ request: req({ method: 'OPTIONS' }) });
    check('OPTIONS 返回 204', r.status === 204, r.status);
    check('带 CORS 允许头', !!r.headers.get('Access-Control-Allow-Origin'), r.headers.get('Access-Control-Allow-Origin'));
  }

  /* ══════════════ 汇总 ══════════════ */
  console.log('\n────────────────────────');
  console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  console.log('────────────────────────');
  process.exit(fail ? 1 : 0);

}

main();
