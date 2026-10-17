# -*- coding: utf-8 -*-
"""
SEO 基建生成器（全球黄页）
================================================================
解决两件对「宣传」最要命的事：

  1. 原始 HTML 里一条外链都没有（全靠 JS 渲染），除 Google 外多数引擎
     和**所有社交平台爬虫**都读不到内容 → 生成一个纯静态、零 JS 的
     全站索引页 sites.html（335 条真实链接），让爬虫有东西可抓。
  2. /robots.txt、/sitemap.xml 被托管方当成 SPA 回退、返回首页 HTML
     → 生成真正的实体文件（必须在站点根目录原样部署，不要被回退规则吞掉）。
  3. 首页缺 Open Graph / Twitter Card / canonical → 生成 1200×630 封面图
     并把社交卡片元信息注入 index.html / index-v2.html。

产出：
  robots.txt          sitemap.xml          sites.html
  assets/img/og-cover.png
  index.html / index-v2.html 头部注入（幂等，重复运行不会叠加）

运行：
    C:\\Python\\Python312\\python.exe tools\\gen-seo.py
    C:\\Python\\Python312\\python.exe tools\\gen-seo.py --base https://你的域名
"""

from __future__ import annotations

import argparse
import datetime
import html
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "assets", "js", "data.js")
DEFAULT_BASE = "https://ypage.ccwu.cc"

START = "<!-- SEO:START (由 tools/gen-seo.py 生成，勿手改) -->"
END = "<!-- SEO:END -->"

# ─────────────────────────── 解析 data.js ───────────────────────────


def load_data():
    src = io.open(DATA, encoding="utf-8").read()

    cats = []
    for m in re.finditer(r"\{\s*key:\s*'([^']+)'\s*,\s*zh:\s*'([^']*)'\s*,\s*en:\s*'([^']*)'", src):
        cats.append({"key": m.group(1), "zh": m.group(2), "en": m.group(3)})

    # 逐行解析：字段顺序 / 引号风格可能有出入，单独取每个字段最稳
    def field(line, key):
        m = re.search(r"\b%s\s*:\s*'([^']*)'" % key, line) or \
            re.search(r'\b%s\s*:\s*"([^"]*)"' % key, line)
        return (m.group(1) if m else "").strip()

    sites = []
    block = src[src.find("window.SITE_DATA"):]
    for line in block.splitlines():
        if not re.match(r"\s*\{\s*name\s*:", line):
            continue
        url = field(line, "url")
        if not url.startswith("http"):
            continue
        sites.append({
            "name": field(line, "name"), "url": url,
            "category": field(line, "category"), "desc": field(line, "desc"),
            "region": field(line, "region"), "lang": field(line, "lang"),
        })
    return cats, sites


# ─────────────────────────── robots / sitemap ───────────────────────────

def write_robots(base):
    txt = (
        "# 全球黄页 · 让所有搜索引擎放心抓取\n"
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin.html\n"
        "Disallow: /functions/\n"
        "Disallow: /tools/\n"
        "\n"
        "# 纯静态、零 JS 的全站索引页（335 条真实链接，优先抓这里）\n"
        "Sitemap: %s/sitemap.xml\n" % base
    )
    io.open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8", newline="\n").write(txt)
    return "robots.txt"


def write_sitemap(base, pages):
    today = datetime.date.today().isoformat()
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, prio, change in pages:
        out.append("  <url>")
        out.append("    <loc>%s</loc>" % html.escape(loc))
        out.append("    <lastmod>%s</lastmod>" % today)
        out.append("    <changefreq>%s</changefreq>" % change)
        out.append("    <priority>%.1f</priority>" % prio)
        out.append("  </url>")
    out.append("</urlset>")
    io.open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8",
            newline="\n").write("\n".join(out) + "\n")
    return "sitemap.xml"


# ─────────────────────────── 静态全站索引页 ───────────────────────────

