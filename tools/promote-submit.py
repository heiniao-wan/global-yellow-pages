# -*- coding: utf-8 -*-
"""
对外推送：让搜索引擎尽快收录（免登录部分）
================================================================
1) IndexNow —— 一次提交，同步给 Bing / Yandex / Seznam / Naver / Yep
   前提：站点根目录放了 <key>.txt（内容就是 key 本身）
2) sitemap ping —— Bing / Yandex 的收录通道

Google 不走 IndexNow，必须在 Search Console 里手动提交（需登录），脚本会提示你。

运行：
    C:\\Python\\Python312\\python.exe tools/promote-submit.py
    C:\\Python\\Python312\\python.exe tools/promote-submit.py --host ypage.ccwu.cc --key 你的key
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (compatible; GlobalYellowPages/1.0)"}


def find_key():
    for f in glob.glob(os.path.join(ROOT, "*.txt")):
        name = os.path.basename(f)[:-4]
        if len(name) == 32 and all(c in "0123456789abcdef" for c in name):
            try:
                content = open(f, encoding="utf-8").read().strip()
            except Exception:  # noqa: BLE001
                continue
            if content == name:
                return name
    return ""


def post_indexnow(host, key, urls):
    payload = {
        "host": host,
        "key": key,
        "keyLocation": "https://%s/%s.txt" % (host, key),
        "urlList": urls,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow", data=body, method="POST",
        headers={"Content-Type": "application/json; charset=utf-8", **UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:200]
    except Exception as e:  # noqa: BLE001
        return -1, str(e)


def ping(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:  # noqa: BLE001
        return -1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="ypage.ccwu.cc")
    ap.add_argument("--key", default="")
    a = ap.parse_args()
    host = a.host
    key = a.key or find_key()

    urls = ["https://%s/" % host,
            "https://%s/sites.html" % host,
            "https://%s/index-v2.html" % host]
    # 分类独立页：Bing 零收录时靠主动推送能显著加快抓取
    cat_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cat")
    if os.path.isdir(cat_dir):
        for fn in sorted(os.listdir(cat_dir)):
            if fn.endswith(".html"):
                urls.append("https://%s/cat/%s" % (host, fn))

    print("目标站点：https://%s/" % host)
    print("IndexNow key：%s\n" % (key or "(未找到 —— 先在根目录放 <key>.txt)"))

    if key:
        code, txt = post_indexnow(host, key, urls)
        flag = "OK" if code in (200, 202) else "FAIL"
        print("  [%s] IndexNow（Bing / Yandex / Seznam / Naver / Yep）→ HTTP %s %s"
              % (flag, code, txt))
        # Yandex 自己也收一份
        code2, _ = post_indexnow("https://yandex.com/indexnow", key, urls) if False else (0, "")
    else:
        print("  [跳过] IndexNow：缺少 key 文件")

    sm = urllib.parse.quote("https://%s/sitemap.xml" % host, safe="")
    # Bing 官方已于 2023 年左右下线 /ping?sitemap 接口，返回 410 属预期，
    # IndexNow（上面的 200）才是现在给 Bing 递交 URL 的正确通道，故此处只作提示不算失败。
    code = ping("https://www.bing.com/ping?sitemap=" + sm)
    if code == 410:
        print("  [--] %-22s → 接口已废弃（Bing 不再支持 ping，"
              "上面的 IndexNow 才是有效通道）" % "Bing sitemap ping")
    else:
        print("  [%s] %-22s → HTTP %s" % ("OK" if code == 200 else "FAIL",
                                           "Bing sitemap ping", code))

    yc = ping("https://webmaster.yandex.com/ping?sitemap=" + sm)
    print("  [%s] %-22s → HTTP %s" % ("OK" if yc == 200 else "FAIL",
                                       "Yandex sitemap ping", yc))

    print("\nGoogle 不走 IndexNow，需你在 Search Console 手动做一次（2 分钟）：")
    print("  1) https://search.google.com/search-console  用 Google 账号登录")
    print("  2) 添加资源 → 「网址前缀」填 https://%s/" % host)
    print("  3) 验证所有权（推荐 HTML 文件 / DNS 记录方式）")
    print("  4) 左侧「站点地图」提交 sitemap.xml；「网址检查」输入首页 → 请求编入索引")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
