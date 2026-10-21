#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch-trending.py — 热点网站采集器

从多个公开榜单抓取当天热门的网站，筛选出「值得收录的站点」，
写入 assets/js/trending.js（热度层，不污染主数据 data.js）。

── 为什么单独一层 ──
data.js 是人工精选的主数据（每个站点都有中文简介、分类、地区），
是站点质量与 AdSense 审核内容的主体。热点抓来的站点质量参差、
说明文字也不完整，混进主数据会拉低整站质量。
所以拆成两层：
  · data.js     人工精选，长期保留，代表站点「基本盘」
  · trending.js 每日自动更新，只放近期值得关注的新站点
两者在页面上分区展示，用户能清楚看出哪些是精选、哪些是最新发现。

── 数据源（全部公开、无需 API Key）──
  1. Hacker News 热门（Algolia 搜索 API）—— 质量最高，带 points 热度
  2. GitHub Trending —— 当天热门开源项目
  3. InfoQ 中文技术资讯 —— 国内技术圈热点
  4. Hacker News RSS —— 补充源

── 筛选规则（保证收录的是「有用的网站」而不是垃圾）──
  ① 域名级去重：与已有 381 个站点 + 历史上次收录的站点比对
  ② 排除清单：新闻转载、社交媒体、聚合器、招聘、成人、博彩等不适合收录的
  ③ 排除短链与占位域名：bit.ly、t.co、medium.com/@user 等
  ④ 排除「文章页」：只收网站首页，不收 /article/xxx 这类深层路径
  ⑤ 排除明显不完整的域名：无点号、纯数字 IP、太长
  ⑥ 热度门槛：HN 需 points ≥ 阈值，GitHub 需在 trending 榜单里
  ⑦ 标题/域名关键词过滤：明显的导航站、采集站、垃圾 SEO 站
  ⑧ 每个域名取热度最高的一条，多条指向同站只留一条

── 用法 ──
  python tools/fetch-trending.py            # 抓取并生成
  python tools/fetch-trending.py --dry      # 只看结果不写文件
  python tools/fetch-trending.py --min-points 50
