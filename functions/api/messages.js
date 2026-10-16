/**
 * GET    /api/messages?id 可省 — 管理员拉取留言（新→旧，最多 100 条）
 * DELETE /api/messages?id=fb:xxx — 管理员删除单条留言
 *
 * 鉴权：请求头 Authorization: Bearer <ADMIN_KEY>（环境变量，见 DEPLOY-GUIDE.md 附录 F）
 * 只有管理员持有 ADMIN_KEY；留言内容对公众完全不可见。
 */
const json = (code, obj) => new Response(JSON.stringify(obj), {
  status: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

/** 恒定时间字符串比较，避免计时侧信道 */
function safeEqual(a, b) {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function authed(request, env) {
  const key = String(env.ADMIN_KEY || '');
  if (!key) return false; // 未配置 ADMIN_KEY 时一律拒绝，避免裸奔
  const h = String(request.headers.get('Authorization') || '');
  return safeEqual(h, 'Bearer ' + key);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json(401, { ok: false, error: 'unauthorized' });

  const kv = env.MESSAGES;
  if (!kv) return json(503, { ok: false, error: 'KV not bound' });

  const list = await kv.list({ prefix: 'fb:', limit: 100 });
  const out = [];
  for (const k of list.keys) {
    try {
      const rec = JSON.parse(await kv.get(k.name));
      if (rec && rec.id) out.push(rec);
    } catch (e) { /* 单条损坏不影响整体 */ }
  }
  out.sort((a, b) => b.ts - a.ts);
  return json(200, { ok: true, messages: out });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json(401, { ok: false, error: 'unauthorized' });

  const kv = env.MESSAGES;
  if (!kv) return json(503, { ok: false, error: 'KV not bound' });

  const id = context.request.url.split('id=')[1] || '';
  if (!/^fb:[a-z0-9]+$/.test(decodeURIComponent(id))) return json(400, { ok: false, error: 'bad id' });
  await kv.delete(decodeURIComponent(id));
  return json(200, { ok: true });
}
