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
import hashlib
import html
import io
import os
import sys
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "assets", "js", "data.js")
DEFAULT_BASE = "https://ypage.ccwu.cc"

# 主题合辑生成器（文件名带连字符，不能直接 import，走 importlib）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
try:
    gen_collections = importlib.import_module("gen-collections")
except Exception as _e:      # 合辑模块缺失不影响其余 SEO 基建
    gen_collections = None
    print("[警告] 载入 gen-collections 失败：%s" % _e)
try:
    gen_blocks = importlib.import_module("gen-blocks")
except Exception as _e:      # 首页区块模块缺失不影响其余 SEO 基建
    gen_blocks = None
    print("[警告] 载入 gen-blocks 失败：%s" % _e)

START = "<!-- SEO:START (由 tools/gen-seo.py 生成，勿手改) -->"
END = "<!-- SEO:END -->"

# ─────────────────────────── 解析 data.js ───────────────────────────


def load_data():
    src = io.open(DATA, encoding="utf-8").read()

    cats = []
    for m in re.finditer(r"^\s*\{\s*key:\s*'([^']+)'(.*)$", src, re.M):
        tail = m.group(2)
        cats.append({
            "key": m.group(1),
            # 分类定义都是单行，剩余部分直接取 zh/en/icon/desc，避免逐个字段另写正则
            "zh": (re.search(r"zh:\s*'([^']*)'", tail).group(1)
                   if re.search(r"zh:\s*'([^']*)'", tail) else ""),
            "en": (re.search(r"en:\s*'([^']*)'", tail).group(1)
                   if re.search(r"en:\s*'([^']*)'", tail) else ""),
            "icon": (re.search(r"icon:\s*'([^']*)'", tail).group(1)
                     if re.search(r"icon:\s*'([^']*)'", tail) else ""),
            "desc": (re.search(r"desc:\s*'([^']*)'", tail).group(1)
                     if re.search(r"desc:\s*'([^']*)'", tail) else ""),
        })

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
        "# Bing 站长验证文件：必须允许抓取，否则无法完成所有权验证\n"
        "Allow: /BingSiteAuth.xml\n"
        "\n"
        "# ads.txt：Google AdSense 的授权卖方声明，必须可被 Google 抓取\n"
        "Allow: /ads.txt\n"
        "\n"
        "# 纯静态、零 JS：sites.html 全站索引 + cat/<分类>.html 分类页（优先抓这里，首页是 JS 渲染，爬虫拿不到外链）\n"
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
        'a.cat-page{float:right;font-size:12px;font-weight:400;color:#0071e3;text-decoration:none}',
        'a.cat-page:hover{text-decoration:underline}',
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
        # 独立分类页的内链入口：爬虫靠这些链接发现 17 个新页面
        p.append('<h2>%s %s<span class="cat-en">%s · %d 个</span>'
                 '<a class="cat-page" href="%s/cat/%s.html">独立页 ↗</a></h2>'
                 % (html.escape(c["zh"]), "", html.escape(c["en"]), len(items),
                    base, c["key"]))
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


# ───────────────────── 分类独立页（Bing/Yandex 收录专用） ─────────────────────
# 为什么需要：首页是 JS 渲染，爬虫拿到的原始 HTML 里一个外链都没有；
# sites.html 虽然有全部链接，但只有一个 URL，Bing 往往不知从何拆页。
# 给每个分类生成一个独立静态页 = 给爬虫 17 个明确的抓取入口。

