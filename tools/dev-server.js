/**
 * 本地开发服务器：静态站点 + 真实运行 Cloudflare Pages Functions（/api/*）
 * 用途：上线前在本地完整体验「留言提交 → admin 后台查看/删除」全流程。
 *       线上仍由 Cloudflare Pages 自动运行 functions/ 目录，本文件仅本地使用。
 *
 * 用法：node tools/dev-server.js
 *   - 站点：http://127.0.0.1:8901/
 *   - 后台：http://127.0.0.1:8901/admin.html
 *   - 本地密钥：gyp-admin-dev-2026（可用环境变量 ADMIN_KEY 覆盖）
 *   - 留言数据落在 .local-kv.json（已加入 .gitignore，不会提交）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8901);
const ADMIN_KEY = process.env.ADMIN_KEY || 'gyp-admin-dev-2026';
const KV_FILE = path.join(ROOT, '.local-kv.json');
const VOTES_FILE = path.join(ROOT, '.local-votes.json');

/* ── 文件版 KV：模拟 Cloudflare KV 的最小接口 ── */
const kv = {
  _load() {
    try { return JSON.parse(fs.readFileSync(KV_FILE, 'utf8')); }
    catch (e) { return {}; }
  },
  _save(map) { fs.writeFileSync(KV_FILE, JSON.stringify(map, null, 2)); },
  async get(k) { const m = this._load(); return k in m ? m[k] : null; },
  async put(k, v, opt) { const m = this._load(); m[k] = String(v); this._save(m); },
  async delete(k) { const m = this._load(); delete m[k]; this._save(m); },
  async list(opt) {
    const o = opt || {};
    const keys = Object.keys(this._load())
      .filter((k) => k.startsWith(o.prefix || ''))
      .slice(0, o.limit || 1000);
    return { keys: keys.map((name) => ({ name })) };
  }
};
// VOTES 用独立命名空间，与留言数据互不干扰（生产环境也是两个 KV）
const votesKv = {
  _load() {
    try { return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8')); }
    catch (e) { return {}; }
  },
  _save(map) { fs.writeFileSync(VOTES_FILE, JSON.stringify(map, null, 2)); },
  async get(k) { const m = this._load(); return k in m ? m[k] : null; },
  async put(k, v) { const m = this._load(); m[k] = String(v); this._save(m); },
  async delete(k) { const m = this._load(); delete m[k]; this._save(m); },
  async list(opt) {
    const o = opt || {};
    const keys = Object.keys(this._load())
      .filter((k) => k.startsWith(o.prefix || ''))
      .slice(0, o.limit || 1000);
    return { keys: keys.map((name) => ({ name })) };
  }
};

const env = {
  MESSAGES: kv,
  VOTES: votesKv,
  ADMIN_KEY: ADMIN_KEY,
  // 本地固定值，仅用于让「换设备仍能找回自己的票」这条路径可测；
  // 生产环境请在 Cloudflare 配同名 Secret
  VOTE_KEY: process.env.VOTE_KEY || 'gyp-local-vote-key-dev'
};

/* ── MIME 表 ── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

function toRequest(req, bodyBuf) {
  const full = 'http://127.0.0.1:' + PORT + req.url;
  const headers = { 'CF-Connecting-IP': req.socket.remoteAddress || '127.0.0.1' };
  Object.keys(req.headers).forEach((h) => { headers[h] = req.headers[h]; });
  return new Request(full, {
    method: req.method,
    headers: headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : bodyBuf
  });
}

function sendJson(res, resp) {
  res.writeHead(resp.status, { 'Content-Type': 'application/json; charset=utf-8' });
  resp.text().then((t) => res.end(t));
}

async function main() {
  // Functions 是 ESM，动态加载
  const feedback = await import(pathToFileURL(path.join(ROOT, 'functions/api/feedback.js')).href);
  const messages = await import(pathToFileURL(path.join(ROOT, 'functions/api/messages.js')).href);
  const votes = await import(pathToFileURL(path.join(ROOT, 'functions/api/votes.js')).href);

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;

    // 收集请求体后交给对应 Function
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try {
        if (pathname === '/api/feedback' && req.method === 'POST') {
          const resp = await feedback.onRequestPost({ request: toRequest(req, Buffer.concat(chunks)), env });
          return sendJson(res, resp);
        }
        if (pathname === '/api/messages' && req.method === 'GET') {
          const resp = await messages.onRequestGet({ request: toRequest(req), env });
          return sendJson(res, resp);
        }
        if (pathname === '/api/messages' && req.method === 'DELETE') {
          const resp = await messages.onRequestDelete({ request: toRequest(req), env });
          return sendJson(res, resp);
        }
        if (pathname === '/api/votes' && req.method === 'GET') {
          const resp = await votes.onRequestGet({ request: toRequest(req), env });
          return sendJson(res, resp);
        }
        if (pathname === '/api/votes' && req.method === 'POST') {
          const resp = await votes.onRequestPost({ request: toRequest(req, Buffer.concat(chunks)), env });
          return sendJson(res, resp);
        }
        if (pathname === '/api/votes' && req.method === 'DELETE') {
          const resp = await votes.onRequestDelete({ request: toRequest(req), env });
          return sendJson(res, resp);
        }
        if (pathname.startsWith('/api/')) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'no route' }));
        }
        serveStatic(req, res, pathname);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('dev-server error: ' + e.message);
      }
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log('✅ 本地开发服务器已启动');
    console.log('   站点：http://127.0.0.1:' + PORT + '/');
    console.log('   后台：http://127.0.0.1:' + PORT + '/admin.html');
    console.log('   密钥：' + ADMIN_KEY);
    console.log('   留言数据：' + KV_FILE);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
