# -*- coding: utf-8 -*-
"""
外网可达性检测（不改任何文件，只读）
================================================================
用途：确认推送到 GitHub 的站点，在**完全不登录、纯外网**的条件下能否被读到。

检查项：
  1. 仓库页 / API 是否公开可读
  2. 仓库里每个文件是否都能通过 raw.githubusercontent.com 公开下载（HTTP 200）
  3. 整包 zip 是否可下载（模拟 Cloudflare Pages 拉代码的动作）
  4. 首页 index.html / index-v2.html 里引用的本地资源是否都存在（防 404 断链）
  5. 是否残留本机绝对路径（D:\\... 之类）

运行：
    C:\\Python\\Python312\\python.exe tools\\verify-remote.py
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

OWNER = "heiniao-wan"
REPO = "global-yellow-pages"
BRANCH = "main"
RAW = "https://raw.githubusercontent.com/%s/%s/%s/" % (OWNER, REPO, BRANCH)
API = "https://api.github.com/repos/%s/%s" % (OWNER, REPO)

UA = {"User-Agent": "gyp-remote-check/1.0"}
CTX = ssl.create_default_context()
PASS, FAIL = 0, 0


def head(url, timeout=30, retries=3):
    """HEAD 请求；-1 表示网络抖动，重试几次再下结论"""
    last = -1
    for i in range(retries):
        req = urllib.request.Request(url, headers=UA, method="HEAD")
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
                return r.status, int(r.headers.get("Content-Length") or 0)
        except urllib.error.HTTPError as e:
            return e.code, 0          # 服务器的明确答复，不用重试
        except Exception:             # noqa: BLE001
            last = -1
            if i + 1 < retries:
                time.sleep(1.2 * (i + 1))
    return last, 0


def get(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:  # noqa: BLE001
        return -1, b""


def check(label, ok, extra=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print("  [OK]   %s%s" % (label, (" —— " + extra) if extra else ""))
    else:
        FAIL += 1
        print("  [FAIL] %s%s" % (label, (" —— " + extra) if extra else ""))


def main():
    print("=" * 68)
    print("外网可达性检测：github.com/%s/%s（分支 %s）" % (OWNER, REPO, BRANCH))
    print("=" * 68)

    # 1) 仓库是否公开
    st, body = get(API)
    if st != 200:
        check("仓库公开可读", False, "HTTP %s" % st)
        return 1
    meta = json.loads(body)
    check("仓库公开可读", not meta.get("private"),
          "%s（%s）" % (meta.get("full_name"), "私有" if meta.get("private") else "公开"))

    # 2) 文件清单
    st, body = get(API + "/git/trees/%s?recursive=1" % BRANCH)
    if st != 200:
        check("读取文件树", False, "HTTP %s" % st)
        return 1
    tree = json.loads(body).get("tree", [])
    paths = [t["path"] for t in tree if t.get("type") == "blob"]
    check("读取文件树", True, "%d 个文件" % len(paths))

    # 3) 每个文件逐个 HEAD
    print("\n[1] 逐文件外网下载检测（raw.githubusercontent.com）")
    bad = []
    for p in paths:
        code, size = head(RAW + urllib.parse.quote(p))
        if code != 200:
            bad.append((p, code))
    check("全部文件可公开下载", not bad,
          "%d/%d 通过" % (len(paths) - len(bad), len(paths)))
    for p, c in bad:
        print("          × %s → HTTP %s" % (p, c))

    # 4) 整包 zip（Cloudflare Pages 拉代码就是这个动作）
    print("\n[2] 整包下载检测（模拟 Cloudflare Pages 拉取源码）")
    zip_url = "https://codeload.github.com/%s/%s/zip/refs/heads/%s" % (OWNER, REPO, BRANCH)
    code, size = head(zip_url, timeout=60)
    check("main 分支 zip 可下载", code == 200,
          "HTTP %s%s" % (code, "，%.1f KB" % (size / 1024) if size else ""))

    # 5) 首页引用资源是否齐全
    print("\n[3] 首页引用资源完整性（防外网 404）")
    refs_bad = []
    for page in ("index.html", "index-v2.html"):
        if page not in paths:
            check(page + " 存在", False)
            continue
        st, html = get(RAW + page)
        if st != 200:
            check(page + " 可下载", False, "HTTP %s" % st)
            continue
        txt = html.decode("utf-8", "replace")
        urls = re.findall(r'(?:href|src)\s*=\s*"([^"]+)"', txt)
        local = []
        for u in urls:
            if u.startswith(("http://", "https://", "#", "data:", "mailto:", "javascript:")):
                continue
            local.append(u.split("?")[0].split("#")[0])
        miss = [u for u in dict.fromkeys(local) if u not in paths]
        check("%s 引用资源齐全" % page, not miss,
              "%d 个本地引用" % len(set(local)) if not miss else "缺失：%s" % ", ".join(miss))
        refs_bad += miss

    # 6) 本机绝对路径残留
    print("\n[4] 是否残留本机绝对路径")
    leaks = []
    for page in ("index.html", "index-v2.html", "legal.html", "admin.html"):
        if page not in paths:
            continue
        st, html = get(RAW + page)
        txt = html.decode("utf-8", "replace") if st == 200 else ""
        for m in re.findall(r'[A-Za-z]:\\\\[^\s"\'<>)]+', txt):
            leaks.append((page, m))
        for m in re.findall(r'file:///[^\s"\'<>)]+', txt):
            leaks.append((page, m))
    check("无本机绝对路径外泄", not leaks,
          "干净" if not leaks else "; ".join("%s: %s" % x for x in leaks[:5]))

    print("\n" + "=" * 68)
    print("结果：通过 %d 项，失败 %d 项" % (PASS, FAIL))
    print("=" * 68)
    if FAIL == 0:
        print("结论：站点源码在外网完全可读，随时可接入 Cloudflare Pages / Pages 托管。")
        print("仓库页：https://github.com/%s/%s" % (OWNER, REPO))
        print("源码包：%s" % zip_url)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
