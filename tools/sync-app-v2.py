#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync-app-v2.py — 由 app.js 生成 app-v2.js（V2 科技感皮肤）

两版首页共用同一套逻辑，只在配色上不同，所以 app-v2.js 不是手写的，
而是 app.js 套一层配色替换生成——改逻辑时只改 app.js，然后跑这个脚本。
（历史上因为两边各改各的，出现过 V1 改了 V2 没改的行为分叉，
  tools/verify-parity.js 就是为抓这种情况写的。）

配色映射（V1 苹果风 → V2 霓虹风）：
    #34c759 → #00e5a0   赞
    #ff3b30 → #ff4d6d   踩
    #ff9f0a → #ffb340   无法访问

用法：
    python tools/sync-app-v2.py          # 生成并覆盖 app-v2.js
    python tools/sync-app-v2.py --check  # 只检查是否已是最新（CI 用）
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "js", "app.js")
DST = os.path.join(ROOT, "assets", "js", "app-v2.js")

COLOR_MAP = [
    ("#34c759", "#00e5a0"),
    ("#ff3b30", "#ff4d6d"),
    ("#ff9f0a", "#ffb340"),
]


def build():
    """app.js → app-v2.js：只把 VOTE_TYPES 那一块的配色换成霓虹色。

    注意替换范围**必须限定在 VOTE_TYPES 块内**：图表条与图例的配色
    两版一致（V2 的霓虹观感来自 CSS，不是 JS），全局替换会让
    tools/verify-parity.js 的行为块比对失败。
    """
    src = io.open(SRC, encoding="utf-8", newline="").read()
    start = src.find("const VOTE_TYPES = [")
    if start < 0:
        raise SystemExit("[失败] app.js 里找不到 VOTE_TYPES 定义")
    end = src.find("];", start)
    if end < 0:
        raise SystemExit("[失败] VOTE_TYPES 块没有正常结束")
    end += 2
    head, block, tail = src[:start], src[start:end], src[end:]
    for a, b in COLOR_MAP:
        block = block.replace(a, b)
    return head + block + tail


def main():
    check = "--check" in sys.argv
    out = build()
    # 读取时不能用默认换行模式（会把 CRLF 统一转成 LF，导致误判不同步）
    cur = io.open(DST, encoding="utf-8", newline="").read() if os.path.isfile(DST) else ""
    if check:
        if cur == out:
            print("app-v2.js 已是最新")
            return 0
        print("app-v2.js 与 app.js 不同步，跑 python tools/sync-app-v2.py 修正")
        return 1
    io.open(DST, "w", encoding="utf-8", newline="").write(out)
    n = sum(1 for a, _ in COLOR_MAP if a in io.open(SRC, encoding="utf-8", newline="").read())
    print("已生成 assets/js/app-v2.js（%d B，VOTE_TYPES 配色替换 %d 项）"
          % (len(out.encode("utf-8")), n))
    return 0


if __name__ == "__main__":
    sys.exit(main())
