# -*- coding: utf-8 -*-
"""
split-legal-pages.py — 从 legal.html 拆出独立的 About / Contact / Privacy / Disclaimer 页面

为什么需要：
  Google AdSense 的人工审核会逐个检查 About、Contact、Privacy Policy 这几个页面。
  官方资格要求里它们是"必查项"，缺失或只是别的页面的锚点，都会被判为「缺少必需页面」。

为什么用脚本拆而不是手写：
  legal.html 是四语（中英日韩）× 五个章节的大文件，手抄必然出现两份内容不一致。
  拆出来的页面与 legal.html 保持一字不差，日后改一处、跑一次即可同步。

用法：python tools/split-legal-pages.py
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGAL = os.path.join(ROOT, "legal.html")
BASE = "https://ypage.ccwu.cc"

# 页面定义：输出文件名 → (legal.html 里的 section id, 浏览器标题, 描述, 面包屑导航项)
PAGES = [
    ("about.html", "about",
     "关于本站 · 全球黄页",
     "全球黄页是什么、由谁运营、收录标准是什么、票数如何统计。站长自述与建站动机。",
     "关于本站"),
    ("privacy.html", "privacy",
     "隐私政策 · 全球黄页",
     "全球黄页收集哪些信息、Cookie 与第三方服务、广告与 Google AdSense、GDPR 与 CCPA 权利、儿童隐私、数据保留期限。",
     "隐私政策"),
    ("disclaimer.html", "disclaimer",
     "免责声明 · 全球黄页",
     "全球黄页对所收录第三方网站的内容、准确性与可用性不作担保；版权归属说明。",
     "免责声明"),
    ("contact.html", "contact",
     "联系我们 · 全球黄页",
     "联系全球黄页站长：网站收录申请、问题反馈、版权与侵权投诉。",
     "联系我们"),
]

# 页面底部导航（其余页面 + legal.html 汇总页）
NAV_ITEMS = [
    ("/about.html", "关于本站"),
    ("/privacy.html", "隐私政策"),
    ("/disclaimer.html", "免责声明"),
    ("/contact.html", "联系我们"),
    ("/legal.html", "全部条款"),
]


def read_legal():
    return io.open(LEGAL, encoding="utf-8").read()


def extract_section(html, sec_id):
    """抽出 legal.html 里 <section class="legal-sec" id="xxx"> ... </section> 的内容"""
    # 定位起始标签
    m = re.search(r'<section class="legal-sec" id="%s">' % re.escape(sec_id), html)
    if not m:
        raise SystemExit("[失败] legal.html 里找不到 section#%s" % sec_id)
    # 从该处开始找配对的 </section>（这些 section 内部没有嵌套 section）
    start = m.start()
    end = html.find("</section>", start)
    if end < 0:
        raise SystemExit("[失败] section#%s 没有闭合" % sec_id)
    return html[start:end + len("</section>")]


def extract_head(html):
    """取出 <head> 里的样式块与 head 标签（去掉 SEO 注入块）"""
    m = re.search(r"<head[^>]*>(.*?)</head>", html, re.S)
    if not m:
        raise SystemExit("[失败] legal.html 里找不到 head")
    return m.group(1)


def extract_body_open(html):
    """只取 <body> 开标签。legal.html 自带的头部（标题、导航栏、语言切换器）
    不适合直接搬到独立页——那些导航指向的是 legal.html 的锚点，
    在独立页上会变成死链。独立页另起一套精简头部。"""
    m = re.search(r"(<body[^>]*>)", html)
    if not m:
        raise SystemExit("[失败] legal.html 结构异常，找不到 body")
    return m.group(1), ""


HEAD_EXTRA = """
  <style>
    /* 独立页面：顶栏 + 面包屑 + 内容区 */
    .lp-top {
      max-width:860px; margin:0 auto; padding:18px 16px 0;
      display:flex; align-items:center; gap:12px; flex-wrap:wrap;
    }
    .lp-top .lp-logo { font-size:17px; font-weight:600; text-decoration:none; color:var(--text); }
    .lp-top .lp-logo span { font-size:11px; color:var(--muted); font-weight:400; margin-left:8px; }
    .lp-crumbs {
      max-width:860px; margin:0 auto; padding:14px 16px 0; font-size:13px; color:var(--muted);
    }
    .lp-crumbs a { color:var(--accent); text-decoration:none; }
    .lp-crumbs a:hover { text-decoration:underline; }
    .lp-crumbs .sep { margin:0 7px; opacity:.5; }
    .lp-nav {
      max-width:860px; margin:0 auto; padding:26px 16px 60px;
      border-top:1px solid var(--line); margin-top:34px;
    }
    .lp-nav h3 { font-size:13px; color:var(--muted); font-weight:500; margin:0 0 12px; }
    .lp-nav ul { list-style:none; display:flex; flex-wrap:wrap; gap:8px; padding:0; margin:0; }
    .lp-nav a {
      display:inline-block; padding:6px 14px; border-radius:999px; font-size:13.5px;
      border:1px solid var(--line); color:var(--text); text-decoration:none; background:var(--card);
    }
    .lp-nav a:hover { border-color:var(--accent); color:var(--accent); }
    .lp-nav a.on { background:var(--accent); border-color:var(--accent); color:#fff; }
  </style>
"""


def build_page(legal_html, sec_id, title, desc, crumb_label, self_href):
    head = extract_head(legal_html)
    body_open, body_mid = extract_body_open(legal_html)
    section = extract_section(legal_html, sec_id)

    # 去掉 legal.html 里的 SEO 注入块（canonical 等），换成各自的
    head = re.sub(r"<!-- SEO:START.*?<!-- SEO:END -->", "", head, flags=re.S)
    head = re.sub(r'<link rel="canonical"[^>]*>', "", head)

    # 先移除 legal.html 自带的 title 与 description（否则会覆盖我们自己的）
    head = re.sub(r"<title>.*?</title>", "", head, flags=re.S)
    head = re.sub(r'<meta name="description"[^>]*>', "", head)

    # head 里补上本页面自己的 meta 与样式
    extra_head = (
        '  <title>%s</title>\n'
        '  <meta name="description" content="%s">\n'
        '  <link rel="canonical" href="%s/%s">\n'
        '  <meta name="robots" content="index, follow">\n'
        '  <meta property="og:type" content="website">\n'
        '  <meta property="og:site_name" content="全球黄页">\n'
        '  <meta property="og:title" content="%s">\n'
        '  <meta property="og:description" content="%s">\n'
        '  <meta property="og:url" content="%s/%s">\n'
        '  <meta property="og:image" content="%s/assets/img/og-cover.png">\n'
        '  <meta name="twitter:card" content="summary_large_image">\n'
        '%s'
    ) % (title, desc, BASE, self_href, title, desc, BASE, self_href, BASE, HEAD_EXTRA)

    # body：保留 legal.html 的公共头部（含返回首页等），但去掉最外层容器重复的标题区
    nav_html = []
    for href, label in NAV_ITEMS:
        cls = " class=\"on\"" if href == "/" + self_href else ""
        nav_html.append('      <li><a href="%s"%s>%s</a></li>' % (href, cls, label))
    nav = ('\n  <nav class="lp-nav">\n    <h3>相关页面</h3>\n    <ul>\n'
           '      <li><a href="/about-long.html" class="on">站长长文（完整版）</a></li>\n'
           + "\n".join(nav_html) + "\n    </ul>\n  </nav>\n")

    html = (
        '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n'
        + head +
        extra_head +
        '</head>\n' + body_open +
        '\n  <nav class="lp-top">\n'
        '    <a class="lp-logo" href="/">🧭 全球黄页<span>优质网站导航与口碑库</span></a>\n'
        '  </nav>\n'
        '  <div class="lp-crumbs">\n'
        '    <a href="/">首页</a><span class="sep">›</span>'
        '<a href="/legal.html">法律条款</a><span class="sep">›</span>' + crumb_label + '\n'
        '  </div>\n'
        '\n  <main class="legal-wrap">\n'
        + section + '\n'
        '  </main>\n' + nav +
        '</body>\n</html>\n'
    )
    return html


def main():
    legal = read_legal()
    made = []
    for fname, sec_id, title, desc, crumb in PAGES:
        try:
            out = build_page(legal, sec_id, title, desc, crumb, fname)
        except SystemExit as e:
            print(str(e))
            return 1
        path = os.path.join(ROOT, fname)
        io.open(path, "w", encoding="utf-8", newline="\n").write(out)
        # 粗略统计一下产物的可读文字量
        text = re.sub(r"<style.*?</style>", "", out, flags=re.S)
        text = re.sub(r"<script.*?</script>", "", text, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
        lat = len(re.findall(r"[A-Za-z]+", text))
        made.append((fname, cjk + lat))
        print("  生成 %-16s 可读文字约 %d 字" % (fname, cjk + lat))

    print("\n完成。已生成 %d 个独立页面：" % len(made))
    for f, n in made:
        print("  /%s（%d 字）" % (f, n))
    print("\n提醒：这些页面还需在 legal.html 顶部加互链，并在 sitemap.xml 中登记。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
