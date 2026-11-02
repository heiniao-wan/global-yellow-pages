# -*- coding: utf-8 -*-
"""
gen-regions.py — 生成「按地区浏览」落地页
================================================================
产出：
    region.html          地区总览（5 个地区卡片 + 说明）
    region/<slug>.html   单地区目录页（按行业分类分组，每站带一句中文简介）

为什么单独做这套页：
    「日本网站导航」「韩国网站大全」这类查询有真实搜索量，竞争却比
    「全球网站大全」小得多。分类页回答的是"我该用哪个工具"，地区页回答的是
    "这个国家都有什么站"，两个意图不重叠，且地区页天然有实心内容
    （日本 56 条、中国 100 条），不存在薄内容风险。

运行：
    C:\\Python\\Python312\\python.exe tools\\gen-regions.py
    （通常由 gen-seo.py 直接调用，单独跑只用于调试）
"""

from __future__ import annotations

import html
import importlib
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

gen_collections = importlib.import_module("gen-collections")
BASE = gen_collections.BASE

# ── 地区定义 ────────────────────────────────────────────────
# region 字段必须与 data.js 里的写法完全一致；顺序即页面顺序
REGIONS = [
    {
        "slug": "china",
        "region": "中国",
        "h1": "中国网站导航",
        "title": "中国网站导航 · 国内主流站点一览 — 全球黄页",
        "desc": "按行业整理的中国大陆主流网站导航，覆盖搜索、门户、社交、电商、"
                "本地生活、金融、招聘与出行，每站附一句中文说明。",
        "intro": [
            "中国大陆的互联网是一个相对独立的生态：搜索、社交、电商、支付与内容平台"
            "各自成体系，且多数服务需要国内手机号才能完成注册。这份清单按用途挑出"
            "日常真正会用到的站点，覆盖搜索、门户、社交、电商、出行、金融与本地生活。",
            "如果你只是想找某个平台的官网入口，按下面的行业分类点开即可；每家都附了"
            "一句说明，讲清楚它是做什么的、适合谁用。需要提前说明的是，部分站点对"
            "境外访问有限制，实际体验可能与描述不同，这不是收录错误。",
        ],
    },
    {
        "slug": "japan",
        "region": "日本",
        "h1": "日本网站导航",
        "title": "日本网站导航 · 日本主流站点一览 — 全球黄页",
        "desc": "日本主流网站导航，覆盖搜索门户、新闻、社交、电商、招聘、旅游与"
                "动漫内容，每站附中文说明与使用门槛提示。",
        "intro": [
            "日本互联网的特点是「门户仍在、垂直很深」：Yahoo! JAPAN 依然是大量用户的"
            "上网起点，而招聘、二手交易、动漫、铁路出行等领域都有各自牢靠的垂直巨头，"
            "并不像欧美那样被少数几家平台完全吸收。",
            "日本站点普遍重视本地化体验，很多服务只提供日文界面，注册时常需日本手机号"
            "或本地地址。清单里对这类门槛做了说明，方便你在打开之前就判断能不能用，"
            "而不是注册到一半才发现卡住。",
        ],
    },
    {
        "slug": "korea",
        "region": "韩国",
        "h1": "韩国网站导航",
        "title": "韩国网站导航 · 韩国主流站点一览 — 全球黄页",
        "desc": "韩国主流网站导航，覆盖门户搜索、社交、电商、娱乐、求职与生活服务，"
                "每站附中文说明与注册门槛提示。",
        "intro": [
            "韩国的互联网高度集中在少数平台：搜索与门户以 Naver 为绝对核心，社交以"
            "KakaoTalk 为基础设施，电商则由 Coupang 主导。理解这三家的位置，基本就"
            "理解了大半个韩国互联网。",
            "韩国站点的一个显著特点是实名认证要求多，部分服务需要本地手机号或身份"
            "信息才能完成注册。清单里的说明会区分哪些是纯浏览可用、哪些必须注册，"
            "避免把时间花在注册不下来的服务上。",
        ],
    },
    {
        "slug": "southeast-asia",
        "region": "东南亚",
        "h1": "东南亚网站导航",
        "title": "东南亚网站导航 · 区域主流平台一览 — 全球黄页",
        "desc": "东南亚主要网站导航，覆盖区域级电商、本地平台、出行与支付服务，"
                "按国家与用途整理。",
        "intro": [
            "东南亚不是一个统一市场：印尼、越南、泰国、菲律宾、新加坡的语言、支付方式"
            "与主流平台各不相同，跨境电商往往要按国家分开运营，一套策略很难通用。",
            "这份清单收录区域级平台（如 Shopee、Lazada）与各国代表性站点，适合做"
            "跨境生意或研究区域市场时先建立整体印象。看的时候建议按国家分别判断，"
            "不要默认一个平台在所有国家都占主导。",
        ],
    },
    {
        "slug": "western",
        "region": "欧美",
        "h1": "欧美网站导航",
        "title": "欧美网站导航 · 欧美主流站点一览 — 全球黄页",
        "desc": "欧美主流网站导航，覆盖搜索、社交、新闻、电商、开发者工具、招聘与"
                "旅游，每站附中文说明。",
        "intro": [
            "欧美市场由少数全球平台加大量区域性服务构成：搜索、社交、电商基本被美国"
            "巨头占据，而新闻、招聘、本地服务则保留了大量本土玩家，行业垂直度很高。",
            "相较亚洲市场，欧美站点普遍对境外用户更开放，注册门槛低，多数服务提供"
            "英文界面，很少强制本地手机号验证。这也是它们更容易被全球用户直接使用的"
            "原因之一。",
        ],
    },
]

