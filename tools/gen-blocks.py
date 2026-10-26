#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-blocks.py — 首页内容区块生成器（静态 HTML）

首页是 JS 渲染的，爬虫看不见内容；SEO 基建的 static-feed 就是靠静态块
补的实心内容。这个模块沿用同一套路，生成两类区块：

  ① 场景化入口：按访客意图（要做什么）分流到策展清单，而不是让用户
     在 17 个行业分类里自己找
  ② 编辑推荐大卡：站长精选 + 一句推荐理由，建立 trust signal

两块都由 gen-seo.py 注入 index.html 与 index-v2.html（两版必须一致，
否则 verify-parity.js 会报错）。

文案来源：
  · 按钮标签与标题取自 assets/js/i18n.js 的中文块（运行时 i18n 再切四语），
    单一事实源，不在这里重复维护
  · 场景清单取自 assets/js/data.js 的 window.SCENE_DATA（app.js 也读它）

由 tools/gen-seo.py 调用（幂等，可反复跑）。
"""

import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "assets", "js", "data.js")
I18N_FILE = os.path.join(ROOT, "assets", "js", "i18n.js")

SCENES_START = "<!-- SCENES-BLOCK:START (由 tools/gen-blocks.py 生成，勿手改) -->"
SCENES_END = "<!-- SCENES-BLOCK:END -->"


def load_data():
    """data.js 是 JS 字面量，用 Node 求值后吐 JSON"""
    script = (
        "const fs=require('fs');global.window={};"
        "eval(fs.readFileSync('%s','utf8'));"
        "console.log(JSON.stringify({"
        "sites: window.SITE_DATA.map(s=>({domain:s.domain||'',name:s.name})),"
        "scenes: window.SCENE_DATA||{}"
        "}));" % DATA_FILE.replace("\\", "/")
    )
    r = subprocess.run(["node", "-e", script], capture_output=True, timeout=60)
    if r.returncode != 0:
        print("[失败] Node 解析 data.js：%s" % r.stderr.decode("utf-8", "ignore")[:200])
        return {}, {}
    d = json.loads(r.stdout.decode("utf-8", "ignore"))
    return d.get("sites") or [], d.get("scenes") or {}


def i18n_zh():
    """从 i18n.js 的中文块里抽出键值（运行时 i18n 负责切其他语言）"""
    t = io.open(I18N_FILE, encoding="utf-8").read()
    start = t.find("\n    zh: {")
    end = t.find("\n    en: {")
    if start < 0 or end < 0:
        return {}
    block = t[start:end]
    out = {}
    for m in re.finditer(r"(\w+):\s*'((?:[^'\\]|\\.)*)'", block):
        out[m.group(1)] = m.group(2)
    return out


def esc(s):
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


# 场景顺序即按钮顺序（也决定 i18n applyGroup 的下标对应）
SCENE_ORDER = ["code", "ai", "design", "money", "job", "learn"]


def scenes_block(base, sites=None, scenes=None):
    """生成「按你要做的事找」区块"""
    if sites is None or scenes is None:
        sites, scenes = load_data()
    zh = i18n_zh()
    have = set(s["domain"] for s in sites if s.get("domain"))

    items = []
    for sid in SCENE_ORDER:
        sc = scenes.get(sid)
        if not sc:
            continue
        doms = [d for d in sc.get("domains", []) if d in have]
        n = len(doms)
        items.append(
            '<button type="button" class="scene-item" data-sc="%s">'
            '<span class="scene-ico">%s</span>'
            '<span class="scene-label">%s</span>'
            '<span class="scene-n"><b>%d</b> <span class="scene-nlabel">%s</span></span>'
            '</button>'
            % (esc(sid), esc(sc.get("icon", "")),
               esc(zh.get("sc_" + sid, sid)), n, esc(zh.get("sc_n", ""))))

    if not items:
        return ""
    return (
        SCENES_START + "\n"
        '<section class="scenes" id="scenesSec" aria-label="按场景找网站">'
        '<div class="wrap">'
        '<div class="section-head"><h2>%s</h2>'
        '<span class="section-note">%s</span></div>'
        '<div class="scene-grid">%s</div>'
        '<p class="scene-status" id="sceneStatus" hidden></p>'
        "</div></section>\n"
        % (esc(zh.get("sc_title", "")), esc(zh.get("sc_note", "")), "".join(items))
        + SCENES_END
    )


SCENES_CSS = """
.scenes{padding:52px 0 8px}
.scene-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:16px}
.scene-item{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:15px 16px;border:1px solid var(--line,#e8e8ed);border-radius:14px;background:var(--bg-elevated,#fff);cursor:pointer;font-family:inherit;text-align:left;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
.scene-item:hover{border-color:var(--accent,#0071e3);box-shadow:0 4px 18px rgba(0,113,227,.10);transform:translateY(-1px)}
.scene-item.on{border-color:var(--accent,#0071e3);background:var(--accent-soft,#f2f7ff)}
.scene-ico{font-size:19px;line-height:1}
.scene-label{font-size:14.5px;font-weight:600;color:var(--text,#1d1d1f)}
.scene-n{font-size:12px;color:var(--text-3,#8e8e93)}
.scene-n b{font-weight:650;color:var(--accent,#0071e3)}
.scene-status{margin:14px 0 0;font-size:13.5px;color:var(--text-3,#8e8e93)}
.scene-status button{font:inherit;font-size:13px;color:var(--accent,#0071e3);background:none;border:none;padding:0 0 0 8px;cursor:pointer;text-decoration:underline}
@media (max-width:560px){.scene-grid{grid-template-columns:repeat(2,1fr)}}
"""

if __name__ == "__main__":
    b = scenes_block("https://ypage.ccwu.cc")
    print(b[:400] if b else "[失败] 场景区块为空")