def write_sites_html(base, cats, sites):
    by = {}
    for s in sites:
        by.setdefault(s["category"], []).append(s)
    cmap = {c["key"]: c for c in cats}

    p = ['<!DOCTYPE html>', '<html lang="zh-CN">', '<head>',
         '<meta charset="UTF-8">',
         '<meta name="viewport" content="width=device-width, initial-scale=1">',
         '<title>全球黄页 · 全站索引（%d 个精选网站 / %d 个行业分类）</title>' % (len(sites), len(cats)),
         '<meta name="description" content="全球黄页全站索引：%d 个精选网站的官网直达链接，'
         '按 %d 个行业分类整理，附中文简介、地区与语言。">'
         % (len(sites), len(cats)),
         '<link rel="canonical" href="%s/sites.html">' % base,
         '<meta name="robots" content="index,follow">',
         '<meta property="og:type" content="website">',
         '<meta property="og:site_name" content="全球黄页">',
         '<meta property="og:title" content="全球黄页 · 全站索引（%d 个精选网站）">' % len(sites),
         '<meta property="og:description" content="%d 个精选网站官网直达，%d 个行业分类，中英日韩四语切换。">'
         % (len(sites), len(cats)),
         '<meta property="og:url" content="%s/sites.html">' % base,
         '<meta property="og:image" content="%s/assets/img/og-cover.png">' % base,
         '<meta name="twitter:card" content="summary_large_image">',
         '<style>',
         '*{box-sizing:border-box}body{margin:0;font:15px/1.7 -apple-system,"Microsoft YaHei UI",sans-serif;'
         'color:#1d1d1f;background:#fff}',
         '.wrap{max-width:960px;margin:0 auto;padding:28px 20px 60px}',
         'h1{font-size:26px;margin:0 0 6px}.sub{color:#6e6e73;margin:0 0 4px}',
         '.back{display:inline-block;margin:14px 0 26px;padding:8px 16px;border-radius:999px;'
         'background:#0071e3;color:#fff;text-decoration:none;font-size:14px}',
         'h2{font-size:19px;margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e5ea}',
         '.cat-en{font-size:12px;color:#8e8e93;font-weight:400;margin-left:8px}',
         'ul{list-style:none;padding:0;margin:0}',
         'li{padding:10px 0;border-bottom:1px solid #f2f2f7}',
         'a.site{font-weight:600;color:#0071e3;text-decoration:none}',
         'a.site:hover{text-decoration:underline}',
         '.desc{color:#48484a;margin:2px 0}',
         '.meta{font-size:12px;color:#8e8e93}',
         'footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e5ea;color:#8e8e93;font-size:13px}',
         '@media (prefers-color-scheme:dark){body{background:#1c1c1e;color:#f5f5f7}'
         'h2{border-color:#3a3a3c}li{border-color:#2c2c2e}.desc{color:#c7c7cc}'
         '.sub,.meta,.cat-en{color:#98989d}footer{border-color:#3a3a3c}}',
         '</style>', '</head>', '<body>', '<div class="wrap">',
         '<h1>🧭 全球黄页 · 全站索引</h1>',
         '<p class="sub">%d 个精选网站的官网直达链接，按 %d 个行业分类整理。'
         '本页为纯静态索引，无需 JavaScript。</p>' % (len(sites), len(cats)),
         '<a class="back" href="%s/">← 回到带截图与投票的主站</a>' % base]

    for c in cats:
        items = by.get(c["key"], [])
        if not items:
            continue
        p.append('<h2>%s %s<span class="cat-en">%s · %d 个</span></h2>'
                 % (html.escape(c["zh"]), "", html.escape(c["en"]), len(items)))
        p.append("<ul>")
        for s in items:
            p.append("<li>")
            p.append('<a class="site" href="%s" target="_blank" rel="noopener">%s</a>'
                     % (html.escape(s["url"]), html.escape(s["name"])))
            p.append('<p class="desc">%s</p>' % html.escape(s["desc"]))
            p.append('<p class="meta">%s · %s · %s</p>'
                     % (html.escape(s["region"]), html.escape(s["lang"]),
                        html.escape(cmap.get(s["category"], {}).get("zh", ""))))
            p.append("</li>")
        p.append("</ul>")

    p.append('<footer>共 %d 个网站 · %d 个分类 · 最后更新 %s<br>'
             '© 全球黄页 %s — 收录均为各站点官方首页链接</footer>'
             % (len(sites), len(cats), datetime.date.today().isoformat(),
                datetime.date.today().year))
    p.append("</div></body></html>")
    io.open(os.path.join(ROOT, "sites.html"), "w", encoding="utf-8",
            newline="\n").write("\n".join(p))
    return "sites.html（%d 条链接）" % len(sites)


# ─────────────────────────── 社交封面图 ───────────────────────────