CAT_CSS = (
    '*{box-sizing:border-box}body{margin:0;font:15px/1.7 -apple-system,"Microsoft YaHei UI",sans-serif;'
    'color:#1d1d1f;background:#fff}'
    '.wrap{max-width:860px;margin:0 auto;padding:28px 20px 60px}'
    'h1{font-size:25px;margin:0 0 8px}.sub{color:#6e6e73;margin:0 0 4px}'
    '.cat-guide{margin:26px 0 0}'
    '.cat-guide h2{font-size:16px;margin:0 0 8px;font-weight:600;letter-spacing:.01em}'
    '.cat-guide h3{font-size:13px;margin:16px 0 5px;font-weight:600;color:#6e6e73}'
    '.cat-guide p{margin:0 0 8px;color:#3a3a3c;line-height:1.85;font-size:14.5px}'
    '.cat-guide p b{color:#1d1d1f;font-weight:600}'
    '.cat-guide .cg-note{border-left:3px solid #d8d8dd;padding-left:14px;color:#6e6e73;font-size:13.5px}'
    '.en{font-size:12px;color:#8e8e93;margin-left:8px}'
    '.back{display:inline-block;margin:14px 0 8px;padding:8px 16px;border-radius:999px;'
    'background:#0071e3;color:#fff;text-decoration:none;font-size:14px}'
    'ul{list-style:none;padding:0;margin:18px 0 0}'
    'li{padding:11px 0;border-bottom:1px solid #f2f2f7}'
    'a.site{font-weight:600;color:#0071e3;text-decoration:none}a.site:hover{text-decoration:underline}'
    '.desc{color:#48484a;margin:2px 0}.meta{font-size:12px;color:#8e8e93;margin:0}'
    'footer{margin-top:44px;padding-top:16px;border-top:1px solid #e5e5ea;color:#8e8e93;font-size:13px}'
    '@media (prefers-color-scheme:dark){body{background:#1c1c1e;color:#f5f5f7}'
    'li{border-color:#2c2c2e}.desc{color:#c7c7cc}.sub,.meta,.en{color:#98989d}footer{border-color:#3a3a3c}'
    '.cat-guide p{color:#c7c7cc}.cat-guide p b{color:#f5f5f7}'
    '.cat-guide h3{color:#98989d}.cat-guide .cg-note{border-color:#3a3a3c;color:#98989d}}'
)


def load_cat_content():
    """加载分类页的原创文案（tools/cat-content.py）"""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "cat_content", os.path.join(ROOT, "tools", "cat-content.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.CONTENT
    except Exception as e:
        print("  [警告] 载入 cat-content.py 失败：%s（分类页将不含文案）" % e)
        return {}


def write_cat_pages(base, cats, sites):
    """为每个分类生成 cat/<key>.html，返回 [(相对URL, 站点数), ...]"""
    out_dir = os.path.join(ROOT, "cat")
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir)

    cat_content = load_cat_content()

    by = {}
    for s in sites:
        by.setdefault(s["category"], []).append(s)

    made = []
    today = datetime.date.today().isoformat()

    for c in cats:
        items = by.get(c["key"], [])
        if not items:
            continue
        rel = "cat/%s.html" % c["key"]
        url = base + "/" + rel

        p = ['<!DOCTYPE html>', '<html lang="zh-CN">', '<head>',
             '<meta charset="UTF-8">',
             '<meta name="viewport" content="width=device-width, initial-scale=1">',
             '<title>%s · %d 个精选网站 — 全球黄页</title>'
             % (html.escape(c["zh"]), len(items)),
             '<meta name="description" content="全球黄页「%s」分类：%d 个精选网站官网直达，'
             '含中文简介、地区与语言标注。%s">'
             % (html.escape(c["zh"]), len(items), html.escape(c["desc"][:60])),
             '<link rel="canonical" href="%s">' % url,
             '<meta name="robots" content="index,follow">',
             '<meta property="og:type" content="website">',
             '<meta property="og:site_name" content="全球黄页">',
             '<meta property="og:title" content="%s · %d 个精选网站">' % (html.escape(c["zh"]), len(items)),
             '<meta property="og:description" content="%s">' % html.escape(c["desc"]),
             '<meta property="og:url" content="%s">' % url,
             '<meta property="og:image" content="%s/assets/img/og-cover.png">' % base,
             '<meta name="twitter:card" content="summary_large_image">',
             '<style>', CAT_CSS, '</style>', '</head>', '<body>', '<div class="wrap">',
             '<h1>%s %s<span class="en">%s · %d 个网站</span></h1>'
             % (c["icon"], html.escape(c["zh"]), html.escape(c["en"]), len(items)),
             '<p class="sub">%s</p>' % html.escape(c["desc"]),
             '<a class="back" href="%s/sites.html">← 全站索引（%d 个网站）</a>' % (base, len(sites)),
             '<a class="back" href="%s/" style="background:#f5f5f7;color:#1d1d1f">回到主站看截图与投票</a>'
             % base,
             '<ul>']

        for s in items:
            p.append("<li>")
            p.append('<a class="site" href="%s" target="_blank" rel="noopener">%s</a>'
                     % (html.escape(s["url"]), html.escape(s["name"])))
            p.append('<p class="desc">%s</p>' % html.escape(s["desc"]))
            p.append('<p class="meta">%s · %s</p>' % (html.escape(s["region"]), html.escape(s["lang"])))
            p.append("</li>")

        p.append("</ul>")

        # 原创内容：选站标准 / 使用建议 / 补充说明
        # 这部分不是站点简介的复制，而是「为什么这样选、怎么用」的判断，
        # 是分类页区别于纯索引页的关键，也是人工审核读得出的价值所在。
        ctext = cat_content.get(c["key"])
        if ctext:
            p.append('<div class="cat-guide">')
            p.append('<h2>这个分类里怎么挑</h2>')
            p.append('<h3>选站标准</h3>')
            p.append('<p>%s</p>' % ctext["criteria"])
            p.append('<h3>使用建议</h3>')
            p.append('<p>%s</p>' % ctext["guide"])
            p.append('<h3>补充说明</h3>')
            p.append('<p class="cg-note">%s</p>' % ctext["notes"])
            p.append('</div>')

        p.append('<footer>%s 分类共 %d 个网站 · 最后更新 %s<br>'
                 '© 全球黄页 %s — 收录均为各站点官方首页链接</footer>'
                 % (html.escape(c["zh"]), len(items), today, datetime.date.today().year))
        p.append("</div></body></html>")

        io.open(os.path.join(out_dir, "%s.html" % c["key"]), "w", encoding="utf-8",
                newline="\n").write("\n".join(p))
        made.append((rel, len(items)))

    return made


