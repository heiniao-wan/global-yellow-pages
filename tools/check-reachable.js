/**
 * 抽样可达性检查：随机抽 N 个站点，实际发 HTTP 请求看是否存活。
 * 用途：抓出拼错的域名与已停止运营的站点。
 * 注意：部分站点会拒绝非浏览器 UA 或屏蔽数据中心 IP，403/405 不等于域名不存在。
 *       只有 DNS 解析失败（ENOTFOUND / 解析错误）才是确凿的坏数据。
 */
const https = require('https');
const http = require('http');
const dns = require('dns').promises;

const SAMPLE = Number(process.argv[2] || 30);

global.window = {};
require('../assets/js/data.js');
const sites = global.window.SITE_DATA;

// 固定种子随机，保证每次抽样结果可复现
let s = 12345;
function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
const pool = sites.slice();
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const targets = pool.slice(0, SAMPLE);

function head(url, redirects) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ code: 'BAD_URL' }); }
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request({
      hostname: u.hostname,
      path: u.pathname || '/',
      method: 'HEAD',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      rejectUnauthorized: false
    }, res => {
      res.resume();
      // 跟随重定向，最多 3 跳
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location && redirects < 3) {
        return resolve(head(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      resolve({ code: res.statusCode });
    });
    req.on('error', e => resolve({ code: e.code || e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ code: 'TIMEOUT' }); });
    req.end();
  });
}

(async function () {
  console.log('抽样 ' + targets.length + ' / ' + sites.length + ' 个站点检查可达性…\n');
  const bad = [];
  let ok = 0, blocked = 0;

  const batch = 10;
  for (let i = 0; i < targets.length; i += batch) {
    const chunk = targets.slice(i, i + batch);
    const results = await Promise.all(chunk.map(async site => {
      const r = await head(site.url, 0);
      return { site, r };
    }));
    for (const { site, r } of results) {
      const c = r.code;
      if (typeof c === 'number' && c < 400) {
        ok++;
        console.log('  [ok ' + String(c).padStart(3) + '] ' + site.domain.padEnd(28) + site.name);
      } else if (c === 'ENOTFOUND' || c === 'EAI_AGAIN' || c === 'BAD_URL') {
        bad.push(site.domain + ' (' + c + ')  ' + site.name);
        console.log('  [!! DNS] ' + site.domain.padEnd(28) + site.name);
      } else {
        blocked++;
        console.log('  [-- ' + String(c).padEnd(3) + '] ' + site.domain.padEnd(28) + site.name);
      }
    }
  }

  console.log('\n存活 ' + ok + ' · 反爬/拒绝 ' + blocked + ' · DNS失败 ' + bad.length);
  if (bad.length) {
    console.log('\n确认为坏数据的域名：');
    bad.forEach(b => console.log('  - ' + b));
    process.exit(1);
  }
  console.log('\n==> 抽样范围内无坏域名');
})();