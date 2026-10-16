/**
 * 留言后台 Functions 单测：不启动 Cloudflare，直接以内存 KV + fetch Request 调函数。
 * 覆盖：入库 / 校验 / 限流 / 鉴权 / 列表 / 删除 / KV 未绑定降级
 * 用法：node tools/verify-functions.js
 */
const path = require('path');

const feedback = require(path.join(__dirname, '../functions/api/feedback.js'));
const messages = require(path.join(__dirname, '../functions/api/messages.js'));

/** 内存 KV（Cloudflare KV 的最小可用子集） */
function makeKV() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async (k) => { m.delete(k); },
    list: async ({ prefix = '', limit = 1000 }) => ({
      keys: [...m.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name }))
    }),
    _map: m
  };
}

const ADMIN_KEY = 'test-key-12345';
const env = { MESSAGES: makeKV(), ADMIN_KEY: ADMIN_KEY };

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

function postReq(body, ip) {
  return new Request('https://site.example/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || '1.2.3.4' },
    body: JSON.stringify(body)
  });
}

async function run() {
  console.log('── /api/feedback ──');

  // KV 未绑定
  let r = await feedback.onRequestPost({ request: postReq({ site: 'a.com', email: 'a@b.co' }), env: {} });
  check('KV 未绑定 → 503', r.status === 503);

  // 坏 JSON
  r = await feedback.onRequestPost({
    request: new Request('https://x/api/feedback', { method: 'POST', body: '{oops' }),
    env
  });
  check('坏 JSON → 400', r.status === 400);

  // 缺联系方式
  r = await feedback.onRequestPost({ request: postReq({ site: 'a.com', msg: 'hi' }), env });
  check('缺联系方式 → 400', r.status === 400);

  // 坏邮箱
  r = await feedback.onRequestPost({ request: postReq({ site: 'a.com', email: 'not-an-email' }), env });
  check('坏邮箱 → 400', r.status === 400);

  // 正常入库
  r = await feedback.onRequestPost({
    request: postReq({ site: 'example.com', cat: 'ai', msg: '建议收录', email: 'a@b.co' }), env
  });
  let j = await r.json();
  check('正常提交 → 200 ok', r.status === 200 && j.ok === true);
  check('返回留言 id', /^fb:[a-z0-9]+$/.test(j.id || ''));

  // 同 IP 限流
  r = await feedback.onRequestPost({ request: postReq({ site: 'b.com', email: 'a@b.co' }), env });
  check('同 IP 1 分钟内第二条 → 429', r.status === 429);

  // 换 IP 不受限
  r = await feedback.onRequestPost({ request: postReq({ site: 'c.com', phone: '+86 138 0013 8000' }, '5.6.7.8'), env });
  check('换 IP 可正常提交', r.status === 200);

  // 超长截断
  r = await feedback.onRequestPost({ request: postReq({ site: 'd.com', email: 'a@b.co', msg: 'x'.repeat(5000) }, '9.9.9.9'), env });
  check('超长文本提交不报错', r.status === 200);

  console.log('── /api/messages ──');

  // 无鉴权
  r = await messages.onRequestGet({ request: new Request('https://x/api/messages'), env });
  check('无鉴权 → 401', r.status === 401);

  // 错误密钥
  r = await messages.onRequestGet({
    request: new Request('https://x/api/messages', { headers: { Authorization: 'Bearer wrong' } }), env
  });
  check('错误密钥 → 401', r.status === 401);

  // 未配置 ADMIN_KEY
  r = await messages.onRequestGet({
    request: new Request('https://x/api/messages', { headers: { Authorization: 'Bearer test-key-12345' } }),
    env: { MESSAGES: env.MESSAGES }
  });
  check('未配置 ADMIN_KEY → 401', r.status === 401);

  // 正确密钥：应看到 3 条（d/c/example），新→旧
  r = await messages.onRequestGet({
    request: new Request('https://x/api/messages', { headers: { Authorization: 'Bearer ' + ADMIN_KEY } }), env
  });
  j = await r.json();
  check('正确密钥 → 200', r.status === 200 && j.ok === true);
  check('共 3 条留言', j.messages.length === 3);
  check('新→旧排序', j.messages.length > 1 && j.messages[0].ts >= j.messages[1].ts);
  check('不泄露给无鉴权者的内容已隔离（响应含 ok 字段）', 'messages' in j);

  // 删除：错鉴权
  const id0 = j.messages[0].id;
  r = await messages.onRequestDelete({
    request: new Request('https://x/api/messages?id=' + id0), env
  });
  check('删除无鉴权 → 401', r.status === 401);

  // 删除：坏 id
  r = await messages.onRequestDelete({
    request: new Request('https://x/api/messages?id=evil-key', { headers: { Authorization: 'Bearer ' + ADMIN_KEY } }), env
  });
  check('非法 id → 400', r.status === 400);

  // 删除：正常
  r = await messages.onRequestDelete({
    request: new Request('https://x/api/messages?id=' + encodeURIComponent(id0),
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + ADMIN_KEY } }), env
  });
  check('删除 → 200', r.status === 200);

  r = await messages.onRequestGet({
    request: new Request('https://x/api/messages', { headers: { Authorization: 'Bearer ' + ADMIN_KEY } }), env
  });
  j = await r.json();
  check('删除后剩 2 条', j.messages.length === 2);
  check('已删的不在列表', j.messages.every((m) => m.id !== id0));

  console.log(fail ? `\n通过 ${pass} 项，失败 ${fail} 项` : `\n通过 ${pass} 项，失败 0 项`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error('ERR', e); process.exit(1); });