CSS = """
.rwrap{max-width:820px;margin:0 auto;padding:0 20px 44px}
.rwrap h1{font-size:27px;line-height:1.35;margin:20px 0 12px}
.rwrap .lead{color:#48484a;font-size:15.5px;line-height:1.9;margin:0 0 14px}
.rwrap .note{font-size:13px;color:#8e8e93;margin:0 0 6px}
.rwrap h2{font-size:19px;margin:34px 0 10px;padding-bottom:7px;border-bottom:1px solid #e5e5ea}
.rwrap h2 .cn{font-size:13px;color:#8e8e93;font-weight:400;margin-left:8px}
.rlist{list-style:none;padding:0;margin:0}
.rlist li{padding:12px 0;border-bottom:1px solid #f2f2f7}
.rlist a.site{font-weight:600;color:#0071e3;text-decoration:none;font-size:15.5px}
.rlist a.site:hover{text-decoration:underline}
.rlist .desc{color:#48484a;margin:4px 0 0;font-size:14px;line-height:1.75}
.rnav{margin:38px 0 0;padding-top:18px;border-top:1px solid #e5e5ea;font-size:14px;color:#6e6e73;line-height:2.1}
.rnav a{color:#0071e3;text-decoration:none;margin-right:14px;white-space:nowrap}
.rcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(238px,1fr));gap:14px;margin:24px 0 8px}
.rcard{display:block;border:1px solid #e5e5ea;border-radius:12px;padding:16px 18px;
  text-decoration:none;color:inherit;transition:border-color .15s}
.rcard:hover{border-color:#0071e3}
.rcard b{font-size:16.5px;display:block}
.rcard span{display:block;color:#8e8e93;font-size:13px;margin-top:5px}
@media (prefers-color-scheme:dark){
  .rwrap .lead,.rlist .desc{color:#c7c7cc}
  .rwrap h2,.rnav{border-color:#3a3a3c}
  .rlist li{border-color:#2c2c2e}
  .rwrap .note,.rcard span,.rwrap h2 .cn{color:#98989d}
  .rcard{border-color:#3a3a3c}
}
"""


def esc(s):
    return html.escape(str(s or ""))


def build_region_body(name, items, cats):
    """单地区页正文：按分类分组列出站点"""
    parts = ['<div class="rwrap">', "<h1>%s</h1>" % esc(REGION_BY_NAME[name]["h1"])]
    for p in REGION_BY_NAME[name]["intro"]:
        parts.append('<p class="lead">%s</p>' % esc(p))
    parts.append('<p class="note">本页共收录 %d 个站点，按行业分类排列；'
                 '链接均为各站官方首页。</p>' % len(items))

    by = {}
    for s in items:
        by.setdefault(s["category"], []).append(s)
    for c in cats:
        group = by.get(c["key"])
        if not group:
            continue
        parts.append('<h2>%s<span class="cn">%s · %d 个</span></h2>'
                     % (esc(c["zh"]), esc(c["en"]), len(group)))
        parts.append('<ul class="rlist">')
        for s in group:
            parts.append('<li><a class="site" href="%s" target="_blank" rel="noopener">%s</a>'
                         '<p class="desc">%s</p></li>'
                         % (esc(s["url"]), esc(s["name"]), esc(s["desc"])))
        parts.append("</ul>")

    parts.append(build_region_nav(name))
    parts.append("</div>")
    return "\n".join(parts)


