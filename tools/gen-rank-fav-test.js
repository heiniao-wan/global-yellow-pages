/**
 * 一次性脚本：生成「口碑榜 + 收藏可见性」E2E 测试页
 * 覆盖：星标胶囊文案 / 收藏 chip / 收藏空态引导 / 榜单按好评率排序 / 标题动态条数
 * 用法：node tools/gen-rank-fav-test.js
 */
const fs = require('fs');
const path = require('path');

const inj = `<script>setTimeout(function(){try{
  var Q=function(s){return document.querySelector(s)};
  var QA=function(s){return document.querySelectorAll(s)};
  var res=[];

  // 1. 星标默认文案应可见（不是裸图标）
  var star=Q(".fav-star");
  res.push("STAR_TXT:"+(star.querySelector(".fs-txt")||{}).textContent);

  // 2. 收藏 → on + 文案变「已收藏」+ chip 计数 1
  star.click();
  res.push("STAR_ON:"+(star.className.indexOf("on")>=0?"YES":"NO"));
  res.push("STAR_TXT2:"+(star.querySelector(".fs-txt")||{}).textContent);
  res.push("STAR_ARIA:"+(star.getAttribute("aria-pressed")));
  var chip=Q('.cat-chip[data-cat="__fav__"] .cat-count');
  res.push("CHIP:"+(chip?chip.textContent:"?"));

  // 3. 进入「我的收藏」应只剩 1 张卡
  Q('.cat-chip[data-cat="__fav__"]').click();
  res.push("FAVGRID:"+QA(".site-card").length);

  // 4. 在收藏视图里取消收藏 → 空态应给出引导文案
  var s2=Q(".fav-star");
  if(s2) s2.click();
  res.push("FAVGRID2:"+QA(".site-card").length);
  res.push("EMPTY_H:"+(Q("#emptyState p")||{}).textContent);
  res.push("EMPTY_SUB:"+(Q("#emptyState p.muted")||{}).textContent);
  res.push("EMPTY_SHOWN:"+(Q("#emptyState").hidden?"NO":"YES"));

  // 5. 回到全部：给第 1、3 张卡点赞，第 2 张卡点踩
  Q('.cat-chip[data-cat="all"]').click();
  var cards=QA(".site-card");
  cards[0].querySelector(".vote-btn.v-like").click();
  cards[1].querySelector(".vote-btn.v-dislike").click();
  cards[2].querySelector(".vote-btn.v-like").click();

  // 6. 榜单：图表是 400ms 防抖重绘的，必须等一拍再读
  setTimeout(function(){
    var head=null;
    QA(".chart-panel").forEach(function(p){ if(p.querySelector("#rankList")) head=p.querySelector("h3"); });
    res.push("RANK_TITLE:"+(head?head.textContent:"?"));
    var rows=QA("#rankList .rank-row");
    res.push("RANK_ROWS:"+rows.length);
    res.push("RANK_PCT:"+(rows.length? Array.prototype.map.call(rows,function(r){return r.querySelector(".rank-pct").textContent}).join(","):"-"));
    res.push("RANK_TOP_IS_LIKED:"+(rows.length&&rows[0].querySelector(".rank-pct").textContent==="100%"?"YES":"NO"));

    // 7. 切英文：榜单标题与收藏空态都应跟着变
    window.I18N.setLang("en");
    setTimeout(function(){
      var head2=null;
      QA(".chart-panel").forEach(function(p){ if(p.querySelector("#rankList")) head2=p.querySelector("h3"); });
      res.push("RANK_TITLE_EN:"+(head2?head2.textContent:"?"));
      var d=document.createElement("div");d.id="rftest";d.textContent=res.join(" | ");document.body.appendChild(d);
    },900);
  },900);
}catch(e){var d2=document.createElement("div");d2.id="rftest";d2.textContent="ERR["+e.message+"]";document.body.appendChild(d2);}},3500);</script>`;

['index.html', 'index-v2.html'].forEach(function (page) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8').replace('</body>', inj + '</body>');
  const out = page === 'index.html' ? 'rank-fav-test.html' : 'rank-fav-test-v2.html';
  fs.writeFileSync(path.join(__dirname, '..', out), html);
  console.log(out + ' 已生成');
});
