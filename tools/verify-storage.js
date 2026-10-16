/**
 * Vault 加密存储层专项测试（Node 直跑，无需浏览器）
 * 用法：node tools/verify-storage.js
 */
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../assets/js/vault.js'), 'utf8'));
const Vault = global.window.Vault;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const sample = { 'google-0': { like: 3, dislike: 1, broken: 0 }, 'baidu-16': { like: 10, dislike: 0, broken: 2 } };

/* 1. 加解密往返 */
const sealed = Vault.seal(sample);
t('seal 返回非空字符串', typeof sealed === 'string' && sealed.length > 0);
t('密文不含明文关键词 like / site id', sealed.indexOf('like') === -1 && sealed.indexOf('google') === -1);
const opened = Vault.open(sealed);
t('open 还原出相同对象', JSON.stringify(opened) === JSON.stringify(sample));

/* 2. 篡改检测：翻转密文里一个字符 */
const tampered = sealed.slice(0, 5) + (sealed[5] === 'A' ? 'B' : 'A') + sealed.slice(6);
t('密文被手改一个字符 → 校验拒绝（null）', Vault.open(tampered) === null);

/* 3. 伪造明文 JSON 直接塞进来 → 无法通过 */
t('伪造明文 {"like":999} → 拒绝', Vault.open('{"google-0":{"like":999}}') === null);

/* 4. 旧格式数据重签后注入 → 校验失败 */
const forged = Vault.seal({ 'google-0': { like: 999, dislike: 0, broken: 0 } }).slice(0, -2) + 'xx';
t('合法密文尾部篡改 → 拒绝', Vault.open(forged) === null);

/* 5. 空对象 / 空串 / 垃圾输入 */
t('空对象往返', JSON.stringify(Vault.open(Vault.seal({}))) === '{}');
t('空串 → null（不抛错）', Vault.open('') === null);
t('随机垃圾 → null（不抛错）', Vault.open('ゴミ<input>') === null);

/* 6. 模拟真实存取循环：存 → 读 → 存 → 读 */
const store = {};
const fakeLS = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; }
};
fakeLS.setItem('gyp:counts:', Vault.seal(sample));
const back = Vault.open(fakeLS.getItem('gyp:counts:'));
t('localStorage 模拟循环：数据一致', JSON.stringify(back) === JSON.stringify(sample));
t('localStorage 里的原始值为密文', store['gyp:counts:'].indexOf('like') === -1);

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