# ───────────────────── 首页静态首屏（AdSense / 爬虫可见） ─────────────────────
# 为什么需要：首页的站点列表由 JS 渲染，Googlebot 抓到的原始 HTML 里
# 一个站点都看不到、也没有任何出站链接。AdSense 的人工审核员看��是同样的内容，
# 会判定「内容价值低」直接拒审。
#
# 做法：把各分类的代表站点直接写成静态 HTML，放在结果区之前。
# JS 渲染的完整网格仍然保留（381 个站点都在），静态这块负责：
#   ① 让爬虫看到真实内容与真实出站链接
#   ② 给无 JS 环境（爬虫/老浏览器/禁用 JS）一个可用的替代视图
#   ③ 补足首屏可读内容，把首页可见文字从 131 词提到千词量级

STATIC_START = "<!-- STATIC-FEED:START (由 tools/gen-seo.py 生成，勿手改) -->"
STATIC_END = "<!-- STATIC-FEED:END -->"

# 每个分类取几个代表站点，保证覆盖到各行业
STATIC_PER_CAT = 3
# 静态块最多列多少个站点（太多会让首页 HTML 膨胀，影响首屏速度）
STATIC_MAX = 36

STATIC_CSS = """
/* 静态精选：给爬虫与无 JS 环境看的实心内容，JS 网格渲染后会被隐藏 */
.static-feed{margin:0 0 28px}
.static-feed h3{font-size:17px;margin:0 0 4px;font-weight:600}
.static-feed .sf-note{font-size:13px;color:var(--text-3);margin:0 0 14px}
.static-feed .sf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.static-feed .sf-item{
  border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--bg-elevated);
}
.static-feed .sf-item h4{margin:0 0 3px;font-size:14.5px;font-weight:600}
.static-feed .sf-item h4 a{color:inherit;text-decoration:none}
.static-feed .sf-item h4 a:hover{color:var(--accent)}
.static-feed .sf-item .sf-domain{font-size:12px;color:var(--text-3);display:block;margin-bottom:4px}
.static-feed .sf-item p{margin:0;font-size:12.5px;color:var(--text-2);line-height:1.6}
.static-feed .sf-cat{
  display:inline-block;margin:0 0 5px;padding:1px 7px;border-radius:999px;
  font-size:11px;background:var(--bg-sunken);color:var(--text-2);
}
/* 有 JS 时隐藏静态块（完整网格已经渲染好了），但保留给爬虫的内容在 noscript 里 */
html.js-on .static-feed{display:none}
@media (prefers-color-scheme:dark){
  .static-feed .sf-item{background:#151a2e;border-color:rgba(255,255,255,.08)}
  .static-feed .sf-cat{background:rgba(255,255,255,.08)}
}
"""