def build_region_nav(current):
    links = []
    for r in REGIONS:
        if r["region"] == current:
            continue
        links.append('<a href="%s/region/%s.html">%s</a>' % (BASE, r["slug"], esc(r["h1"])))
    links.append('<a href="%s/region.html">地区总览</a>' % BASE)
    links.append('<a href="%s/sites.html">全部 %d 个站点</a>' % (BASE, TOTAL[0]))
    return '<nav class="rnav">其他地区：%s</nav>' % "".join(links)


def build_hub(counts):
    parts = ['<div class="rwrap">', "<h1>按地区浏览全球网站</h1>"]
    parts.append('<p class="lead">同一个行业在不同国家的答案往往完全不同：日本的招聘站、'
                 '韩国的电商、欧美的开发者工具，几乎没有重叠。所以除了按行业分类，'
                 '我们还按地区做了一份索引，方便你在做跨境业务、留学或旅行准备时，'
                 '直接看某个国家有哪些主流站点。</p>')
    parts.append('<p class="lead">下面每个地区页都按行业重新分组，站点说明与主站保持'
                 '同一份数据，不会出现两处信息不一致的情况。</p>')
    parts.append('<div class="rcards">')
    for r in REGIONS:
        parts.append('<a class="rcard" href="%s/region/%s.html"><b>%s</b>'
                     '<span>%d 个站点 · 按行业分组</span></a>'
                     % (BASE, r["slug"], esc(r["h1"]), counts.get(r["region"], 0)))
    parts.append("</div>")
    parts.append('<p class="note">找不到想要的？可以看'
                 '<a href="%s/sites.html" style="color:#0071e3;text-decoration:none">'
                 '全站索引</a>，或回<a href="%s/" style="color:#0071e3;text-decoration:none">'
                 '主站</a>按行业筛选。</p>' % (BASE, BASE))
    parts.append("</div>")
    return "\n".join(parts)


REGION_BY_NAME = {r["region"]: r for r in REGIONS}
TOTAL = [0]


def write_regions(base=BASE, cats=None, sites=None):
    """生成 region.html 与 region/<slug>.html，返回 [(相对路径, 站点数)]"""
    if cats is None or sites is None:
        gen_seo = importlib.import_module("gen-seo")
        cats, sites = gen_seo.load_data()
    TOTAL[0] = len(sites)

    outdir = os.path.join(ROOT, "region")
    if not os.path.isdir(outdir):
        os.makedirs(outdir)

    counts = {}
    made = []
    for r in REGIONS:
        items = [s for s in sites if s["region"] == r["region"]]
        counts[r["region"]] = len(items)
        body = build_region_body(r["region"], items, cats)
        doc = gen_collections.page_shell(
            r["title"], r["desc"], "%s/region/%s.html" % (base, r["slug"]),
            body, extra_head="<style>%s</style>" % CSS,
            footer_text="全球黄页 · 按地区浏览 · 收录均为各站点官方首页链接 · 与主站数据同步")
        path = os.path.join(outdir, "%s.html" % r["slug"])
        io.open(path, "w", encoding="utf-8", newline="\n").write(doc)
        made.append(("region/%s.html" % r["slug"], len(items)))

    hub = gen_collections.page_shell(
        "按地区浏览全球网站 · 全球黄页",
        "按中国、日本、韩国、东南亚、欧美五个地区整理的主流网站导航，每个地区页按行业分组。",
        "%s/region.html" % base, build_hub(counts),
        extra_head="<style>%s</style>" % CSS,
        footer_text="全球黄页 · 按地区浏览 · 收录均为各站点官方首页链接 · 与主站数据同步")
    io.open(os.path.join(ROOT, "region.html"), "w", encoding="utf-8", newline="\n").write(hub)
    made.insert(0, ("region.html", sum(counts.values())))
    return made


if __name__ == "__main__":
    for rel, n in write_regions():
        print("  生成 %-26s %d 个站点" % (rel, n))
