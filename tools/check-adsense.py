# -*- coding: utf-8 -*-
"""
check-adsense.py — AdSense 准入自检（以 Googlebot 视角抓原始 HTML，不看 JS 渲染结果）

用法：
  python tools/check-adsense.py                 # 测线上
  python tools/check-adsense.py http://127.0.0.1:8901   # 测本地

检查项：必备页面是否真实存在、正文词量、外链数、404 行为、ads.txt、
        sitemap 规模、admin 是否 noindex、Cookie 同意/CMP、广告位与脚本状态。
"""
import re
import sys
import urllib.request
import urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://ypage.ccwu.cc").rstrip("/")

UA = ("Mozilla/5.0 (compatible; Googlebot/2.1; "
      "+http://www.google.com/bot.html)")

PAGES = [
    ("首页", "/"),
    ("关于我们", "/about.html"),
    ("关于我们(长文)", "/about-long.html"),
    ("联系方式", "/contact.html"),
    ("隐私政策", "/privacy.html"),
    ("服务条款", "/legal.html"),
    ("免责声明", "/disclaimer.html"),
    ("全部站点索引", "/sites.html"),
    ("主题合辑", "/guides.html"),
    ("分类页(AI)", "/cat/ai.html"),
    ("分类页(工具)", "/cat/tools.html"),
    ("不存在的页面", "/notexist-adsense-check-9871.html"),
    ("管理后台", "/admin.html"),
]

ok = warn = bad = 0


def fetch(path, timeout=25, hops=5):
    """跟随 30x（Cloudflare 的干净 URL 会先回 308），返回最终状态码与正文"""
    url = BASE + path
    for _ in range(hops):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.getcode(), r.read().decode("utf-8", "ignore"), r.geturl()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "ignore") if e.fp else ""
            loc = e.headers.get("Location") if e.headers else None
            if e.code in (301, 302, 303, 307, 308) and loc:
                url = loc if loc.startswith("http") else BASE + loc
                continue
            return e.code, body, e.geturl() if hasattr(e, "geturl") else url
        except Exception as e:
            return 0, "", "%s (%s)" % (url, e)
    return 0, "", "too many redirects"