def write_static_feed(base, cats, sites):
    """生成首页静态精选块，返回 HTML 字符串（空字符串表示无内容）"""
    by = {}
    for s in sites:
        by.setdefault(s["category"], []).append(s)
    cmap = {c["key"]: c for c in cats}

    picked = []
    for c in cats:
        for s in by.get(c["key"], [])[:STATIC_PER_CAT]:
            picked.append((c, s))
            if len(picked) >= STATIC_MAX:
                break
        if len(picked) >= STATIC_MAX:
            break

    if not picked:
        return ""

    out = [STATIC_START,
           '<section class="static-feed" aria-label="精选网站（静态索引）">',
           '<h3>精选网站 · %d 个行业分类</h3>' % len(cats),
           '<p class="sf-note">本页列出各行业的代表站点，均为各站官方首页链接；'
           '完整 %d 个站点见下方列表或<a href="%s/sites.html">全站索引</a>。</p>'
           % (len(sites), base),
           '<div class="sf-grid">']

    for c, s in picked:
        out.append('<div class="sf-item">')
        out.append('<span class="sf-cat">%s %s</span>'
                   % (html.escape(c["icon"]), html.escape(c["zh"])))
        out.append('<h4><a href="%s" target="_blank" rel="noopener">%s</a></h4>'
                   % (html.escape(s["url"]), html.escape(s["name"])))
        # 站点数据里没有 domain 字段，从 URL 提取（去掉 www. 与末尾斜杠）
        dom = re.sub(r"^https?://", "", s["url"]).rstrip("/")
        dom = re.sub(r"^www\.", "", dom).split("/")[0]
        out.append('<span class="sf-domain">%s</span>' % html.escape(dom))
        out.append('<p>%s</p>' % html.escape(s["desc"]))
        out.append('</div>')

    out.append('</div>')
    out.append('</section>')
    out.append(STATIC_END)
    return "\n".join(out)


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

def bump_asset_versions(text):
    """给 HTML 里的本地 css/js 引用加 ?v=<内容短哈希>。

    Cloudflare 边缘对静态资源有缓存，改了 JS/CSS 但 URL 没变的话用户要等缓存过期才看到。
    用文件内容哈希做版本号：内容不变 → URL 不变（继续吃缓存）；内容一改 → URL 变（立即生效）。
    """
    def repl(m):
        rel = m.group(1)
        if rel.endswith("data.js"):
            return m.group(0)  # data.js 的版本号由调用方用站点数指定，这里不动
        fpath = os.path.join(ROOT, rel.replace("/", os.sep))
        if not os.path.exists(fpath):
            return m.group(0)
        with open(fpath, "rb") as fh:
            h = hashlib.md5(fh.read()).hexdigest()[:8]
        return '%s="%s?v=%s"' % (m.group(0).split("=")[0], rel, h)

    # 匹配 href="assets/..." 与 src="assets/..."，先把旧版本号剥掉再重新算
    text = re.sub(r'(?:href|src)="(assets/[^"]+?)(?:\?v=[^"]*)?"', repl, text)
    return text


