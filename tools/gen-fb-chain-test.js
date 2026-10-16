/**
 * 一次性脚本：反馈三级降级链 E2E（本地无 Functions → 应回退 mailto）
 * 用法：node tools/gen-fb-chain-test.js
 */
const fs = require('fs');
const path = require('path');

const inj = `<script>setTimeout(function(){try{
  var F=function(id){return document.getElementById(id)};
  var res=[];
  // 合法表单 → POST /api/feedback（本地 404）→ 应自动降级 mailto 成功态
  F("fbSite").value="example.com";
  F("fbEmail").value="test@163.com";
  F("fbMsg").value="值得收录";
  F("fbForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  res.push("SENDING:"+(F("fbStatus").hidden?"NOSTATUS":F("fbStatus").textContent.slice(0,10)));
  setTimeout(function(){
    res.push("FALLBACK:"+(F("fbStatus").hidden?"NOSTATUS":F("fbStatus").className+":"+F("fbStatus").textContent.slice(0,14)));
    res.push("RESET:"+(F("fbSite").value===""?"YES":"NO"));
    var d=document.createElement("div");d.id="fbchain";d.textContent=res.join(" | ");document.body.appendChild(d);
  },1500);
}catch(e){var d2=document.createElement("div");d2.id="fbchain";d2.textContent="ERR["+e.message+"]";document.body.appendChild(d2);}},3500);</script>`;

['index.html', 'index-v2.html'].forEach(function (page) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8').replace('</body>', inj + '</body>');
  const out = page === 'index.html' ? 'fb-chain-test.html' : 'fb-chain-test-v2.html';
  fs.writeFileSync(path.join(__dirname, '..', out), html);
  console.log(out + ' 已生成');
});
