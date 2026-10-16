global.window = {};
require('../assets/js/data.js');
const d = global.window.SITE_DATA, c = global.window.SITE_CATEGORIES;

const fail = [];
const say = [];
function check(name, badList) {
  if (badList.length === 0) { say.push('  OK  ' + name); }
  else { fail.push(name + ' (' + badList.length + ')'); say.push('  !!  ' + name + ' -> ' + badList.slice(0, 8).join(' | ')); }
}

console.log('站点总数: ' + d.length + '  分类总数: ' + c.length);

const keys = new Set(c.map(x => x.key));
check('分类归属错误', d.filter(s => !keys.has(s.category)).map(s => s.name + '@' + s.category));

const seen = new Set(), dup = [];
d.forEach(s => { if (seen.has(s.domain)) dup.push(s.domain + ' <- ' + s.name); seen.add(s.domain); });
check('重复域名', dup);

const u = s => { try { return new URL(s.url); } catch (e) { return null; } };
check('URL 格式异常', d.filter(s => !u(s) || u(s).protocol !== 'https:' || s.url !== s.url.trim() || s.url.endsWith('/')).map(s => s.url));
check('域名含路径', d.filter(s => u(s) && u(s).pathname !== '/' && u(s).pathname !== '').map(s => s.url));
check('简介过短', d.filter(s => !s.desc || s.desc.length < 10).map(s => s.name));
check('缺字段', d.filter(s => !s.name || !s.category || !s.desc || !s.region || !s.lang).map(s => s.id));

const tally = k => { const o = {}; d.forEach(s => o[s[k]] = (o[s[k]] || 0) + 1); return o; };
console.log('地区分布:', JSON.stringify(tally('region')));
console.log('语言分布:', JSON.stringify(tally('lang')));

const cn = c.filter(x => d.filter(s => s.category === x.key).length < 12);
check('分类站点过少', cn.map(x => x.key + '=' + d.filter(s => s.category === x.key).length));
check('分类缺少站点', c.filter(x => !d.some(s => s.category === x.key)).map(x => x.key));

// ID 唯一性
const idSeen = new Set(), idDup = [];
d.forEach(s => { if (idSeen.has(s.id)) idDup.push(s.id); idSeen.add(s.id); });
check('ID 重复', idDup);

console.log('\n' + say.join('\n'));
console.log('\n每分类: ' + c.map(x => x.key + '=' + d.filter(s => s.category === x.key).length).join('  '));
console.log(fail.length === 0 ? '\n==> 全部校验通过' : '\n==> 失败项: ' + fail.join(', '));