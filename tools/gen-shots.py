#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-shots.py — 站点截图预生成（构建期批量抓取，存静态文件）

为什么要把截图从「运行时懒加载」改成「构建期预生成」：
  运行时每条都走 Microlink/mshots，免费额度稍一并发就 429，
  381 张卡同时解析 → 网格里一半是占位框，像坏了一样。
  2026 年目录站的共识是 photo-first——图不稳定等于自毁卖相。
  预生成后：访客侧零第三方请求、秒开、可被 CDN 缓存，
  运行时服务降级为兜底（只服务漏网之站）。

产物：assets/img/shots/<域名>.webp（PIL 不可用或转换失败时退 .png）
命名规则与前端一致：hostname 去掉 www.（见 app.js 的 site.domain）

用法：
    python tools/gen-shots.py                 # 只补缺的（默认，可反复跑）
    python tools/gen-shots.py --all           # 全部重抓（周更用）
    python tools/gen-shots.py --limit 50      # 本次最多抓多少个
    python tools/gen-shots.py --trending      # 连同 trending.js 的条目一起抓
    python tools/gen-shots.py --dry           # 只看会抓哪些，不下载

通道：① mShots（快，首次会返回「生成中」占位图，需间隔重取）
      ② Microlink JSON（慢 10-20s 但渲染质量高，兜底）
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
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "assets", "js", "data.js")
TREND_FILE = os.path.join(ROOT, "assets", "js", "trending.js")
OUT_DIR = os.path.join(ROOT, "assets", "img", "shots")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# 双路径：沙箱代理常 502，直连反而通（与 fetch-trending.py 同策略）
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

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# 截图尺寸（与卡片展示比例 16:10 一致）
SHOT_W, SHOT_H = 640, 400


def http_get(url, timeout=25):
    last = None
    for opener in (_OPENER_DIRECT, _OPENER_PROXY):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with opener.open(req, timeout=timeout) as r:
                return r.status, r.read()
        except Exception as e:
            last = e
    return 0, str(last).encode("utf-8", "ignore") if last else b""


def is_image_bytes(b):
    return b[:4] == b"\x89PNG" or b[:2] == b"\xff\xd8" or b[:3] == b"GIF"


def valid_image(b):
    """截图质量校验——防三类假图混进图库：
    ① mshots「生成中」占位图（固定 400x300）
    ② 纯色/近纯色空白页（目标站挂了或屏蔽了截图服务）
    ③ 错误模板页（不同域名拿到字节相同的图——批量阶段查重处理）
    真实网站首页截图几乎必然有数百种颜色（文字抗锯齿就有几十种灰）。
    """
    if not is_image_bytes(b) or len(b) < 12000:
        return False
    if not HAS_PIL:
        return True
    try:
        with Image.open(io.BytesIO(b)) as im:
            w, h = im.size
            if w < 380 or h < 240:
                return False
            im2 = im.convert("RGB")
            colors = im2.getcolors(maxcolors=2000000)
            if colors is None:
                return True               # 颜色数爆炸 → 真实页面
            if len(colors) < 200:
                return False              # 纯色/近纯色
            top_ratio = max(colors)[0] / float(w * h)
            if top_ratio > 0.97:
                return False              # 单一颜色占比过高 = 空白
            return True
    except Exception:
        return False


def shot_name(url):
    """与前端一致的域名命名：hostname 去 www."""
    if not url.startswith("http"):
        url = "https://" + url
    host = urllib.parse.urlparse(url).hostname or ""
    return host[4:] if host.startswith("www.") else host


def fetch_mshots(url, tries=3):
    """mShots：第一次请求触发渲染，可能要等几秒再取才拿到真图"""
    target = "https://s.wordpress.com/mshots/v1/%s?w=%d&h=%d" % (
        urllib.parse.quote(url, safe=""), SHOT_W, SHOT_H)
    best = None
    for i in range(tries):
        st, body = http_get(target, timeout=25)
        if st == 200 and valid_image(body):
            return body
        if st == 200 and is_image_bytes(body) and best is None:
            best = body          # 可能是占位图，先留着兜底
        time.sleep(3 + i * 2)
    return best


def fetch_microlink(url):
    """Microlink JSON：拿 data.screenshot.url 直链再下图"""
    api = ("https://api.microlink.io/?url=%s&screenshot=true&meta=false"
           "&waitForTimeout=8000" % urllib.parse.quote(url, safe=""))
    st, body = http_get(api, timeout=30)
    if st != 200:
        return None
    try:
        j = json.loads(body.decode("utf-8", "ignore"))
        pic = ((j.get("data") or {}).get("screenshot") or {}).get("url")
        if not pic:
            return None
        st2, img = http_get(pic, timeout=30)
        if st2 == 200 and valid_image(img):
            return img
    except Exception:
        pass
    return None


def to_webp(png_bytes):
    """PNG/JPEG → WebP，失败返回 None（调用方退原格式）"""
    if not HAS_PIL:
        return None
    try:
        with Image.open(io.BytesIO(png_bytes)) as im:
            im = im.convert("RGB")
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=82, method=4)
            return buf.getvalue()
    except Exception:
        return None


