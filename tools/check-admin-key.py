#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check-admin-key.py — 校验管理员密钥能不能打开留言后台

后台页面（admin.html）只有输入框和提示，报错信息笼统——这里把
「密钥对不对」和「KV 绑没绑」两种情况分开报，省得在浏览器里猜。

用法：
    python tools/check-admin-key.py "你的密钥"
    python tools/check-admin-key.py "你的密钥" --url https://ypage.ccwu.cc

返回码：0 = 通过；1 = 密钥不对或未配置；2 = 密钥正确但 KV 未绑定
"""

import io
import json
import ssl
import sys
import urllib.request
import urllib.error

DEFAULT_URL = "https://ypage.ccwu.cc"

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE
_OPENER = urllib.request.build_opener(
    urllib.request.HTTPSHandler(context=_SSL_CTX),
    urllib.request.ProxyHandler({}),
)


def check(key, base):
    url = base.rstrip("/") + "/api/messages"
    # 必须带浏览器 UA：Cloudflare 的浏览器完整性检查会把 python-urllib
    # 默认 UA（python-requests/urllib）判成机器人直接 403 错误码 1010
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + key,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "application/json",
    })
    try:
        with _OPENER.open(req, timeout=30) as r:
            body = r.read().decode("utf-8", "ignore")
            data = json.loads(body)
            n = len(data.get("messages") or [])
            print("[通过] 密钥正确，后台可访问")
            print("       当前留言 %d 条" % n)
            return 0
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        try:
            err = (json.loads(body) or {}).get("error", "")
        except Exception:
            err = ""
        if e.code == 401:
            print("[失败] HTTP 401 —— 密钥不匹配，或线上还没配置 ADMIN_KEY")
            print("       去 Cloudflare：Workers 和 Pages → 项目 → 设置 → 变量和机密")
            print("       注意「生产」和「预览」是两个独立标签页，两个都要有 ADMIN_KEY")
            print("       改完必须：部署 → ⋯ → 重新部署")
            return 1
        if e.code == 503:
            print("[通过] 密钥正确，但 KV 命名空间没绑（HTTP 503）")
            print("       去 Cloudflare：Workers 和 Pages → 项目 → 设置 → 绑定")
            print("       变量名填 MESSAGES，值选你创建的 KV 命名空间")
            return 2
        print("[失败] HTTP %s %s" % (e.code, err or body[:120]))
        return 1
    except Exception as e:
        print("[失败] 请求异常：%s" % str(e)[:120])
        return 1


def gen():
    """生成一个 24 位强密钥并打印。

    为什么不直接在这里给用户一个现成的：密钥一旦出现在聊天记录/日志里，
    就算只有管理员能看到，也不如「只存在于你的密码管理器」干净。
    让脚本生成、你亲手复制到 Cloudflare 和密码管理器，全程不经过第三方。
    """
    import random
    import string
    al = string.ascii_letters + string.digits
    key = "".join(random.choice(al) for _ in range(24))
    print("新密钥（请复制到 Cloudflare 与你的密码管理器）：")
    print("    " + key)
    print()
    print("接下来：")
    print("  1. Cloudflare → Workers 和 Pages → 项目 → 设置 → 变量和机密")
    print("  2. 「生产」标签页：ADMIN_KEY（若已有就编辑成新值）")
    print("  3. 「预览」标签页：同样加/改 ADMIN_KEY（两个是独立标签页）")
    print("  4. 部署 → ⋯ → 重新部署")
    print("  5. 回来执行：python tools/check-admin-key.py \"上面的密钥\"")
    return 0


def main():
    args = sys.argv[1:]
    base = DEFAULT_URL
    if "--url" in args:
        i = args.index("--url")
        base = args[i + 1]
        args = args[:i] + args[i + 2:]
    if "--gen" in args:
        return gen()
    if not args:
        print("用法：python tools/check-admin-key.py \"你的密钥\" [--url %s]" % DEFAULT_URL)
        print("      python tools/check-admin-key.py --gen    # 生成一个新密钥")
        return 1
    key = args[0].strip()
    if key != args[0]:
        print("[提示] 已自动去掉首尾空格")
    return check(key, base)


if __name__ == "__main__":
    sys.exit(main())