def visible_text(html):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    h = re.sub(r"(?s)<!--.*?-->", " ", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = re.sub(r"&[a-z]+;|&#\d+;", " ", h)
    return re.sub(r"\s+", " ", h).strip()


def word_count(text):
    """中文按字计 + 英文按词计，两者相加近似"词量"，用于判断是否内容过薄"""
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin = len(re.findall(r"[A-Za-z][A-Za-z'-]+", text))
    return cjk + latin


def ext_links(html):
    hosts = set()
    for m in re.finditer(r'href="(https?://[^"]+)"', html):
        u = m.group(1)
        h = re.sub(r"^https?://", "", u).split("/")[0].lower()
        if "ypage.ccwu.cc" not in h:
            hosts.add(h)
    return len(hosts)


def line(name, value, verdict, note=""):
    global ok, warn, bad
    if verdict == "OK":
        ok += 1
        mark = "[OK]  "
    elif verdict == "WARN":
        warn += 1
        mark = "[注意]"
    else:
        bad += 1
        mark = "[问题]"
    print("%s %-18s %-28s %s" % (mark, name, value, note))


print("=" * 78)
print("AdSense 准入自检 —— %s" % BASE)
print("=" * 78)

results = {}
for label, path in PAGES:
    code, html, final = fetch(path)
    text = visible_text(html)
    wc = word_count(text)
    el = ext_links(html)
    is_fallback = False
    # SPA 回退识别：访问不存在页面却拿到首页内容
    if path.startswith("/notexist"):
        is_fallback = ('<div class="grid" id="grid">' in html) or ("全球黄页" in html and code == 200)
    results[label] = dict(code=code, wc=wc, el=el, html=html, path=path, fallback=is_fallback)

print("\n── 一、页面可达性与内容厚度（Googlebot 视角）──")
for label, path in PAGES:
    r = results[label]
    if label == "不存在的页面":
        if r["code"] == 404 and not r["fallback"]:
            line(label, "HTTP 404", "OK", "正确返回 404")
        else:
            line(label, "HTTP %s%s" % (r["code"], " + 回退首页" if r["fallback"] else ""), "BAD",
                 "应是 404：坏链会被判站点不完整")
        continue
    if r["code"] != 200:
        line(label, "HTTP %s" % r["code"], "BAD", "页面不可达")
        continue
    if label == "管理后台":
        # 后台是 noindex 的功能页，内容薄不算问题，只看是否真的禁止收录
        noidx = "noindex" in r["html"]
        line(label, "%d 词" % r["wc"], "OK" if noidx else "WARN",
             "已 noindex" if noidx else "未 noindex，会被当成薄内容页")
        continue
    # 内容厚度阈值：正文页 ≥400 词算稳，200~400 偏薄
    v = "OK" if r["wc"] >= 400 else ("WARN" if r["wc"] >= 200 else "BAD")
    line(label, "%d 词 / %d 外链站" % (r["wc"], r["el"]), v, "薄" if v != "OK" else "")

print("\n── 二、必备合规页面 ──")
for need in ["关于我们", "联系方式", "隐私政策", "服务条款"]:
    r = results[need]
    if r["code"] == 200 and r["wc"] >= 120:
        line(need + " 有效", "%d 词" % r["wc"], "OK")
    else:
        line(need + " 有效", "%d 词 (HTTP %s)" % (r["wc"], r["code"]), "BAD", "AdSense 明确要求")

print("\n── 三、广告相关文件 ──")
code, ads, _ = fetch("/ads.txt")
pub = re.findall(r"^google\.com,\s*(pub-\d{10,})", ads, re.M)
if code == 200 and pub:
    line("ads.txt", pub[0], "OK")
elif code == 200:
    line("ads.txt", "可访问但无有效 pub- ID", "WARN", "提交申请前必须填真实发布商 ID")
else:
    line("ads.txt", "HTTP %s" % code, "BAD", "抓不到会被直接拒审")

code, sm, _ = fetch("/sitemap.xml")
n_url = len(re.findall(r"<loc>", sm))
line("sitemap.xml", "%d 条 URL" % n_url, "OK" if n_url >= 15 else "WARN")

code, rb, _ = fetch("/robots.txt")
line("robots.txt", "HTTP %s" % code, "OK" if code == 200 and "Sitemap:" in rb else "WARN")

print("\n── 四、技术细节 ──")
home = results["首页"]["html"]
line("adsbygoogle 代码", "有" if "adsbygoogle" in home else "无", "OK" if "adsbygoogle" in home else "WARN",
     "审核会看版位与代码")
line("广告位容器", str(home.count("ad-slot")), "OK" if "ad-slot" in home else "WARN")
line("admin 页 noindex", "是" if 'name="robots" content="noindex' in results["管理后台"]["html"] else "否",
     "OK" if "noindex" in results["管理后台"]["html"] else "WARN", "后台不该被收录")
line("Cookie 同意 / CMP", "有" if ("consent" in home or "cookie" in home.lower()) else "无",
     "OK" if ("consent" in home) else "WARN", "EEA/UK 投放需 Google 认证 CMP")
line("首页 canonical", "有" if 'rel="canonical"' in home else "无", "OK" if 'rel="canonical"' in home else "WARN")
line("首页 viewport", "有" if 'name="viewport"' in home else "无", "OK" if 'name="viewport"' in home else "BAD")

print("\n── 五、内容价值与政策细节 ──")
priv = results["隐私政策"]["html"]
line("隐私政策披露 AdSense", "有" if re.search(r"AdSense|DoubleClick", priv, re.I) else "无",
     "OK" if re.search(r"AdSense|DoubleClick", priv, re.I) else "BAD",
     "AdSense 政策要求披露第三方广告 Cookie")
line("披露退出方式", "有" if re.search(r"aboutads|opt.?out|广告设置", priv, re.I) else "无",
     "OK" if re.search(r"aboutads|opt.?out|广告设置", priv, re.I) else "WARN",
     "应给出停用个性化广告的入口")
foot = "about.html" in home and "contact.html" in home and "privacy.html" in home
line("首页导航到合规页", "齐全" if foot else "缺", "OK" if foot else "BAD",
     "审核员要从首页找到 About/Contact/Privacy")

# 同一内容两个 URL 时，canonical 必须指向同一个，否则算重复内容
code1, g1, _ = fetch("/guides.html")
code2, g2, _ = fetch("/guides")
c1 = re.search(r'rel="canonical" href="([^"]+)"', g1)
c2 = re.search(r'rel="canonical" href="([^"]+)"', g2)
same = bool(c1 and c2 and c1.group(1) == c2.group(1))
line("合辑页 canonical 一致", (c1.group(1) if c1 else "无"), "OK" if same else "WARN",
     "" if same else "两个 URL 指向不同 canonical＝重复内容")

# 404 页若挂广告位，属于「无内容页面放广告」的政策风险
code404, h404, _ = fetch("/notexist-adsense-check-9871.html")
line("404 页无广告位", str(h404.count("ad-slot")), "OK" if "ad-slot" not in h404 else "WARN",
     "错误页放广告违反政策")

print("\n" + "=" * 78)
print("汇总：OK %d / 注意 %d / 问题 %d" % (ok, warn, bad))
print("=" * 78)
