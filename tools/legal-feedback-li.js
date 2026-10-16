/**
 * 一次性脚本：legal.html 隐私政策补充反馈表单数据披露
 * 用法：node tools/legal-feedback-li.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../legal.html');
let h = fs.readFileSync(file, 'utf8');

const zhLi = '        <li>如果你通过「网站反馈」表单提交推荐，你主动填写的联系方式（电话或邮箱）与反馈内容——这些信息将<b>通过邮件发送至站长邮箱</b>用于核实与回复，不会用于其他用途；</li>';
const enLi = '        <li>If you submit a suggestion via the "Website Feedback" form, the contact details (phone or email) and content you provide — these are <b>emailed to the site operator\u2019s inbox</b> for verification and reply only, and will not be used otherwise;</li>';

const zhAnchor = '        <li>界面偏好（明暗主题、界面语言）。</li>';
const enAnchor = '        <li>Interface preferences (theme, language).</li>';

if (h.indexOf(zhAnchor) === -1) { console.error('zh 锚点未找到'); process.exit(1); }
if (h.indexOf(enAnchor) === -1) { console.error('en 锚点未找到'); process.exit(1); }
if (h.indexOf('网站反馈') !== -1 && h.indexOf(zhLi) !== -1) { console.log('已插入过，跳过'); process.exit(0); }

h = h.replace(zhAnchor, zhAnchor + '\n' + zhLi).replace(enAnchor, enAnchor + '\n' + enLi);
fs.writeFileSync(file, h);
console.log('legal.html 隐私政策已更新');