"""

import io
import json
import os
import re
import sys
import time
import datetime
import urllib.request
import urllib.error
import urllib.parse
import ssl
from html import unescape
from concurrent.futures import ThreadPoolExecutor

# SSL 容错上下文：有些站点的证书链在中间 CA 缺失的环境下校验失败
# （实测 ncsc.nl）。这类站点本身是正常的，只是证书链不完整，
# 不该因此被整站丢弃 —— 抓元信息失败就退回域名规则。
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(ROOT, "assets", "js", "trending.js")
HISTORY_FILE = os.path.join(ROOT, ".trending-history.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# ── 排除清单 ─────────────────────────────────────────────
# 这些类型的站点不适合收录进「优质网站黄页」
EXCLUDE_DOMAINS = {
    # 社交 / 内容平台（本站已有代表性条目收录，不重复收录它们的子页）
    "twitter.com", "x.com", "facebook.com", "instagram.com", "linkedin.com",
    "reddit.com", "tiktok.com", "pinterest.com", "snapchat.com", "tumblr.com",
    "mastodon.social", "bsky.app", "threads.net", "weibo.com", "douban.com",
    "zhihu.com", "xiaohongshu.com", "bilibili.com", "vimeo.com", "flickr.com",
    "patreon.com", "substack.com", "medium.com", "dev.to", "hashnode.dev",
    # 聚合器 / 内容农场（收录它们等于给黄页导流到另一个黄页）
    "news.ycombinator.com", "lobste.rs", "slashdot.org", "digg.com",
    "feedly.com", "flipboard.com", "newsblur.com", "techmeme.com",
    "mashable.com", "techcrunch.com", "theverge.com", "arstechnica.com",
    "wired.com", "engadget.com", "gizmodo.com", "zdnet.com", "cnet.com",
    # 招聘 / classifieds（不属于「优质工具站」范畴）
    "indeed.com", "glassdoor.com", "monster.com", "linkedin.com/jobs",
    "craigslist.org", "olx.com", "gumtree.com", "ebay.com",
    # 成人 / 博彩（AdSense 硬性禁止）
    "pornhub.com", "xvideos.com", "xnxx.com", "onlyfans.com",
    "bet365.com", "pokerstars.com", "draftkings.com", "fanduel.com",
    # 搜索 / 社交基础设施（已在主数据里收录过站点本身）
    "google.com/search", "bing.com/search", "duckduckgo.com/?q",
    # 通用代码托管（主数据已收录 GitHub 本身）
    "github.com", "gitlab.com", "bitbucket.org",
    # 云服务控制台（不是「网站」）
    "console.aws.amazon.com", "cloud.google.com", "app.vercel.com",
    "dash.cloudflare.com", "localhost",
}

# 短链 / 追踪 / 占位域名
SHORTLINK_DOMAINS = {
    "bit.ly", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "tinyurl.com",
    "cutt.ly", "rebrand.ly", "shorturl.at", "lnkd.in", "fb.me", "youtu.be",
    "amzn.to", "nyti.ms", "dlvr.it", "ift.tt", "trib.al", "qr.ae", "s.id",
    "lnkiy.com", "shorte.st", "tr.im", "cli.gs", "v.gd", "bl.ink",
    "read.bi", "db.tt", "hyperurl.co", "shorturl.com", "soo.gd", "clck.ru",
}

# 标题/域名里的垃圾站关键词
SPAM_PATTERNS = [
    r"casino", r"viagra", r"porn", r"escort", r"sex-?chat", r"xxx",
    r"crypto-?giveaway", r"free-?bitcoin", r"airdrop", r"bet-?online",
    r"loan-?fast", r"payday-?loan", r"credit-?card-?offer", r"gift-?card",
    r"watch-?online", r"free-?download", r"torrent-?download", r"nulled",
    r"keygen", r"crack", r"warez", r"seo-?service", r"backlinks?",
    r"web-?design-?services?", r"cheap-?(?:traffic|links)",
]

# 只收首页：这些路径段说明是文章页/详情页，不是站点入口
DEEP_PATH_HINTS = [
    "/article", "/article/", "/posts/", "/post/", "/blog/", "/news/",
    "/story", "/stories/", "/show-", "/thread", "/discussion",
    "/r/", "/comments/", "/item", "/items/", "/product/", "/products/",
    "/release", "/releases/", "/tag/", "/tags/", "/category/", "/c/",
    "/wiki/", "/docs/", "/documentation", "/changelog", "/blog/20",
    "/202", "/question", "/answer", "/video/", "/watch", "/amp",
]

# ── 个人博客 / 内容站排除 ──
# HN/InfoQ 这类榜单是「新闻与文章聚合」，榜首经常是个人博客、
# 单篇评论、纯文本页面。这些放进「优质工具站黄页」毫无价值。
# 判据：域名看起来像个人站点，或路径特征像文章页。
PERSONAL_SITE_HINTS = [
    # 常见个人域名后缀与形态
    ".blog", ".dev", ".io", ".me", ".xyz", ".site", ".page", ".life",
    ".tech", ".cloud", ".space", ".online", ".fun", ".link", ".wiki",
]
# 路径里出现这些词，说明是站点内部的个人页
PERSONAL_PATH_HINTS = [
    "/~", "/users/", "/user/", "/@", "/author/", "/about-me",
    "/posts/", "/post/", "/articles/", "/article/", "/blog/",
    "/notes/", "/note/", "/diary", "/journal", "/diary/",
]

# 收录站点需要的最低热度（HN points）
MIN_POINTS = 30
# 每日最多收录多少个新站点
MAX_NEW = 24
# 单个域名的最短长度（防止 .a 这类）
MIN_DOMAIN_LEN = 4


def http_get(url, timeout=25, headers=None):
    """带重试的 GET，返回 (status, body)"""
    h = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8"}
    if headers:
        h.update(headers)
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout,
                                        context=_SSL_CTX) as r:
                return r.status, r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return e.code, ""
            last = e
        except Exception as e:
            last = e
        time.sleep(1.2 * (attempt + 1))
    print("    [跳过] %s —— %s" % (url[:60], str(last)[:60]))
    return 0, ""


def get_json(url):
    st, body = http_get(url)
    if st != 200 or not body:
        return None
    try:
        return json.loads(body)
    except Exception:
        return None


# ── 域名工具 ─────────────────────────────────────────────
def normalize_domain(url):
    """从 URL 提取裸域名，小写、去 www."""
    if not url:
        return ""
    u = url.strip()
    if not u.startswith("http"):
        u = "http://" + u
    try:
        p = urllib.parse.urlparse(u)
        host = (p.hostname or "").lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def root_domain(domain):
    """取站点的根域（处理 gov.uk / com.cn / co.jp 这类二级后缀）

    例：www.duckdb.org → duckdb.org
        news-web.php.net → php.net
        a.b.example.com.cn → example.com.cn
    """
    if not domain:
        return ""
    parts = domain.split(".")
    if len(parts) <= 2:
        return domain
    # 常见的二级公共后缀
    two_level = {"co.uk", "com.cn", "com.hk", "com.tw", "co.jp", "co.kr",
                 "com.au", "co.nz", "com.sg", "com.br", "co.in", "org.cn",
                 "net.cn", "gov.cn", "edu.cn", "ac.uk", "gov.uk", "ne.jp",
                 "or.jp", "go.jp", "re.kr", "or.kr", "com.mx", "com.ar"}
    last2 = ".".join(parts[-2:])
    if last2 in two_level and len(parts) >= 3:
        return ".".join(parts[-3:])
    # 品牌博客子站：googleblog.com → blog.google
    if len(parts) >= 3 and parts[-2] in ("blog", "blogs", "blogspot",
                                         "wordpress", "news", "press",
                                         "wiki", "docs", "support"):
        return ".".join(parts[-2:])
    return ".".join(parts[-2:])


def is_valid_domain(d):
    if not d or len(d) < MIN_DOMAIN_LEN:
        return False
    if "." not in d:
        return False
    if d.replace(".", "").isdigit():
        return False          # 纯 IP
    if d.endswith(".local") or d.endswith(".test") or d.endswith(".invalid"):
        return False
    if d.count(".") > 4:
        return False
    if re.search(r"\s", d):
        return False
    return True


def is_homepage_url(url, domain):
    """只收站点首页，不收文章详情页"""
    try:
        p = urllib.parse.urlparse(url)
    except Exception:
        return False
    path = (p.path or "").rstrip("/")
    if path in ("", "/index.html", "/index.htm", "/index.php", "/home"):
        return True
    low = url.lower()
    for hint in DEEP_PATH_HINTS:
        if hint in low:
            return False
    # 路径过深（4 段以上）大概率是文章页
    if path.count("/") >= 3:
        return False
    return True


# 明确放行的产品站（即使是 .io/.dev 形态也要留下）
KNOWN_PRODUCT_DOMAINS = {
    "notion.so", "figma.com", "vercel.com", "netlify.app", "substack.com",
    "medium.com", "dev.to", "hashnode.dev", "producthunt.com",
    "indiehackers.com", "glitch.me", "replit.com", "codesandbox.io",
    "stackblitz.io", "observablehq.com", "excalidraw.com", "tldraw.com",
    "ray.so", "val.town", "itty.bitty.site", "sandbox.dev", "bolt.new",
    "lovable.dev", "v0.dev", "cursor.so", "linear.app", "slack.com",
    "discord.com", "zoom.us", "miro.com", "loom.com", "descript.com",
    "grammarly.com", "notion.site", "airtable.com", "asana.com",
    "marginalia.nu", "wiby.me", "stract.com", "kagi.com", "readwise.io",
    "omnivore.app", "wallabag.io", "heptabase.com", "capacities.io",
    "logseq.com", "anytype.io", "craft.do", "bear.app", "ulysses.app",
    "obsidian.md", "zotero.org", "arxiv.org", "paperswithcode.com",
    "huggingface.co", "ollama.com", "lmstudio.ai", "openrouter.ai",
    "perplexity.ai", "phind.com", "you.com", "poe.com", "character.ai",
    "runway.ml", "elevenlabs.io", "suno.com", "udio.com", "replicate.com",
    "fal.ai", "modal.com", "replicate.com", "together.ai", "groq.com",
    "deepseek.com", "kimi.moonshot.cn", "qwen.ai", "doubao.com",
    "volcengine.com", "siliconflow.cn", "bigmodel.cn", "moonshot.cn",
    "layerfs.ai", "safedep.io", "patchtheplanet.org", "ncsc.nl",
    "php.net", "kernel.org", "apple.com", "steampowered.com", "quantamagazine.org",
}

# 明显的「子站/功能页」前缀 —— 收的是产品本身，不是它的某个功能页
SUBDOMAIN_PREFIXES = {
    "news", "store", "shop", "blog", "docs", "doc", "help", "support",
    "forum", "forums", "community", "wiki", "learn", "developer", "dev",
    "api", "cdn", "static", "assets", "mail", "email", "webmail", "account",
    "accounts", "auth", "login", "signup", "status", "careers", "jobs",
    "about", "press", "pr", "legal", "security", "status", "billing",
    "admin", "panel", "console", "dashboard", "app", "m", "mobile",
    "lite", "amp", "old", "new", "beta", "staging", "test", "demo",
    "play", "explore", "discover", "search", "tag", "tags", "topic",
    "r", "u", "i", "en", "cn", "jp", "ko", "translate", "proxy",
}

# 媒体 / 资讯 / 招聘类站点 —— 有价值但不属于「优质工具站」范畴
MEDIA_HINTS = [
    "times", "post", "herald", "journal", "tribune", "chronicle",
    "guardian", "reuters", "bloomberg", "wsj", "ft.com", "economist",
    "newsweek", "businessinsider", "politico", "axios", "theinformation",
    "ycombinator", "hbr", "stratechery", "semianalysis",
]
# 招聘/YC 公司页
HIRING_HINTS = [
    "is hiring", "we are hiring", "join our team", "join the team",
    "open positions", "work at", "careers", "yc p2", "yc w2",
]
# 站点标题里出现这些词 → 是「个人作品/教程/思考」，不是产品
PERSONAL_TITLE_HINTS = [
    "my ", "i ", "a ", "an ", "how i", "how to", "why i", "what i",
    "essay", "notes on", "thoughts on", "opinion", "retrospective",
    "zettel", "weeknote", "changelog", "release notes", "years of",
    "i sell", "i built", "i made", "i wrote", "my journey", "my story",
    "guide to", "tutorial on", "explained", "deep dive", "rethinking",
    "against ", "in defense of", "notes from", "letter to", "open letter",
]


def is_personal_site(url, domain, title):
    """判断是否是个人博客/单篇内容页 —— 这类不适合收录进工具站黄页

    这是本采集器最关键的一道筛。HN/InfoQ 是「文章聚合榜」，
    榜首经常是个人博客或单篇评论。判断依据（任一命中即排除）：
      ① 域名在已知产品白名单里 → 放行
      ② 路径含个人页特征（/~user、/@user、/posts/ 等）
      ③ 域名是很强的个人站形态（xxx.dev / xxx.io / xxx.me 等）
      ④ 标题是「Show HN: xxx」「Ask HN: xxx」这类自述型发布
      ⑤ 标题是「我如何…」「关于…的思考」这类第一人称作品
      ⑥ 域名只有一段（无连字符、无产品后缀）→ 疑似个人域名
    """
    if domain in KNOWN_PRODUCT_DOMAINS:
        return False

    t = (title or "").lower()
    # ③ Show HN / Ask HN：个人自述的小项目
    if re.match(r"^\s*(show|ask|tell)\s+hn\b", t):
        return True
    # ① 路径特征
    low = url.lower()
    for hint in PERSONAL_PATH_HINTS:
        if hint in low:
            return True
    # ⑤ 第一人称作品型标题
    for hint in PERSONAL_TITLE_HINTS:
        if hint in t[:40]:
            return True
    # ③ 强个人站形态
    base = domain.split(".")[0]
    for suf in PERSONAL_SITE_HINTS:
        if domain.endswith(suf) and len(base) <= 22:
            return True
    # ④ 带日期/序号的博客域名
    if re.search(r"(20\d{2}|\d{4,})", base) and re.search(
            r"(blog|post|note|entry|diary|journal)", base):
        return True
    # ⑥ 疑似个人域名：单段、纯小写单词、无连字符，
    #    且标题也像个人作品 → 才排除。
    #    （只看域名形态会误杀很多正经产品，比如 v0.dev、tldraw.com）
    if ("-" not in base and len(base) <= 15
            and base.isalpha()
            and not re.search(r"(news|blog|wiki|shop|store|app|tools|dev|"
                              r"docs|help|support|mail|cdn|api|go|io)$", base)
            and domain.count(".") == 1
            and re.search(r"\b(i|my|me|essay|notes|blog|post)\b", t[:30])):
        return True
    return False


# 首页 title/description 里出现这些词 → 是个人博客 / 个人作品站
PERSONAL_META_HINTS = [
    "my blog", "my website", "my homepage", "personal site", "personal blog",
    "my notes", "my journal", "my thoughts", "my projects", "about me",
    "hello world", "welcome to my", "this is my", "i'm a", "i am a",
    "writing about", "notes on", "essays", "thoughts on", "reading notes",
    "book notes", "linkblog", "links and", "tumblr", "photography",
    "portfolio", "resume", "cv of", "curriculum vitae",
]
# 首页 title/description 里出现这些词 → 是真正的产品 / 工具
PRODUCT_META_HINTS = [
    "platform", "tool", "app", "api", "sdk", "software", "saas", "dashboard",
    "open source", "open-source", "framework", "library", "database",
    "hosting", "cloud", "workspace", "editor", "generator", "converter",
    "analyzer", "monitor", "tracker", "calculator", "builder", "client",
    "server", "service", "integration", "automation", "ai ",
]


def fetch_meta(url, timeout=12):
    """抓首页的 title 与 description —— 用来判断是「产品」还是「个人博客」

    这是比域名黑名单可靠得多的判据：个人博客的 description 里
    几乎总会写「my blog」「notes on」「about me」这类词。
    抓不到就返回空，让调用方退回域名规则，不阻断流程。
    """
    st, body = http_get(url, timeout=timeout)
    if st != 200 or not body:
        return ""
    m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    if not m:
        return ""
    title = unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", m.group(1)))).strip()
    return title[:300]


def fetch_meta_batch(domains, workers=10):
    """并发抓多个站点的首页 title

    串行抓 20 个站点要 20×12 秒 = 4 分钟，跑不动。
    并发后约 15-25 秒完成。
    """
    out = {}
    if not domains:
        return out
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(fetch_meta, "https://" + d): d for d in domains}
        for fut, d in futs.items():
            try:
                out[d] = fut.result()
            except Exception:
                out[d] = ""
    return out


def looks_personal_by_meta(title, domain=""):
    """根据首页 title 判断是否个人站点

    三类信号：
    ① 明确的自我描述词：my blog / notes on / about me …
    ② 「人名 | 域名」结构：个人站的 title 几乎都是这个格式
       （实测 Kristen Maevyn | maevyn.codes），
       而产品站是「产品名: 一句话说明」（LayerFS: the filesystem for AI…）
    ③ 标题以人名开头且很短（无产品关键词）
    """
    t = (title or "").lower().strip()
    if not t:
        return False

    # ① 明确的自我描述词
    for h in PERSONAL_META_HINTS:
        if h in t:
            return True

    # ② 「人名 | 域名」结构 —— 个人站的强特征
    if " | " in t:
        left, right = t.split(" | ", 1)
        # 右边是本站域名，左边是人名（两个首字母大写的词）
        base = domain.split(".")[0].lower() if domain else ""
        if base and right.strip().startswith(base):
            if re.match(r"^[a-z]+ [a-z]+$", left.strip()):
                return True
        if re.match(r"^[a-z]+ [a-z]+$", left.strip()):
            return True

    # ③ 标题很短（< 26 字符）且不含任何产品关键词 → 疑似个人站
    if len(t) < 26 and not looks_like_product_by_meta(t):
        return True

    return False


def looks_like_product_by_meta(title):
    """根据首页 title 判断是否是产品/工具站"""
    t = (title or "").lower()
    for h in PRODUCT_META_HINTS:
        if h in t:
            return True
    return False


def is_media_or_hiring(domain, title):
    """媒体资讯站与招聘页 —— 对「优质工具站黄页」没有收录价值

    · 媒体站：内容型站点，我们已经收录了各家权威媒体
    · 招聘页：YC 公司页/招聘公告，是文章不是网站
    """
    t = (title or "").lower()
    for h in HIRING_HINTS:
        if h in t:
            return True
    base = domain.split(".")[0].lower()
    for h in MEDIA_HINTS:
        if h in base:
            return True
    return False


def is_feature_page(domain):
    """判断是否是某个产品的「功能子站」而非产品本身

    例：news-web.php.net（PHP 新闻页）、store.steampowered.com（Steam 商店）
    这类对用户没有独立价值 —— 它们的父站才是有意义的收录对象。
    """
    parts = domain.split(".")
    # 只看最左边两段（子域 + 主域）
    if len(parts) < 2:
        return False
    sub = parts[0].lower()
    if sub in SUBDOMAIN_PREFIXES:
        # 排除那些本身就是独立产品的（主域就是产品名）
        if domain in KNOWN_PRODUCT_DOMAINS:
            return False
        return True
    return False


def looks_like_spam(text):
    t = (text or "").lower()
    for pat in SPAM_PATTERNS:
        if re.search(pat, t):
            return True
    return False


# ── 数据源 ───────────────────────────────────────────────
def fetch_hackernews(limit=60):
    """Hacker News 热门（Algolia API），带 points 热度"""
    out = []
    for tag in ("front_page", "story"):
        url = ("https://hn.algolia.com/api/v1/search?tags=%s&hitsPerPage=%d"
               % (tag, limit))
        d = get_json(url)
        if not d:
            continue
        for h in d.get("hits", []):
            u = h.get("url")
            if not u:
                continue
            title = unescape(re.sub(r"<[^>]+>", "", h.get("title") or ""))
            out.append({
                "url": u,
                "title": title,
                "points": int(h.get("points") or 0),
                "comments": int(h.get("num_comments") or 0),
                "source": "Hacker News",
                "sourceKey": "hn",
            })
    return out


def fetch_hackernews_recent(min_points=50):
    """Hacker News 近期高分（按时间倒序 + points 门槛）

    比 front_page 更适合「追踪热点」：front_page 是当前榜首页，
    很快被刷掉；按时间取能覆盖最近 24-48 小时的新鲜内容。
    """
    out = []
    for hours in (24, 48, 72):
        url = ("https://hn.algolia.com/api/v1/search_by_date?tags=story"
               "&numericFilters=points>%d,created_at_i>%d&hitsPerPage=40"
               % (min_points, int(time.time()) - hours * 3600))
        d = get_json(url)
        if not d:
            continue
        for h in d.get("hits", []):
            u = h.get("url")
            if not u:
                continue
            title = unescape(re.sub(r"<[^>]+>", "", h.get("title") or ""))
            out.append({
                "url": u,
                "title": title,
                "points": int(h.get("points") or 0),
                "comments": int(h.get("num_comments") or 0),
                "source": "Hacker News",
                "sourceKey": "hn",
            })
    return out


def fetch_github_trending():
    """GitHub Trending 当天热门项目

    页面结构会变（GitHub 改版频繁），所以用宽松的正则：
    按 <article class="Box-row"> 切块，每块里找仓库路径与 star 数。
    找不到就整页扫描 href="/owner/repo" 作为兜底。
    """
    out = []
    st, body = http_get("https://github.com/trending?since=daily")
    if st != 200:
        return out

    blocks = re.findall(r'<article class="Box-row[^"]*">(.*?)</article>',
                         body, re.S)
    if not blocks:
        # 兜底：整页扫仓库链接
        blocks = [body]

    seen = set()
    for b in blocks:
        # 仓库名：<a href="/owner/repo" ...>，取第一个非 sponsors 的
        m = re.search(r'href="/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)"', b)
        if not m:
            continue
        repo = m.group(1).strip()
        if repo.count("/") != 1:
            continue
        owner = repo.split("/")[0]
        if owner.lower() in ("sponsors", "login", "signup", "features",
                              "topics", "collections", "trending",
                              "marketplace", "settings", "orgs"):
            continue
        if repo in seen:
            continue
        seen.add(repo)

        # 描述
        desc = ""
        dm = re.search(r'<p class="col-9[^"]*"[^>]*>\s*(.*?)\s*</p>', b, re.S)
        if dm:
            desc = unescape(re.sub(r"<[^>]+>", " ", dm.group(1)))
            desc = re.sub(r"\s+", " ", desc).strip()

        # 当日 star 数
        stars = 0
        sm = re.search(r"([\d,]+)\s*stars?\s*today", b)
        if sm:
            stars = int(sm.group(1).replace(",", ""))

        name = repo.split("/")[1]
        out.append({
            "url": "https://github.com/" + repo,
            "title": (owner + "/" + name) + (" — " + desc if desc else ""),
            "points": stars,
            "comments": 0,
            "source": "GitHub Trending",
            "sourceKey": "github",
            "isRepo": True,
        })
    return out


def fetch_infoq():
    """InfoQ 中文技术资讯（RSS）"""
    out = []
    st, body = http_get("https://www.infoq.cn/feed")
    if st != 200:
        return out
    for item in re.findall(r"<item>(.*?)</item>", body, re.S):
        tm = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", item, re.S)
        lm = re.search(r"<link>(.*?)</link>", item, re.S)
        if not tm or not lm:
            continue
        title = unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", tm.group(1))).strip()
        link = unescape(lm.group(1).strip())
        if not title or not link:
            continue
        out.append({
            "url": link,
            "title": title,
            "points": 0,
            "comments": 0,
            "source": "InfoQ 中文站",
            "sourceKey": "infoq",
        })
    return out


def fetch_hn_rss():
    """Hacker News RSS（补充源）"""
    out = []
    st, body = http_get("https://hnrss.org/frontpage")
    if st != 200:
        return out
    for item in re.findall(r"<item>(.*?)</item>", body, re.S):
        tm = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", item, re.S)
        lm = re.search(r"<link>(.*?)</link>", item, re.S)
        if not tm or not lm:
            continue
        out.append({
            "url": unescape(lm.group(1).strip()),
            "title": unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", tm.group(1))).strip(),
            "points": 0, "comments": 0,
            "source": "Hacker News RSS", "sourceKey": "hnrss",
        })
    return out


# ── 已有站点与历史 ───────────────────────────────────────
def load_existing_domains():
    """主数据 data.js 里的全部域名 + trending.js 里已有的"""
    doms = set()
    p = os.path.join(ROOT, "assets", "js", "data.js")
    if os.path.exists(p):
        s = io.open(p, encoding="utf-8").read()
        for u in re.findall(r"url:\s*'([^']+)'", s):
            d = normalize_domain(u)
            if d:
                doms.add(d)
    p2 = os.path.join(ROOT, "assets", "js", "trending.js")
    if os.path.exists(p2):
        s2 = io.open(p2, encoding="utf-8").read()
        for u in re.findall(r'"url":\s*"([^"]+)"', s2):
            d = normalize_domain(u)
            if d:
                doms.add(d)
    return doms


def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            return json.load(io.open(HISTORY_FILE, encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_history(hist):
    io.open(HISTORY_FILE, "w", encoding="utf-8", newline="\n").write(
        json.dumps(hist, ensure_ascii=False, indent=1))


# ── 主流程 ───────────────────────────────────────────────
def classify(domain, title, source_key):
    """粗分类：按域名关键词归到已有分类体系"""
    d = domain.lower()
    t = (title or "").lower()
    blob = d + " " + t
    rules = [
        ("ai", ["ai", "llm", "gpt", "claude", "gemini", "openai", "anthropic",
                "mistral", "llama", "model", "agent", "prompt", "inference",
                "transformer", "diffusion", "embedding", "rag", "chatbot"]),
        ("devtools", ["github", "gitlab", "ide", "compiler", "rust", "golang",
                      "python", "docker", "kubernetes", "api", "sdk", "debug",
                      "terminal", "shell", "regex", "json", "editor", "framework",
                      "database", "postgres", "mysql", "redis", "server",
                      "cloud", "deploy", "ci/cd", "pipeline", "test", "lint",
                      "code", "dev", "build", "package", "repo", "kernel"]),
        ("tools", ["design", "figma", "canvas", "notion", "obsidian", "trello",
                   "kanban", "todo", "productivity", "note", "doc", "pdf",
                   "convert", "editor", "diagram", "whiteboard", "task"]),
        ("news", ["news", "press", "journal", "times", "post", "herald",
                  "reporter", "daily", "media", "wire"]),
        ("media", ["video", "stream", "player", "music", "podcast", "audio",
                   "youtube", "twitch", "live", "radio"]),
        ("education", ["learn", "course", "tutorial", "book", "study",
                       "school", "university", "course", "academy", "lecture",
                       "training", "skill"]),
        ("finance", ["bank", "fintech", "invest", "trading", "stock", "crypto",
                     "payment", "invoice", "accounting", "tax", "budget",
                     "market", "wealth", "money", "insur"]),
        ("shopping", ["shop", "store", "ecommerce", "cart", "deal", "coupon",
                      "product", "marketplace", "retail", "grocery"]),
        ("travel", ["travel", "trip", "flight", "hotel", "booking", "tour",
                    "visa", "map", "tripadvisor"]),
        ("social", ["chat", "forum", "community", "social", "discuss",
                    "discord", "slack", "meetup", "reddit"]),
        ("security", []),
        ("machinery", ["machine", "robot", "cnc", "cad", "plc", "industrial",
                       "manufactur", "engineering", "factory", "precision"]),
    ]
    for cat, kws in rules:
        if cat == "security":
            continue
        for kw in kws:
            if kw in blob:
                return cat
    if source_key == "github":
        return "devtools"
    return "devtools"


def main():
    dry = "--dry" in sys.argv
    min_points = MIN_POINTS
    for a in sys.argv:
        if a.startswith("--min-points"):
            min_points = int(a.split("=")[1]) if "=" in a else 30

    print("=" * 58)
    print(" 热点网站采集器")
    print("=" * 58)

    print("\n【1】抓取数据源")
    raw = []
    for name, fn in (("Hacker News", fetch_hackernews),
                     ("HN 近期高分", fetch_hackernews_recent),
                     ("GitHub Trending", fetch_github_trending),
                     ("InfoQ", fetch_infoq),
                     ("HN RSS", fetch_hn_rss)):
        try:
            got = fn()
            print("  %-18s → %d 条" % (name, len(got)))
            raw.extend(got)
        except Exception as e:
            print("  %-18s → 失败：%s" % (name, str(e)[:50]))
    if not raw:
        print("\n所有数据源都不可用，退出。")
        return 1

    print("\n【2】筛选")
    existing = load_existing_domains()
    history = load_history()
    seen_today = set()
    # 根域候选：文章页归并来的站点，key=根域名
    root_candidates = {}
    # 待做元信息复核的候选（最后统一并发批量抓）
    pending_meta = []
    picked = []
    stats = {"total": len(raw), "dup": 0, "short": 0, "exclude": 0,
             "deep": 0, "spam": 0, "personal": 0, "feature": 0, "media": 0,
             "low": 0, "ok": 0, "personal_meta": 0, "meta_fail": 0}

    # 按热度排序，保证高分优先入选
    raw.sort(key=lambda x: (x.get("points", 0), x.get("comments", 0)), reverse=True)

    for item in raw:
        dom = normalize_domain(item["url"])
        if not is_valid_domain(dom):
            stats["dup"] += 1
            continue
        if dom in SHORTLINK_DOMAINS or dom in EXCLUDE_DOMAINS:
            stats["exclude"] += 1
            continue
        if any(dom.endswith("." + e) or dom == e for e in EXCLUDE_DOMAINS):
            stats["exclude"] += 1
            continue
        if dom in existing or dom in seen_today:
            stats["dup"] += 1
            continue
        if dom in history:
            # 历史收录过：只更新热度，不重复收录
            history[dom]["lastSeen"] = datetime.date.today().isoformat()
            history[dom]["hits"] = history[dom].get("hits", 0) + 1
            stats["dup"] += 1
            continue
        # ── 第一步：把 URL 归一到「站点首页」──
        # HN 上看到的是 duckdb.org/2026/10/21/announcing-duck 这种公告页，
        # 但值得收录的是 duckdb.org 这个网站本身。
        # 所以先把 URL 归一到根域，后续所有判断都针对「这个网站」来做。
        if not is_homepage_url(item["url"], dom):
            stats["deep"] += 1
            root = root_domain(dom)
            if (root and root != dom and is_valid_domain(root)
                    and root not in existing and root not in seen_today
                    and root not in SHORTLINK_DOMAINS
                    and not any(root.endswith("." + e) for e in EXCLUDE_DOMAINS)):
                root_candidates.setdefault(root, []).append(item)
            continue
        # 归一化：把域名换成根域，URL 换成首页
        root = root_domain(dom)
        if root != dom:
            if root in existing:
                stats["dup"] += 1
                continue
            if root in seen_today:
                stats["dup"] += 1
                continue
            if not is_valid_domain(root):
                stats["dup"] += 1
                continue
            dom = root
            item = dict(item, homepage="https://" + root)
        if looks_like_spam(item["title"]) or looks_like_spam(dom):
            stats["spam"] += 1
            continue
        if is_personal_site(item["url"], dom, item["title"]):
            stats["personal"] += 1
            continue
        if is_feature_page(dom):
            stats["feature"] += 1
            continue
        if is_media_or_hiring(dom, item["title"]):
            stats["media"] += 1
            continue

        # ── 元信息复核放到最后统一并发批量做（见下方），这里只登记 ──
        pending_meta.append((dom, item))
        if item["sourceKey"] == "hn" and item.get("points", 0) < min_points:
            stats["low"] += 1
            continue
        seen_today.add(dom)
        stats["ok"] += 1
        picked.append((dom, item))

        if len(picked) >= MAX_NEW:
            break

    # 根域归并：同一站点可能被多篇文章指向，只留热度最高的一条
    for root, items in root_candidates.items():
        if root in existing or root in seen_today:
            continue
        seen_today.add(root)      # 立刻登记，防止与正常流程重复收录
        if len(picked) >= MAX_NEW:
            break
        best = max(items, key=lambda x: (x.get("points", 0), x.get("comments", 0)))
        if looks_like_spam(best["title"]) or looks_like_spam(root):
            continue
        # 用首页 URL 判断是不是个人站（公告页路径会误伤）
        home_url = "https://" + root
        if is_personal_site(home_url, root, best["title"]):
            continue
        if is_feature_page(root):
            continue
        if is_media_or_hiring(root, best["title"]):
            continue
        pending_meta.append((root, best))
        stats["ok"] += 1
        picked.append((root, dict(best, url=home_url)))

    # ── 元信息复核（并发批量）──
    # 抓首页 title，看它是「产品」还是「个人博客」。
    # 这是比任何域名黑名单都可靠的判据：个人博客的 title 里几乎总会写
    # 「my blog」「notes on」，或者用「人名 | 域名」的格式
    # （实测 Kristen Maevyn | maevyn.codes vs
    #   LayerFS: the filesystem for AI coding agents）。
    # 串行抓 20 个站点要 4 分钟，并发后 20 秒内完成。
    if pending_meta:
        print("  正在复核 %d 个站点的首页信息…" % len(pending_meta))
        metas = fetch_meta_batch([d for d, _ in pending_meta])
        keep = []
        for d, it in pending_meta:
            m = metas.get(d) or ""
            if m:
                if looks_personal_by_meta(m, d):
                    stats["personal_meta"] += 1
                    continue
                it["metaTitle"] = m
            else:
                stats["meta_fail"] += 1
            keep.append((d, it))
        picked = keep

    # ── 最终去重 ──
    # 归并候选与首页候选走两条路径进来，seen_today 的登记时机不同，
    # 同一域名可能进两次。按热度排序后保留第一条（热度最高的那条）。
    final = []
    final_seen = set()
    for d, it in sorted(picked, key=lambda x: (x[1].get("points", 0),
                                               x[1].get("comments", 0)),
                         reverse=True):
        if d in final_seen:
            stats["dup"] += 1
            continue
        final_seen.add(d)
        final.append((d, it))
    picked = final

    print("  原始 %d 条 → 有效 %d 条" % (stats["total"], stats["ok"]))
    print("  排除明细：已在库/重复 %d、清单外 %d、文章页 %d、个人博客 %d、"
          "功能子页 %d、媒体/招聘 %d、元信息判为个人 %d、垃圾 %d、热度不足 %d"
          % (stats["dup"], stats["exclude"], stats["deep"], stats["personal"],
             stats["feature"], stats["media"], stats["personal_meta"],
             stats["spam"], stats["low"]))
    if stats["meta_fail"]:
        print("  （%d 个站点抓不到首页元信息，按域名规则保留）" % stats["meta_fail"])

    if not picked:
        print("\n没有新的合格站点（可能是今天榜单都被收录过了）。")
        return 0

    print("\n【3】候选站点")
    for dom, item in picked:
        print("  %-34s %s" % (dom[:34], (item["title"] or "")[:44]))

    if dry:
        print("\n--dry 模式，未写入文件。")
        return 0

    print("\n【4】写入")
    today = datetime.date.today().isoformat()
    entries = []
    for dom, item in picked:
        name = item["title"] or dom
        # 标题里带站点名的，用域名作为展示名更干净
        label = dom.split(".")[0].replace("-", " ").title()
        if len(label) < 2 or len(label) > 26:
            label = dom
        # 收录的 URL 统一用站点首页 —— 用户要的是「这个网站」，
        # 不是榜单上那篇文章。榜单标题另存为 hotTitle，作为「为什么火」。
        target = "https://" + dom
        entries.append({
            "domain": dom,
            "name": label,
            # 站点自己的名称（来自首页 title，最准确）
            "siteTitle": (item.get("metaTitle") or label)[:90],
            # 榜单上的原始标题 —— 说明「它为什么今天火」
            "hotTitle": (item["title"] or "")[:120],
            "url": target,
            "category": classify(dom, item.get("metaTitle") or item["title"],
                                 item["sourceKey"]),
            "points": item.get("points", 0),
            "comments": item.get("comments", 0),
            "source": item["source"],
            "sourceKey": item["sourceKey"],
            "date": today,
        })
        history[dom] = {"date": today, "source": item["source"],
                        "hits": 1, "lastSeen": today}

    payload = {
        "date": today,
        "generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "entries": entries,
    }
    js = ("/**\n"
          " * trending.js — 热点站点（每日自动更新，由 tools/fetch-trending.py 生成）\n"
          " *\n"
          " * 与 data.js 的分工：\n"
          " *   data.js     人工精选的长期保留站点，是站点质量的主体\n"
          " *   trending.js 每日从公开榜单抓取的新发现站点，标注来源与热度\n"
          " *\n"
          " * 勿手改本文件 —— 下次采集会整体覆盖。\n"
          " */\n"
          "window.TRENDING_DATA = " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n")
    io.open(OUT_FILE, "w", encoding="utf-8", newline="\n").write(js)
    save_history(history)
    print("  已写入 %s（%d 个站点）" % (os.path.relpath(OUT_FILE, ROOT), len(entries)))
    print("  历史记录 %s（累计 %d 个域名）" % (os.path.relpath(HISTORY_FILE, ROOT), len(history)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
