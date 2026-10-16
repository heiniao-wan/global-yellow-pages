/**
 * 一次性脚本：生成亮点功能测试页（浏览器 E2E）
 * 覆盖：星标收藏 / 收藏筛选 / 无法访问投票 / 问题站点筛选 / 手气不错 / 加密存储
 * 用法：node tools/gen-features-test.js
 */
const fs = require('fs');
const path = require('path');

const inj = `<script>setTimeout(function(){try{
  var F=function(id){return document.getElementById(id)};
  var Q=function(s){return document.querySelector(s)};
  var QA=function(s){return document.querySelectorAll(s)};
  var res=[];

  // 1. 点第一张卡的星标
  var star=Q(".fav-star");
  star.click();
  res.push("STAR:"+(star.className.indexOf("on")>=0?"ON":"OFF"));
  var chip=Q('.cat-chip[data-cat="__fav__"] .cat-count');
  res.push("CHIP:"+(chip?chip.textContent:"?"));

  // 2. 切到「我的收藏」→ 应只剩 1 张卡
  Q('.cat-chip[data-cat="__fav__"]').click();
  res.push("FAVGRID:"+QA(".site-card").length);

  // 3. 回到全部，给第二张卡投「无法访问」
  Q('.cat-chip[data-cat="all"]').click();
  var brokenBtns=QA(".vote-btn.v-broken");
  brokenBtns[1].click();
  res.push("BADGE:"+QA(".tag-broken").length);

  // 4. 打开「仅看问题站点」→ 应只剩 1 张卡；再点一次恢复
  F("brokenSel").click();
  res.push("BROKENGRID:"+QA(".site-card").length);
  res.push("TOGGLE:"+(F("brokenSel").className.indexOf("active")>=0?"ACTIVE":"OFF"));
  F("brokenSel").click();
  res.push("RESTORED:"+QA(".site-card").length);

  // 5. 手气不错：清筛选 + 命中卡片加脉冲类
  F("regionSel").value="中国";F("regionSel").dispatchEvent(new Event("change"));
  F("luckyBtn").click();
  res.push("LUCKYPULSE:"+(Q(".lucky-pulse")?"YES":"NO"));

  // 6. 收藏本地存储为密文（无明文站点 id）
  var raw=localStorage.getItem("gyp:favs:");
  res.push("FAVCIPHER:"+(raw&&raw.indexOf("google")===-1&&raw.length>10?"OK":"BAD"));

  var d=document.createElement("div");d.id="ftest";d.textContent=res.join(" | ");document.body.appendChild(d);
}catch(e){var d2=document.createElement("div");d2.id="ftest";d2.textContent="ERR["+e.message+"]";document.body.appendChild(d2);}},3000);</script>`;

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').replace('</body>', inj + '</body>');
fs.writeFileSync(path.join(__dirname, '../feat-test.html'), html);
console.log('feat-test.html 已生成');
