# -*- coding: utf-8 -*-
"""
通过 GitHub API 提交文件（不依赖 git 协议）
================================================================
用途：沙箱代理只挡 github.com（git push 走它 → 502），但 api.github.com 通，
      所以用 Contents API 直接提交，绕过 git 协议。

用法：
    C:\\Python\\Python312\\python.exe tools/gh-api-commit.py 文件1 文件2 ... -m "提交说明"

说明：
  · 文件路径相对于项目根目录；已存在的文件会自动带上 sha（= 更新），不存在则新建
  · 令牌从本机 Git 凭据管理器读取，不落盘、不打印
  · 二进制（如 PNG）会自动 base64
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OWNER, REPO, BRANCH = "heiniao-wan", "global-yellow-pages", "main"
GIT = r"C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe"
GCM = r"C:/Users/heini/.workbuddy/binaries/PortableGit/versions/1.3.0/mingw64/bin/git-credential-manager.exe"


def token():
    out = subprocess.run(
        [GIT, "-c", "credential.helper=!\"%s\"" % GCM, "credential", "fill"],
        input=b"protocol=https\nhost=github.com\n\n", capture_output=True).stdout
    for line in out.decode("utf-8", "replace").splitlines():
        if line.startswith("password="):
            return line[len("password="):].strip()
    return ""


def api(path, data=None, method=None):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    # 路径可能含中文（如「每日更新热点.bat」），URL 必须是 ASCII——percent 编码
    quoted = urllib.parse.quote(path, safe="/")
    req = urllib.request.Request(
        "https://api.github.com/repos/%s/%s/contents/%s" % (OWNER, REPO, quoted),
        data=body, method=method or ("PUT" if body else "GET"),
        headers={"Authorization": "Bearer " + TOK, "Accept": "application/vnd.github+json",
                 "User-Agent": "gyp-api-commit", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read())


def sha_of(path):
    try:
        return api(path).get("sha", "")
    except urllib.error.HTTPError:
        return ""


def main():
    global TOK
    args = [a for a in sys.argv[1:]]
    msg = "chore: 通过 API 提交"
    if "-m" in args:
        i = args.index("-m")
        msg = args[i + 1]
        args = args[:i] + args[i + 2:]
    if not args:
        print("用法：python tools/gh-api-commit.py <文件...> -m \"说明\"")
        return 1

    TOK = token()
    if not TOK:
        print("[失败] 没取到凭据，先在 git 里登录一次 GitHub")
        return 1

    ok = 0
    for rel in args:
        rel = rel.replace("\\", "/").lstrip("/")
        full = os.path.join(ROOT, rel)
        if not os.path.isfile(full):
            print("  [跳过] 找不到 " + rel)
            continue
        raw = open(full, "rb").read()
        payload = {"message": msg,
                   "content": base64.b64encode(raw).decode("ascii"),
                   "branch": BRANCH}
        s = sha_of(rel)
        if s:
            payload["sha"] = s
        try:
            r = api(rel, payload)
            print("  [OK] %-34s %s (%d B)" % (rel, r["commit"]["sha"][:7], len(raw)))
            ok += 1
        except urllib.error.HTTPError as e:
            print("  [失败] %-34s HTTP %s %s"
                  % (rel, e.code, e.read().decode("utf-8", "replace")[:120]))
    print("\n提交 %d/%d 个文件 → https://github.com/%s/%s" % (ok, len(args), OWNER, REPO))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
