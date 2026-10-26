# -*- coding: utf-8 -*-
"""
生成中文站名的拼音索引，写回 assets/js/data.js 的 PY-TABLE 标记段。

用途：用户用拼音搜中文站名（输入 tengxun 命中「腾讯」）。
构建期算好，运行时零依赖。

用法：python tools/gen-pinyin.py
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "assets", "js", "data.js")

START = "/* PY-TABLE:START */"
END = "/* PY-TABLE:END */"

try:
    from pypinyin import lazy_pinyin, Style
except ImportError:
    print("[失败] 缺少 pypinyin，先执行：python -m pip install pypinyin")
    sys.exit(1)


def load_names():
    """用 Node 求值 data.js，取出全部站点名"""
    script = (
        "const fs=require('fs');global.window={};"
        "eval(fs.readFileSync('%s','utf8'));"
        "console.log(JSON.stringify(window.SITE_DATA.map(s=>s.name)));"
        % DATA_FILE.replace("\\", "/")
    )
    r = subprocess.run(["node", "-e", script], capture_output=True, timeout=60)
    if r.returncode != 0:
        print("[失败] Node 解析 data.js：%s" % r.stderr.decode("utf-8", "ignore")[:200])
        return []
    return json.loads(r.stdout.decode("utf-8", "ignore"))


def pinyin_of(name):
    """返回 '全拼 首字母'；纯英文名不含中文则返回空串（英文本身可搜）"""
    if not re.search(r"[\u4e00-\u9fff]", name):
        return ""
    full = "".join(lazy_pinyin(name, errors=lambda x: x))
    ini = "".join(lazy_pinyin(name, style=Style.FIRST_LETTER, errors=lambda x: x))
    full = re.sub(r"[^a-z0-9]", "", full.lower())
    ini = re.sub(r"[^a-z0-9]", "", ini.lower())
    if not full:
        return ""
    return full if full == ini else full + " " + ini


def main():
    names = load_names()
    if not names:
        print("[失败] 没读到站点数据")
        return 1
    table = {}
    for n in names:
        p = pinyin_of(n)
        if p:
            table[n] = p
    print("含中文站名 %d 个，生成拼音 %d 条" % (
        len([n for n in names if re.search(r"[\u4e00-\u9fff]", n)]), len(table)))

    # 单行紧凑输出，避免 data.js 膨胀；JSON 保证转义正确
    body = START + "\nwindow.PY_NAME = " + json.dumps(
        table, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + ";\n" + END

    src = open(DATA_FILE, encoding="utf-8").read()
    if START not in src or END not in src:
        print("[失败] data.js 缺少 PY-TABLE 标记段")
        return 1
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: body, src, flags=re.S)
    if new == src:
        print("无变化（拼音索引已是最新）")
        return 0
    open(DATA_FILE, "w", encoding="utf-8", newline="").write(new)
    print("已写入 data.js（%d 条）" % len(table))
    return 0


if __name__ == "__main__":
    sys.exit(main())
