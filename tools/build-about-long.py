# -*- coding: utf-8 -*-
"""
build-about-long.py — 把 about-long.md（纯 Markdown 源）转成 about-long.html

为什么用 Markdown 源：文章很长，Markdown 便于编辑与版本管理；
但站点上要的是语义化 HTML（AdSense 审核看的是渲染后的内容）。

这个脚本只支持文章里用到的少量语法，刻意做得窄：
  # 一级标题 → <h1>
  ## 二级标题 → <h2>
  ### 三级标题 → <h3>
  **加粗** → <strong>
  > 引用块 → <blockquote>
  --- 分隔线 → <hr>
  - 列表项 → <li>（连续的 - 行合并进同一个 <ul>）
  [文字](链接) → <a>
  其余按段落处理

用法：python tools/build-about-long.py
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "about-long.md")
OUT = os.path.join(ROOT, "about-long.html")
BASE = "https://ypage.ccwu.cc"

CSS = """
  :root { --bg:#f5f6f8; --card:#fff; --line:#e4e6eb; --text:#1d1d1f; --text2:#48484a;
          --muted:#86868b; --accent:#0071e3; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
         background:var(--bg); color:var(--text); line-height:1.85; padding:0 0 70px; }
  .wrap { max-width:760px; margin:0 auto; padding:0 20px; }
  .top { max-width:760px; margin:0 auto; padding:20px 20px 0; display:flex; align-items:center; gap:12px; }
  .top a { color:var(--text); text-decoration:none; font-size:17px; font-weight:600; }
  .top a span { font-size:11px; color:var(--muted); font-weight:400; margin-left:8px; }
  .crumbs { max-width:760px; margin:0 auto; padding:16px 20px 0; font-size:13px; color:var(--muted); }
  .crumbs a { color:var(--accent); text-decoration:none; }
  .crumbs .sep { margin:0 7px; opacity:.5; }
  article { max-width:760px; margin:0 auto; padding:30px 20px 0; }
  h1 { font-size:32px; line-height:1.3; margin:0 0 8px; letter-spacing:-.01em; }
  .lede { font-size:16px; color:var(--muted); margin:0 0 34px; padding-bottom:26px; border-bottom:1px solid var(--line); }
  h2 { font-size:21px; margin:38px 0 12px; line-height:1.45; }
  h3 { font-size:16.5px; margin:24px 0 8px; color:var(--text); }
  p { margin:0 0 15px; color:var(--text2); font-size:15.5px; }
  strong { color:var(--text); font-weight:600; }
  ul { margin:0 0 16px; padding-left:22px; }
  li { color:var(--text2); font-size:15.5px; margin:0 0 6px; }
  blockquote { margin:0 0 18px; padding:10px 0 10px 16px; border-left:3px solid var(--accent);
               color:var(--muted); font-size:14.5px; }
  hr { border:0; border-top:1px solid var(--line); margin:34px 0; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  .foot { max-width:760px; margin:34px auto 0; padding:22px 20px 0; border-top:1px solid var(--line);
          font-size:13px; color:var(--muted); }
  .foot a { color:var(--accent); text-decoration:none; }
  .nav { max-width:760px; margin:30px auto 0; padding:0 20px; display:flex; flex-wrap:wrap; gap:8px; }
  .nav a { padding:6px 14px; border-radius:999px; border:1px solid var(--line); background:var(--card);
           color:var(--text); text-decoration:none; font-size:13.5px; }
  .nav a:hover { border-color:var(--accent); color:var(--accent); }
  @media (prefers-color-scheme:dark) {
    :root { --bg:#0a0d1c; --card:#151a2e; --line:rgba(255,255,255,.1); --text:#f5f5f7;
            --text2:#c7c7cc; --muted:#98989d; }
    h2, h3, strong { color:var(--text); }
  }
"""


def inline(text):
    """行内 Markdown → HTML"""
    # 先把链接抽出来，避免后续替换破坏 URL
    links = []

    def keep(m):
        links.append(m.group(0))
        return "\x00%d\x00" % (len(links) - 1)

    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", keep, text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    for i, l in enumerate(links):
        m = re.match(r"\[([^\]]+)\]\(([^)]+)\)", l)
        text = text.replace("\x00%d\x00" % i,
                            '<a href="%s" target="_blank" rel="noopener">%s</a>' % (m.group(2), m.group(1)))
    return text


def convert(md):
    lines = md.split("\n")
    out = []
    in_ul = False
    first_h1 = True

    for raw in lines:
        line = raw.rstrip()

        if not line.strip():
            if in_ul:
                out.append("</ul>")
                in_ul = False
            continue

        # 分隔线
        if re.match(r"^-{3,}\s*$", line):
            if in_ul:
                out.append("</ul>")
                in_ul = False
            out.append("<hr>")
            continue

        # 标题
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            lvl = len(m.group(1))
            txt = inline(m.group(2))
            if lvl == 1 and first_h1:
                out.append("<h1>%s</h1>" % txt)
                # lede 用正文第一段的内容，别再单独写一句重复的
                first_h1 = False
            else:
                out.append("<h%d>%s</h%d>" % (lvl, txt, lvl))
            continue

        # 引用
        if line.startswith("> "):
            if in_ul:
                out.append("</ul>")
                in_ul = False
            out.append("<blockquote>%s</blockquote>" % inline(line[2:].strip()))
            continue

        # 列表
        m = re.match(r"^-\s+(.*)$", line)
        if m:
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append("<li>%s</li>" % inline(m.group(1)))
            continue

        if in_ul:
            out.append("</ul>")
            in_ul = False

        # 普通段落
        out.append("<p>%s</p>" % inline(line.strip()))

    if in_ul:
        out.append("</ul>")
    return "\n".join(out)


def main():
    if not os.path.exists(SRC):
        print("[失败] 找不到 %s" % SRC)
        return 1
    md = io.open(SRC, encoding="utf-8").read()
    body = convert(md)

    html = (
        '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<title>关于本站 · 全球黄页</title>\n'
        '<meta name="description" content="全球黄页是什么、由谁运营、收录标准是什么、'
        '票数如何统计、隐私上做了什么取舍、怎么防刷票。站长自述与建站动机。">\n'
        '<link rel="canonical" href="%s/about-long.html">\n'
        '<meta name="robots" content="index, follow">\n'
        '<meta property="og:type" content="article">\n'
        '<meta property="og:site_name" content="全球黄页">\n'
        '<meta property="og:title" content="关于本站 · 全球黄页">\n'
        '<meta property="og:description" content="站长自述：建站动机、收录标准、隐私取舍与防刷机制。">\n'
        '<meta property="og:url" content="%s/about-long.html">\n'
        '<meta property="og:image" content="%s/assets/img/og-cover.png">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        '<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🧭</text></svg>">\n'
        '<style>%s</style>\n'
        '</head>\n<body>\n'
        '  <nav class="top">\n'
        '    <a href="/">🧭 全球黄页<span>优质网站导航与口碑库</span></a>\n'
        '  </nav>\n'
        '  <div class="crumbs"><a href="/">首页</a><span class="sep">›</span>'
        '<a href="/about.html">关于本站</a><span class="sep">›</span>站长自述</div>\n'
        '  <article>\n%s\n  </article>\n'
        '  <nav class="nav">\n'
        '    <a href="/">← 回到首页</a>\n'
        '    <a href="/about.html">关于本站（摘要）</a>\n'
        '    <a href="/privacy.html">隐私政策</a>\n'
        '    <a href="/contact.html">联系我们</a>\n'
        '    <a href="/sites.html">全站索引</a>\n'
        '  </nav>\n'
        '  <div class="foot">\n'
        '    本文提到的所有第三方站点版权归各自所有者所有，本站仅作导航索引与使用参考。<br>\n'
        '    站长邮箱：<a href="mailto:Huoyld@163.com">Huoyld@163.com</a> ｜ 回应时间：一般 7 个工作日内\n'
        '  </div>\n'
        '</body>\n</html>\n'
    ) % (BASE, BASE, BASE, CSS, body)

    io.open(OUT, "w", encoding="utf-8", newline="\n").write(html)

    text = re.sub(r"<[^>]+>", " ", re.sub(r"<style.*?</style>", "", html, flags=re.S))
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    lat = len(re.findall(r"[A-Za-z]+", text))
    print("生成 about-long.html —— 可读文字约 %d 字" % (cjk + lat))
    print("  段落 %d 个，标题 %d 个，列表项 %d 个"
          % (html.count("<p>"), html.count("<h2>") + html.count("<h3>"), html.count("<li>")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