def load_sites(with_trending):
    """从 data.js（+ trending.js）提取 (domain, url) 列表

    data.js 是 JS 字面量（单引号、尾逗等），不是合法 JSON，
    用 Node 求值后吐 JSON 出来，比正则/替换引号可靠得多。
    """
    js = (
        "const fs=require('fs');"
        "global.window={};"
        "eval(fs.readFileSync('%s','utf8'));"
        "const out=window.SITE_DATA.map(s=>({url:s.url}));"
        "%s"
        "console.log(JSON.stringify(out));"
    )
    trend_part = ""
    if with_trending and os.path.isfile(TREND_FILE):
        trend_part = (
            "eval(fs.readFileSync('%s','utf8'));"
            "out.push(...(window.TRENDING_DATA.entries||[]).map(e=>({url:e.url})));"
            % TREND_FILE.replace("\\", "/")
        )
    script = js % (DATA_FILE.replace("\\", "/"), trend_part)
    import subprocess
    node = os.environ.get("NODE", "node")
    try:
        r = subprocess.run([node, "-e", script], capture_output=True, timeout=60)
    except FileNotFoundError:
        print("[失败] 找不到 node，无法解析 data.js")
        sys.exit(1)
    if r.returncode != 0:
        print("[失败] Node 解析 data.js 出错：%s"
              % r.stderr.decode("utf-8", "ignore")[:200])
        sys.exit(1)
    raw = json.loads(r.stdout.decode("utf-8", "ignore"))
    out = [(shot_name(s["url"]), s["url"]) for s in raw if s.get("url")]
    # 按域名去重，保持原顺序
    seen, uniq = set(), []
    for d, u in out:
        if d and d not in seen:
            seen.add(d)
            uniq.append((d, u))
    return uniq


def existing_files():
    if not os.path.isdir(OUT_DIR):
        return set()
    return {f.rsplit(".", 1)[0] for f in os.listdir(OUT_DIR)
            if f.endswith((".webp", ".png"))}


def capture(domain, url):
    """抓一个站点，返回保存的后缀名（'.webp'/'.png'）或 None"""
    body = fetch_mshots(url)
    if body is None:
        body = fetch_microlink(url)
    if body is None:
        return None
    webp = to_webp(body)
    if webp:
        path = os.path.join(OUT_DIR, domain + ".webp")
        with open(path, "wb") as f:
            f.write(webp)
        return ".webp"
    path = os.path.join(OUT_DIR, domain + ".png")
    with open(path, "wb") as f:
        f.write(body)
    return ".png"


def main():
    args = sys.argv[1:]
    dry = "--dry" in args
    refresh_all = "--all" in args
    with_trending = "--trending" in args
    limit = 0
    for a in args:
        if a.startswith("--limit="):
            limit = int(a.split("=")[1])

    sites = load_sites(with_trending)
    have = existing_files()
    todo = [] if refresh_all else [(d, u) for d, u in sites if d not in have]
    if refresh_all:
        todo = sites
    if limit:
        todo = todo[:limit]

    print("=" * 56)
    print(" 站点截图预生成")
    print("=" * 56)
    print("  站点总数 %d · 已有截图 %d · 本次待抓 %d"
          % (len(sites), len(have), len(todo)))
    print("  PIL: %s（无则存原图）" % ("可用，输出 webp" if HAS_PIL else "不可用"))

    if dry:
        for d, _ in todo[:20]:
            print("    " + d)
        if len(todo) > 20:
            print("    ……共 %d 个" % len(todo))
        return 0
    if not todo:
        print("\n全部已有截图，无需抓取。")
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    ok = fail = 0
    fails = []
    t0 = time.time()

    def work(item):
        d, u = item
        r = capture(d, u)
        return d, r

    with ThreadPoolExecutor(max_workers=3) as ex:
        for i, (d, r) in enumerate(ex.map(work, todo), 1):
            if r:
                ok += 1
            else:
                fail += 1
                fails.append(d)
            if i % 10 == 0 or i == len(todo):
                print("  进度 %d/%d（成功 %d / 失败 %d）· 耗时 %.0fs"
                      % (i, len(todo), ok, fail, time.time() - t0), flush=True)

    print("\n完成：成功 %d，失败 %d" % (ok, fail))
    if fails:
        print("失败列表（可重跑补抓）：%s" % ", ".join(fails[:30]))

    # ── 查重：不同域名拿到字节相同的图 = 错误模板页（实测 abb.com /
    #    abema.tv / catch.co.kr 三站捕获完全一致）。真实站点截图不可能
    #    跨域名一致，整组删掉，下一轮重抓（届时走 Microlink 兜底）。
    import hashlib
    by_hash = {}
    for f in os.listdir(OUT_DIR):
        if not f.endswith((".webp", ".png")):
            continue
        p = os.path.join(OUT_DIR, f)
        h = hashlib.sha1(open(p, "rb").read()).hexdigest()
        by_hash.setdefault(h, []).append(f)
    dup_groups = [fs for fs in by_hash.values() if len(fs) > 1]
    if dup_groups:
        n = 0
        for fs in dup_groups:
            for f in fs:
                os.remove(os.path.join(OUT_DIR, f))
                n += 1
        print("查重：发现 %d 组跨域名相同截图（错误模板页），已删除 %d 个文件，"
              "下次运行重抓" % (len(dup_groups), n))

    total = len(existing_files())
    print("截图库现有 %d 个文件（%s）" % (total, os.path.relpath(OUT_DIR, ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
