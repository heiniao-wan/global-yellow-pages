/**
 * 一次性脚本：生成反馈表单测试页（浏览器 E2E 用）
 * 用法：node tools/gen-fb-test.js
 */
const fs = require('fs');
const path = require('path');

const inj = `<script>window.addEventListener("load",function(){setTimeout(function(){try{
  var F=function(id){return document.getElementById(id)};
  var res=[];
  // P1: 空表单直接提交 → 站点错误
  F("fbForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  res.push("P1:"+(F("fbErr").hidden?"NOERR":F("fbErr").textContent.slice(0,20)));
  // P2: 填站点、联系方式全空 → 联系方式错误
  F("fbSite").value="example.com";
  F("fbForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  res.push("P2:"+(F("fbErr").hidden?"NOERR":F("fbErr").textContent.slice(0,24)));
  // P3: 邮箱格式错误
  F("fbEmail").value="bad-email";
  F("fbForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  res.push("P3:"+(F("fbErr").hidden?"NOERR":F("fbErr").textContent.slice(0,24)));
  // P4: 电话格式错误
  F("fbEmail").value="";F("fbPhone").value="12";
  F("fbForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  res.push("P4:"+(F("fbErr").hidden?"NOERR":F("fbErr").textContent.slice(0,24)));
  // P5: 全部合法 → mailto 成功态 + 表单重置
  F("fbPhone").value="";F("fbEmail").value="test@163.com";F("fbMsg").value="值得收录";
  F("fbForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  res.push("P5:"+(F("fbStatus").hidden?"NOSTATUS":F("fbStatus").textContent.slice(0,22)));
  res.push("RESET:"+(F("fbSite").value===""?"YES":"NO"));
  res.push("CATS:"+F("fbCat").options.length);
  var d=document.createElement("div");d.id="fbtest";d.textContent=res.join(" | ");document.body.appendChild(d);
}catch(e){var d2=document.createElement("div");d2.id="fbtest";d2.textContent="ERR["+e.message+"]";document.body.appendChild(d2);}},1500);});</script>`;

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').replace('</body>', inj + '</body>');
fs.writeFileSync(path.join(__dirname, '../fb-test.html'), html);
console.log('fb-test.html 已生成');
