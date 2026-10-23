#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
translate-trending.py — 热点条目多语言翻译

为什么在「生成时」翻译而不是浏览器里翻译：
  ① 访客浏览器不发出任何第三方请求——隐私与性能零损失；
  ② 翻好后存进 trending.js，纯静态站离线也能正常显示；
  ③ 翻译服务挂了大不了回退英文原文，页面不会坏。

翻译引擎：Google Translate 的 gtx 公开端点（免 Key）。
  · 优点：神经机器翻译，英→中/日/韩质量足够用在标题上；
  · 缺点：非官方端点，随时可能改版或限流——所以：
    每条文本独立请求、失败就跳过（字段留空），
    UI 渲染时回退到原文，整条链路任何一步挂掉都不影响站点可用。
    哪天要换成 DeepL / Google Cloud 正式 API，只改 translate() 一个函数。

字段约定（写入每个条目）：
  siteTitle_zh / _en / _ja / _ko    站点自己的名称
  hotTitle_zh  / _en / _ja / _ko    榜单原标题（说明「它为什么火」）
源语言字段存原文；目标语言缺失时 UI 回退原文，所以允许部分失败。

用法：
    python tools/translate-trending.py            # 翻译并写回
    python tools/translate-trending.py --dry      # 只看会翻译什么，不写文件
    python tools/translate-trending.py --force    # 忽略已有翻译，全部重翻
"""

import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(ROOT, "assets", "js", "trending.js")

# 与 fetch-trending.py 保持一致：沙箱里系统代理常对部分主机 502，
# 直连反而通——两条路都建 opener，先直连后代理。
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE
_OPENER_DIRECT = urllib.request.build_opener(
    urllib.request.HTTPSHandler(context=_SSL_CTX),
    urllib.request.ProxyHandler({}),
)
_OPENER_PROXY = urllib.request.build_opener(
    urllib.request.HTTPSHandler(context=_SSL_CTX),
)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

LANGS = ("zh", "en", "ja", "ko")
# 站点语言码 → Google 语言码
GT_LANG = {"zh": "zh-CN", "en": "en", "ja": "ja", "ko": "ko"}

# 要翻译的字段（站点名 + 热点理由）
FIELDS = ("siteTitle", "hotTitle")

CJK_RE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]")


def http_get(url, timeout=20):
    """双路径 GET，返回 (status, body)"""
    last = None
    for opener in (_OPENER_DIRECT, _OPENER_PROXY):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with opener.open(req, timeout=timeout) as r:
                return r.status, r.read().decode("utf-8", "ignore")
        except Exception as e:
            last = e
    return 0, str(last)


def detect_lang(text):
    """粗判文本语言：含 CJK 字符视为中文，否则英文"""
    return "zh" if CJK_RE.search(text or "") else "en"


def translate(text, src, tgt, retries=2):
    """翻一条文本，失败返回 None（调用方跳过，UI 回退原文）"""
    if not text or not text.strip():
        return None
    q = urllib.parse.quote(text[:500])
    url = ("https://translate.googleapis.com/translate_a/single"
           "?client=gtx&sl=%s&tl=%s&dt=t&q=%s"
           % (GT_LANG[src], GT_LANG[tgt], q))
    for attempt in range(retries):
        st, body = http_get(url, timeout=12)
        if st == 200 and body:
            try:
                # 响应结构：[[["译文","原文",...],...],null,"en",...]
                segs = json.loads(body)[0]
                out = "".join(s[0] for s in segs if s and s[0])
                if out.strip():
                    return out.strip()
            except Exception:
                pass
        elif st == 429:
            # 免费端点限流：多退一会儿，别硬刚
            time.sleep(5.0 * (attempt + 1))
            continue
        time.sleep(1.5 * (attempt + 1))
    return None


def load_entries():
    src = io.open(OUT_FILE, encoding="utf-8").read()
    m = re.search(r"window\.TRENDING_DATA = (\{.*\});", src, re.S)
    if not m:
        return None, None
    return json.loads(m.group(1)), src


def main():
    dry = "--dry" in sys.argv
    force = "--force" in sys.argv

    data, src = load_entries()
    if not data:
        print("[失败] 读不到 trending.js 或格式不对")
        return 1
    entries = data.get("entries") or []
    if not entries:
        print("trending.js 没有条目，无需翻译。")
        return 0

    # ── 收集待翻译任务：(text, src_lang, tgt_lang) 去重 ──
    jobs = {}          # (text, src, tgt) -> True
    for e in entries:
        for f in FIELDS:
            text = (e.get(f) or "").strip()
            if not text:
                continue
            s = detect_lang(text)
            for tgt in LANGS:
                if tgt == s:
                    continue
                key = "%s_%s" % (f, tgt)
                if not force and (e.get(key) or "").strip():
                    continue      # 已有翻译，跳过（幂等）
                jobs[(text, s, tgt)] = True

    todo = sorted(jobs.keys())
    print("热点条目 %d 个，待翻译文本 %d 条（源语言自动判定）"
          % (len(entries), len(todo)))
    if not todo:
        print("全部已翻译，无需处理。")
        return 0

    if dry:
        for text, s, tgt in todo[:20]:
            print("  [%s→%s] %s" % (s, tgt, text[:60]))
        if len(todo) > 20:
            print("  ……共 %d 条" % len(todo))
        print("\n--dry 模式，未写入文件。")
        return 0

    # ── 逐条翻译（gtx 端点不支持批量 q，只能一条一请求）──
    cache = {}
    ok = fail = 0
    for i, (text, s, tgt) in enumerate(todo, 1):
        r = translate(text, s, tgt)
        if r:
            cache[(text, s, tgt)] = r
            ok += 1
        else:
            fail += 1
        if i % 10 == 0 or i == len(todo):
            print("  进度 %d/%d（成功 %d / 失败 %d）"
                  % (i, len(todo), ok, fail), flush=True)
        time.sleep(0.25)      # 温和一点，别把免费端点打疼

    # ── 写回条目 ──
    filled = 0
    for e in entries:
        for f in FIELDS:
            text = (e.get(f) or "").strip()
            if not text:
                continue
            s = detect_lang(text)
            # 源语言字段存原文，保证四个字段齐全
            e["%s_%s" % (f, s)] = text
            for tgt in LANGS:
                if tgt == s:
                    continue
                key = "%s_%s" % (f, tgt)
                r = cache.get((text, s, tgt))
                if r is not None:
                    e[key] = r
                    filled += 1
                elif force or key not in e:
                    e.pop(key, None)   # 翻失败的字段删掉，UI 回退原文

    data["translated"] = time.strftime("%Y-%m-%d %H:%M")
    header = src[:src.index("window.TRENDING_DATA =")]
    js = (header + "window.TRENDING_DATA = "
          + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    io.open(OUT_FILE, "w", encoding="utf-8", newline="\n").write(js)
    print("已写回 %s：填充 %d 个语言字段（失败 %d 条，UI 将回退原文）"
          % (os.path.relpath(OUT_FILE, ROOT), filled, fail))
    return 0


if __name__ == "__main__":
    sys.exit(main())
