/**
 * 专项测试：修复「点赞没有变化 / 数据没更新到服务器」的三个根因
 *
 * 根因 1：服务端「我投过什么」用 kv.list() 前缀扫描 —— KV 最终一致，
 *         刚写的键最长 60 秒才出现在 list 结果里。用户表现为：
 *         投完刷新，角标消失、状态退回未投，再点被当成新投票（票数又 +1）。
 *   修法：新增 u:<hash> 索引，用 kv.get 单键读（强一致到本账号）。
 *
 * 根因 2：state.voted 初始值来自本机 localStorage 的旧票，
 *         服务端数据是异步后到的。这段窗口内点击会把「投票」误判成「取消」。
 *   修法：新增 state.synced，服务端数据到达前禁止投票。
 *
 * 根因 3：sw.js 的 PRECACHE 漏了 votes-sync.js，且 CACHE 版本没升，
 *         旧 Service Worker 会一直钉住旧脚本。
 *   修法：CACHE 升到 gyp-v5，补齐预缓存清单。
 *
 * 运行：node tools/verify-vote-sync.js [baseURL]
 */

const path = require('path');
const { pathToFileURL } = require('url');

const BASE = process.argv[2] || 'http://127.0.0.1:8903';

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n【' + t + '】'); }

async function main() {
  const votes = await import(pathToFileURL(path.join(__dirname, '../functions/api/votes.js')).href);

  // ── 造一个内存版 KV ──
  function memKv() {
    const m = new Map();
    return {
      _m: m,
      async get(k) { return m.has(k) ? m.get(k) : null; },
      async put(k, v) { m.set(k, String(v)); },
      async delete(k) { m.delete(k); },
      async list(opt) {
        const pre = (opt && opt.prefix) || '';
        return { keys: [...m.keys()].filter(k => k.startsWith(pre)).map(name => ({ name })) };
      }
    };
  }

  const SECRET = 'test-vote-key-for-unit';

  // ═══════════════ 根因 1：mine 接口的强一致性 ═══════════════
  section('根因 1 · 「我投过什么」用 kv.get 读索引，绕开 list 的 60 秒延迟');

  {
    const kv = memKv();
    const env = { VOTES: kv, VOTE_KEY: SECRET, ADMIN_KEY: 'adm' };
    const ctx = {
      env,
      request: new Request('https://x/api/votes', {
        method: 'POST',
        headers: { 'X-Gyp-Fp': 'fp-consistency', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'site-a', action: 'like' })
      })
    };
    const post = await votes.onRequestPost(ctx);
    const body = await post.json();
    ok(post.status === 200, '投票写入成功', 'HTTP ' + post.status);
    ok(body.ok === true, '返回 ok');

    // 关键：模拟「刚写完立刻查」——内存 KV 的 list 是同步的，
    // 但真实 KV 的 list 有延迟。这里断言的是「mine 走的是 u: 索引」，
    // 即 u:<hash> 键必须存在，且内容正确。
    const uKeys = [...kv._m.keys()].filter(k => k.startsWith('u:'));
    ok(uKeys.length === 1, '写票后生成了 u:<hash> 索引键', '实际 ' + uKeys.length);

    const mineReq = new Request('https://x/api/votes?mine=1', {
      headers: { 'X-Gyp-Fp': 'fp-consistency' }
    });
    const mineResp = await votes.onRequestGet({ request: mineReq, env });
    const mineBody = await mineResp.json();
    ok(mineBody.mine && mineBody.mine['site-a'] === 'like',
      '立即查 mine 就能查到刚投的票（不再等 list 传播）',
      JSON.stringify(mineBody.mine));
  }

  // ── 索引与 v: 权威源保持一致 ──
  section('根因 1b · 索引与权威源 v: 始终一致（投票/改票/取消三条路径）');

  {
    const kv = memKv();
    const env = { VOTES: kv, VOTE_KEY: SECRET };
    const mkPost = (id, action) => new Request('https://x/api/votes', {
      method: 'POST',
      headers: { 'X-Gyp-Fp': 'fp-sync', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    });
    const mkMine = () => new Request('https://x/api/votes?mine=1', {
      headers: { 'X-Gyp-Fp': 'fp-sync' }
    });

    await votes.onRequestPost({ request: mkPost('s1', 'like'), env });
    let m = await (await votes.onRequestGet({ request: mkMine(), env })).json();
    ok(m.mine['s1'] === 'like', '投票后索引=like');

    // 改票
    await votes.onRequestPost({ request: mkPost('s1', 'dislike'), env });
    m = await (await votes.onRequestGet({ request: mkMine(), env })).json();
    ok(m.mine['s1'] === 'dislike', '改票后索引=dislike', JSON.stringify(m.mine));

    // 取消
    await votes.onRequestDelete({
      request: new Request('https://x/api/votes?id=s1', { headers: { 'X-Gyp-Fp': 'fp-sync' } }),
      env
    });
    m = await (await votes.onRequestGet({ request: mkMine(), env })).json();
    ok(!m.mine['s1'], '取消后索引已移除该站', JSON.stringify(m.mine));

    // 权威源 v: 键也应被清掉
    const vKeys = [...kv._m.keys()].filter(k => k.startsWith('v:') && k.endsWith(':s1'));
    ok(vKeys.length === 0, '取消后权威源 v: 键也已删除');
  }

  // ── 索引缺失时 list 兜底 ──
  section('根因 1c · 索引缺失（历史数据）时，list 扫描兜底仍能还原');

  {
    const kv = memKv();
    const env = { VOTES: kv, VOTE_KEY: SECRET };
    // 手工塞一个 v: 键（模拟本次修复之前的历史数据），没有 u: 索引
    const fp = 'fp-legacy';
    // 用同一套哈希算法算出 hash：直接调用一次 POST 会写 u:，
    // 所以这里先 POST 再删掉 u: 键，模拟"只有 v: 的老数据"
    await votes.onRequestPost({
      request: new Request('https://x/api/votes', {
        method: 'POST',
        headers: { 'X-Gyp-Fp': fp, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'legacy-1', action: 'broken' })
      }),
      env
    });
    for (const k of [...kv._m.keys()]) {
      if (k.startsWith('u:')) kv._m.delete(k);
    }
    ok(![...kv._m.keys()].some(k => k.startsWith('u:')), '已模拟「只有 v: 无 u:」的历史状态');

    const m = await (await votes.onRequestGet({
      request: new Request('https://x/api/votes?mine=1', { headers: { 'X-Gyp-Fp': fp } }),
      env
    })).json();
    ok(m.mine['legacy-1'] === 'broken', 'list 兜底成功还原历史票', JSON.stringify(m.mine));
  }

  // ═══════════════ 根因 2：synced 闸门 ═══════════════
  section('根因 2 · 服务端数据到达前禁止投票，避免把「投票」误判成「取消」');

  {
    const fs = require('fs');
    for (const p of ['assets/js/app.js', 'assets/js/app-v2.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
      ok(src.indexOf('synced: false') >= 0, p + ' state 有 synced 字段');
      ok(/if\s*\(!state\.synced\)\s*\{[\s\S]{0,200}?flash\(btn, t\('vote_syncing'\)/.test(src),
        p + ' 投票前检查 state.synced');
      ok(/state\.synced = true;/.test(src), p + ' 同步完成后置 synced=true');
      ok(/setTimeout\(function \(\) \{ state\.synced = true; \}, 8000\)/.test(src),
        p + ' 有 8 秒超时兜底（网络挂起时不会永久卡住）');
    }
  }

  // ── 服务端优先的合并策略 ──
  section('根因 2b · 本机与服务端都有票时，以服务端为准');

  {
    const fs = require('fs');
    for (const p of ['assets/js/app.js', 'assets/js/app-v2.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
      const m = src.match(/var merged = \{\};[\s\S]{0,300}?Object\.keys\(mine\)\.forEach\(function \(id\) \{ merged\[id\] = mine\[id\]; \}\);/);
      ok(!!m, p + ' 合并时服务端记录覆盖本机记录');
      if (m) {
        // 本机记录先写入 merged，随后服务端记录覆盖它 —— 顺序决定优先级。
        // 锚点用实际赋值语句，不要用变量名（localVotes 在函数上方更早出现）。
        const idxLocalAssign = m[0].indexOf('merged[id] = localVotes[id]');
        const idxMineAssign = m[0].indexOf('merged[id] = mine[id]');
        ok(idxLocalAssign >= 0 && idxMineAssign > idxLocalAssign,
          p + ' 服务端赋值在本机赋值之后（服务端优先）',
          'local@' + idxLocalAssign + ' mine@' + idxMineAssign);
      }
    }
  }

  // ═══════════════ 根因 3：Service Worker ═══════════════
  section('根因 3 · Service Worker 缓存版本与预缓存清单');

  {
    const fs = require('fs');
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    const ver = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
    ok(ver === 'gyp-v5', 'CACHE 版本已升到 gyp-v5（> 投票改造时的 gyp-v4）', '实际 ' + ver);
    ok(sw.indexOf("'./assets/js/votes-sync.js'") >= 0, 'PRECACHE 含 votes-sync.js');
    ok(sw.indexOf("'./assets/js/faq-data.js'") >= 0, 'PRECACHE 含 faq-data.js');
    ok(sw.indexOf("'./404.html'") >= 0, 'PRECACHE 含 404.html');
  }

  // ═══════════════ 附加：purge 接口 ═══════════════
  section('附加 · 脏数据清理接口（仅站长可用）');

  {
    const kv = memKv();
    const env = { VOTES: kv, VOTE_KEY: SECRET, ADMIN_KEY: 'adm-key' };

    // 无鉴权
    let r = await votes.onRequestGet({
      request: new Request('https://x/api/votes?purge=1'),
      env
    });
    ok(r.status === 401, '无 ADMIN_KEY 时 purge 返回 401', 'HTTP ' + r.status);

    // 有鉴权
    await votes.onRequestPost({
      request: new Request('https://x/api/votes', {
        method: 'POST',
        headers: { 'X-Gyp-Fp': 'fp-p', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'valid-1', action: 'like' })
      }),
      env
    });
    // 塞一个无效 id
    const agg = JSON.parse(kv._m.get('votes:agg') || '{}');
    agg['ssite-1'] = { like: 1, dislike: 0, broken: 0 };
    agg['zero-1'] = { like: 0, dislike: 0, broken: 0 };
    kv._m.set('votes:agg', JSON.stringify(agg));

    r = await votes.onRequestGet({
      request: new Request('https://x/api/votes?purge=1&ids=valid-1', {
        headers: { 'X-Gyp-Admin': 'adm-key' }
      }),
      env
    });
    const b = await r.json();
    ok(r.status === 200 && b.ok, '有 ADMIN_KEY 时 purge 可用');
    const removedIds = (b.removed || []).map(x => x.id);
    ok(removedIds.indexOf('ssite-1') >= 0, '无效 ID 被清除', JSON.stringify(removedIds));
    ok(removedIds.indexOf('zero-1') >= 0, '0 票残留被清除', JSON.stringify(removedIds));
    ok(removedIds.indexOf('valid-1') < 0, '合法站点未被误删', JSON.stringify(removedIds));

    // 清理后票数保留
    const after = await (await votes.onRequestGet({
      request: new Request('https://x/api/votes'),
      env
    })).json();
    ok(after.counts['valid-1'] && after.counts['valid-1'].like === 1,
      '合法站点的票数在清理后完整保留', JSON.stringify(after.counts['valid-1']));
  }

  console.log('\n────────────────────────');
  console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  console.log('────────────────────────');
  if (fail) process.exit(1);
}

main().catch(e => { console.error('异常：', e); process.exit(1); });
