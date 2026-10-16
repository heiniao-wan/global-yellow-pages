/**
 * POST /api/feedback — 留言入库（Cloudflare Pages Functions + KV）
 *
 * 部署要求（见 DEPLOY-GUIDE.md 附录 F）：
 *   1. KV 命名空间绑定名：MESSAGES
 *   2. 环境变量：无需（本接口公开提交；读取走 /api/messages + ADMIN_KEY）
 *
 * 防护：字段长度截断 / 服务端格式校验 / 同 IP 每分钟 1 条（KV 计数，2 分钟自动过期）
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (code, obj) => new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

  const kv = env.MESSAGES;
  if (!kv) return json(503, { ok: false, error: 'KV not bound' });

  let d;
  try { d = await request.json(); } catch (e) { return json(400, { ok: false, error: 'bad json' }); }

  const site  = String(d.site || '').trim().slice(0, 120);
  const cat   = String(d.cat || '').trim().slice(0, 40);
  const msg   = String(d.msg || '').trim().slice(0, 2000);
  const phone = String(d.phone || '').trim().slice(0, 30);
  const email = String(d.email || '').trim().slice(0, 80);

  // 与前端同规则的服务端校验，防止绕过表单直接 POST
  if (!site) return json(400, { ok: false, error: 'site required' });
  if (!phone && !email) return json(400, { ok: false, error: 'contact required' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { ok: false, error: 'bad email' });
  if (phone && !/^[+\d][\d\s\-()]{5,19}$/.test(phone)) return json(400, { ok: false, error: 'bad phone' });

  // 限流：同一 IP 一分钟内只收一条（rl: 键带 TTL 自动过期）
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + ip;
  let last = null;
  try { last = await kv.get(rlKey); } catch (e) { /* KV 抖动不阻断入库 */ }
  if (last && Date.now() - Number(last) < 60000) return json(429, { ok: false, error: 'rate limited' });

  const record = {
    id: 'fb:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    ts: Date.now(),
    ip: ip,
    ua: String(request.headers.get('User-Agent') || '').slice(0, 200),
    site: site, cat: cat, msg: msg, phone: phone, email: email
  };
  await kv.put(record.id, JSON.stringify(record));
  await kv.put(rlKey, String(Date.now()), { expirationTtl: 120 });

  return json(200, { ok: true, id: record.id });
}