def inject_meta(base, nsites, ncats, static_feed="", guides="", scenes=""):
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
        # 幂等：先删掉历史遗留的同类 noscript（否则每跑一次就多一块）
        t = re.sub(r"\s*<noscript><div[^>]*>本站列表需要 JavaScript 渲染.*?</noscript>", "", t, flags=re.S)
        # 静态资源全部带版本号：URL 一变边缘缓存立即失效，改完不用等缓存过期
        # data.js 用站点数（直观）；其余 css/js 用内容短哈希（只有真改了才换 URL）
        t = re.sub(r"assets/js/data\.js(\?v=[^'\"]*)?", "assets/js/data.js?v=%d" % nsites, t)
        t = bump_asset_versions(t)
        if "<body" in t:
            t = re.sub(r"(<body[^>]*>)", r"\1\n" + noscript, t, count=1)

        # 场景化入口区块：插在分类栏之前——先按意图分流，再按行业浏览
        if scenes:
            # 幂等：先清掉旧块
            t = re.sub(re.escape(gen_blocks.SCENES_START) + r".*?"
                       + re.escape(gen_blocks.SCENES_END), "", t, flags=re.S)
            anchor = '<section class="cat-section" id="catSection">'
            if anchor in t:
                t = t.replace(anchor, scenes + "\n\n    " + anchor, 1)
            css = "<style>\n" + gen_blocks.SCENES_CSS + "</style>"
            if "</head>" in t:
                t = t.replace("</head>", css + "\n</head>", 1)
        # 主题合辑区块：插在精选块之前（编辑内容优先于索引填充）
        if guides:
            # 幂等：先清掉旧块
            t = re.sub(re.escape(gen_collections.GUIDES_START) + r".*?"
                       + re.escape(gen_collections.GUIDES_END), "", t, flags=re.S)
            anchor = '<div class="grid" id="grid"></div>'
            if anchor in t:
                t = t.replace(anchor, guides + "\n\n    " + anchor, 1)
            css = "<style>\n" + gen_collections.GUIDES_CSS + "</style>"
            if "</head>" in t:
                t = t.replace("</head>", css + "\n</head>", 1)
        # 静态精选块：插在结果区的 grid 之前，让爬虫先看到实心内容
        if static_feed:
            # 幂等：先清掉旧块
            t = re.sub(re.escape(STATIC_START) + r".*?" + re.escape(STATIC_END), "", t, flags=re.S)
            # 插到 <div class="grid" id="grid"></div> 之前
            anchor = '<div class="grid" id="grid"></div>'
            if anchor in t:
                t = t.replace(anchor, static_feed + "\n\n    " + anchor, 1)
            # 样式内联到 head（单独走一个 CSS 文件会增加请求数，直接内联更省）
            css = "<style>\n" + STATIC_CSS + "</style>"
            if "</head>" in t:
                t = t.replace("</head>", css + "\n</head>", 1)
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
    cat_pages = write_cat_pages(base, cats, sites)
    print("  生成 分类独立页 cat/*.html（%d 个）" % len(cat_pages))

    guide_pages = []
    if gen_collections:
        guide_pages = gen_collections.write_guides(base, sites)
        print("  生成 主题合辑页 guides/*.html（%d 页）" % len(guide_pages))

    sm = [
        (base + "/", 1.0, "daily"),
        (base + "/sites.html", 0.9, "weekly"),
        (base + "/index-v2.html", 0.6, "monthly"),
        # 信任页面：AdSense 审核必查项，独立 URL 权重不能低于汇总页
        (base + "/about.html", 0.5, "monthly"),
        (base + "/about-long.html", 0.6, "monthly"),   # 站长长文，E-E-A-T 主要落点
        (base + "/privacy.html", 0.5, "monthly"),
        (base + "/contact.html", 0.4, "monthly"),
        (base + "/disclaimer.html", 0.3, "yearly"),
        (base + "/legal.html", 0.3, "yearly"),
    ]
    # 分类页排在大站索引之后、全站索引之前，作为抓取主入口
    for rel, _n in cat_pages:
        sm.append((base + "/" + rel, 0.8, "weekly"))
    # 主题合辑页：原创编辑内容，权重与分类页同级
    for rel, _n in guide_pages:
        sm.append((base + "/" + rel, 0.8, "weekly"))
    print("  生成", write_sitemap(base, sm))
    print("  生成", write_sites_html(base, cats, sites))
    print("  生成", write_og_image(len(sites), len(cats)))
    static_feed = write_static_feed(base, cats, sites)
    print("  生成 首页静态精选块（%d 条）" % (static_feed.count('class="sf-item"') if static_feed else 0))
    guides = gen_collections.guides_block(base, sites) if gen_collections else ""
    scenes = gen_blocks.scenes_block(base, sites) if gen_blocks else ""
    print("  改写", inject_meta(base, len(sites), len(cats), static_feed, guides, scenes))
    print("\n完成。把 robots.txt / sitemap.xml / sites.html / assets/img/og-cover.png "
          "一起部署到站点根目录，\n并确保托管方不会对这几个路径做 SPA 回退（否则又返回首页 HTML）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