def write_og_image(nsites, ncats):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return "(跳过 og-cover.png：未安装 Pillow)"

    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#0b1020")
    d = ImageDraw.Draw(img)
    # 渐变底
    for y in range(H):
        t = y / H
        r = int(11 + (86 - 11) * t)
        g = int(16 + (45 - 16) * t)
        b = int(32 + (140 - 32) * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))
    # 装饰圆
    for cx, cy, rad, col in ((1080, 90, 190, (255, 255, 255, 18)),
                             (140, 560, 150, (120, 160, 255, 22))):
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=col, width=2)

    fp = r"C:\Windows\Fonts\msyh.ttc"
    f_big = ImageFont.truetype(fp, 96)
    f_mid = ImageFont.truetype(fp, 42)
    f_sml = ImageFont.truetype(fp, 30)

    d.text((80, 150), "🧭  全球黄页", font=f_big, fill="white")
    d.text((84, 290), "Global Yellow Pages · 优质网站导航与口碑库", font=f_mid, fill="#b9c6ff")
    d.text((84, 370), "%d 个精选网站  ·  %d 个行业分类  ·  中英日韩四语" % (nsites, ncats),
           font=f_mid, fill="#e8ecff")
    d.text((84, 470), "按行业浏览 · 首页截图 · 真实口碑投票 · 一键直达官网",
           font=f_sml, fill="#9aa6c8")
    d.text((84, 545), "ypage.ccwu.cc", font=f_sml, fill="#6f7ba3")

    path = os.path.join(ROOT, "assets", "img", "og-cover.png")
    img.save(path, "PNG", optimize=True)
    return "assets/img/og-cover.png（1200×630，%.0f KB）" % (os.path.getsize(path) / 1024)


# ─────────────────────────── 首页元信息注入 ───────────────────────────

def inject_meta(base, nsites, ncats):
    block = [
        START,
        '<link rel="canonical" href="%s/">' % base,
        '<link rel="alternate" hreflang="zh-CN" href="%s/">' % base,
        '<link rel="alternate" hreflang="x-default" href="%s/">' % base,
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="全球黄页">',
        '<meta property="og:title" content="全球黄页 · 优质网站导航与口碑库">',
        '<meta property="og:description" content="%d 个精选网站，%d 个行业分类，'
        '带首页截图与真实用户口碑投票，支持中英日韩四语。" >' % (nsites, ncats),
        '<meta property="og:image" content="%s/assets/img/og-cover.png">' % base,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:locale" content="zh_CN">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="全球黄页 · 优质网站导航与口碑库">',
        '<meta name="twitter:description" content="%d 个精选网站 · %d 个行业分类 · 四语切换">'
        % (nsites, ncats),
        '<meta name="twitter:image" content="%s/assets/img/og-cover.png">' % base,
        END,
    ]
    done = []
    for page in ("index.html", "index-v2.html"):
        path = os.path.join(ROOT, page)
        t = io.open(path, encoding="utf-8").read()
        # 幂等：先清掉旧的注入块
        t = re.sub(re.escape(START) + r".*?" + re.escape(END), "", t, flags=re.S)
        inject = "\n".join(block)
        # 爬虫（不执行 JS）也能顺着静态索引页抓到内容
        noscript = ('<noscript><div style="padding:12px 16px;background:#fff3cd;'
                    'border-bottom:1px solid #ffe69c;font-size:14px">'
                    '本站列表需要 JavaScript 渲染。搜索引擎与无脚本环境请访问'
                    '<a href="%s/sites.html">全站索引（%d 个网站）</a>。'
                    '</div></noscript>' % (base, nsites))
        if "</head>" in t:
            t = t.replace("</head>", inject + "\n</head>", 1)
        if "<body" in t:
            t = re.sub(r"(<body[^>]*>)", r"\1\n" + noscript, t, count=1)
        io.open(path, "w", encoding="utf-8", newline="\n").write(t)
        done.append(page)
    return "、".join(done) + "（已注入 OG / Twitter Card / canonical + noscript 引导）"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE, help="站点正式域名，结尾不要带 /")
    a = ap.parse_args()
    base = a.base.rstrip("/")

    cats, sites = load_data()
    if not sites:
        print("[失败] 没解析到站点数据，检查 assets/js/data.js")
        return 1
    print("读到 %d 个分类、%d 个站点\n" % (len(cats), len(sites)))

    print("  生成", write_robots(base))
    print("  生成", write_sitemap(base, [
        (base + "/", 1.0, "daily"),
        (base + "/sites.html", 0.9, "weekly"),
        (base + "/index-v2.html", 0.6, "monthly"),
        (base + "/legal.html", 0.3, "yearly"),
    ]))
    print("  生成", write_sites_html(base, cats, sites))
    print("  生成", write_og_image(len(sites), len(cats)))
    print("  改写", inject_meta(base, len(sites), len(cats)))
    print("\n完成。把 robots.txt / sitemap.xml / sites.html / assets/img/og-cover.png "
          "一起部署到站点根目录，\n并确保托管方不会对这几个路径做 SPA 回退（否则又返回首页 HTML）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
