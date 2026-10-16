/**
 * 机械制造分类专项可达性检查：对新收录的强企官网逐一发请求。
 * 403/405 = 反爬拦截（正常），只有 DNS 解析失败才是确凿坏数据。
 */
const https = require('https');
const dns = require('dns').promises;

global.window = {};
require('../assets/js/data.js');
const sites = global.window.SITE_DATA.filter(s => s.category === 'machinery');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

function head(url) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ code: 'BAD_URL' }); }
    dns.resolve(u.hostname)
      .then(addrs => {
        if (!addrs || !addrs.length) return resolve({ code: 'DNS_EMPTY' });
        const req = https.request({
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'HEAD',
          headers: { 'User-Agent': UA },
          timeout: 12000
        }, res => {
          res.resume();
          resolve({ code: String(res.statusCode) });
        });
        req.on('error', err => resolve({ code: 'ERR:' + err.code }));
        req.on('timeout', () => { req.destroy(); resolve({ code: 'TIMEOUT' }); });
        req.end();
      })
      .catch(err => resolve({ code: 'DNS_FAIL:' + err.code }));
  });
}

(async () => {
  console.log('机械制造分类共 ' + sites.length + ' 家，逐一检查…\n');
  let dnsFail = 0;
  for (const s of sites) {
    const r = await head(s.url);
    const bad = r.code.startsWith('DNS_FAIL') || r.code.startsWith('DNS_EMPTY') || r.code === 'BAD_URL';
    if (bad) dnsFail++;
    console.log((bad ? '✗ ' : '✓ ') + r.code.padEnd(10) + s.name + '  ' + s.url);
  }
  console.log('\nDNS 失败: ' + dnsFail + ' / ' + sites.length);
  process.exit(dnsFail ? 1 : 0);
})();
