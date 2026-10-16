# -*- coding: utf-8 -*-
"""
GitHub 上传向导 · 全球黄页站点
================================================================
把本地站点上传到「你已在网页登录的 GitHub 账号」，全程向导式：
  每一步都弹提示框 + 输入框，跟着填即可，不需要懂 git 命令。

三种登录方式（第 1 步选择）：
  ① 网页授权（推荐）—— GitHub 官方 Device Flow：
     程序给你一个 8 位码 → 自动打开浏览器 → 你在已登录的 GitHub 页面
     粘贴码、点一下 Authorize → 程序自动拿到授权完成上传。零 PAT。
  ② 个人令牌 PAT —— 你自己填一串令牌（懂行的用）。
  ③ 凭据管理器 GCM —— 弹浏览器 OAuth 授权（Git Credential Manager）。

后续步骤依次收集：仓库信息 → 身份与提交说明 → 网页授权 → 确认 → 执行。
执行阶段实时显示日志，并在关键节点弹提示框告知结果。

运行：
    C:\\Python\\Python312\\python.exe github-uploader.py
自检（不开窗口）：
    C:\\Python\\Python312\\python.exe github-uploader.py --selftest
"""

from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# ─────────────────────────── 基础配置 ───────────────────────────

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT = ("Microsoft YaHei UI", 10)
FONT_B = ("Microsoft YaHei UI", 11, "bold")
FONT_TITLE = ("Microsoft YaHei UI", 13, "bold")
MONO = ("Consolas", 10)

GITHUB_API = "https://api.github.com"
UA = {
    "User-Agent": "global-yellow-pages-uploader/1.0",
    "Accept": "application/vnd.github+json",
}

# Device Flow 的 OAuth App ID。
# 默认用 GitHub 官方 CLI 公开的那一个；想用自己的，设环境变量 GYP_GH_CLIENT_ID，
# 或在弹出的输入框里改（GitHub → Settings → Developer settings → OAuth Apps → 新建）。
CLIENT_ID = os.environ.get("GYP_GH_CLIENT_ID", "Iv1.b507a08c87ecfe98")


def _find_exe(name: str, candidates):
    """按 环境变量 → 已知路径 → PATH 的顺序找可执行文件"""
    for c in candidates:
        if c and os.path.isfile(c):
            return os.path.normpath(c)
    from shutil import which
    found = which(name)
    return found or ""


GIT = _find_exe("git", [
    os.environ.get("GIT_EXE"),
    r"C:\Users\heini\.workbuddy\binaries\PortableGit\versions\current\cmd\git.exe",
    r"C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe",
    r"C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe",
    r"C:\Program Files\Git\cmd\git.exe",
    r"C:\Program Files\Git\bin\git.exe",
])

GCM = ""
if GIT:
    _gcm = os.path.normpath(os.path.join(GIT, "..", "..", "mingw64", "bin",
                                         "git-credential-manager.exe"))
    if os.path.isfile(_gcm):
        GCM = _gcm


def decode_out(raw: bytes) -> str:
    """git 在中文 Windows 上可能输出 GBK，逐个编码尝试"""
    if raw is None:
        return ""
    for enc in ("utf-8", "gbk", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def sh(args, cwd=ROOT, timeout=600):
    """执行一条命令（不经 shell，规避引号问题），返回 (退出码, 输出)"""
    try:
        p = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, timeout=timeout)
        return p.returncode, decode_out(p.stdout)
    except subprocess.TimeoutExpired:
        return -1, "[超时] 命令执行超过 %d 秒" % timeout
    except Exception as e:  # noqa: BLE001
        return -2, "[无法执行] %s" % e


# ─────────────────────────── 网络：Device Flow / API ───────────────────────────

def http_json(url, data=None, method=None, headers=None, timeout=25):
    """发起 HTTP 请求并按 JSON 解析，返回 (状态码, dict|None, 原始文本)"""
    hdr = dict(UA)
    if headers:
        hdr.update(headers)
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        hdr.setdefault("Content-Type", "application/x-www-form-urlencoded")
    req = urllib.request.Request(url, data=body, headers=hdr,
                                 method=method or ("POST" if body else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = decode_out(r.read())
            try:
                return r.status, json.loads(txt), txt
            except ValueError:
                return r.status, None, txt
    except urllib.error.HTTPError as e:
        txt = decode_out(e.read())
        try:
            return e.code, json.loads(txt), txt
        except ValueError:
            return e.code, None, txt
    except Exception as e:  # noqa: BLE001
        return -1, None, str(e)


def device_start():
    """Device Flow 第 1 步：申请设备码"""
    st, js, txt = http_json(
        "https://github.com/login/device/code",
        data={"client_id": CLIENT_ID, "scope": "repo read:user"})
    if st != 200 or not js or "user_code" not in js:
        return None, "申请设备码失败（HTTP %s）：%s" % (st, (js or {}).get("error_description", txt[:200]))
    return js, ""


def device_poll(device_code, interval=5, timeout=600, should_stop=None):
    """Device Flow 第 2 步：轮询换取 access_token"""
    waited = 0
    while waited < timeout:
        if should_stop and should_stop():
            return None, "已取消授权"
        time.sleep(interval)
        waited += interval
        st, js, txt = http_json(
            "https://github.com/login/oauth/access_token",
            data={"client_id": CLIENT_ID, "device_code": device_code,
                  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"})
        if js and js.get("access_token"):
            return js["access_token"], ""
        err = (js or {}).get("error")
        if err and err not in ("authorization_pending", "slow_down"):
            return None, "授权失败：%s —— %s" % (err, (js or {}).get("error_description", txt[:200]))
    return None, "等待授权超时"


def api_get_user(token):
    st, js, _ = http_json(GITHUB_API + "/user",
                          headers={"Authorization": "Bearer " + token})
    if st == 200 and js:
        return js.get("login", ""), ""
    return "", "读取账号失败（HTTP %s）" % st


def api_ensure_repo(token, owner, repo, private, description):
    """仓库存在则返回信息；不存在则创建。返回 (dict, 是否新建, 错误)"""
    st, js, _ = http_json("%s/repos/%s/%s" % (GITHUB_API, owner, repo),
                          headers={"Authorization": "Bearer " + token})
    if st == 200 and js:
        return js, False, ""
    if st != 404:
        return None, False, "查询仓库失败（HTTP %s）" % st
    st, js, txt = http_json(GITHUB_API + "/user/repos",
                            data={"name": repo, "private": "true" if private else "false",
                                  "description": description, "auto_init": "false"},
                            headers={"Authorization": "Bearer " + token})
    if st in (200, 201) and js:
        return js, True, ""
    msg = (js or {}).get("message", txt[:200]) if js else txt[:200]
    return None, False, "创建仓库失败（HTTP %s）：%s" % (st, msg)


# ─────────────────────────── 输入对话框 ───────────────────────────

class InputDialog(tk.Toplevel):
    """通用输入对话框：一次收集若干字段（可指定密码遮蔽）"""

    def __init__(self, parent, title, prompt, fields, note=None, ok_text="确定",
                 banner=None, banner_sub=None):
        super().__init__(parent)
        self.title(title)
        self.result = None
        self.vars = {}
        self.configure(padx=6, pady=6)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        tk.Label(self, text=prompt, font=FONT_B, justify="left",
                 wraplength=460).pack(anchor="w", padx=10, pady=(10, 6))
        if banner:
            # 醒目的设备码，方便照抄到网页上
            tk.Label(self, text=banner, font=("Consolas", 26, "bold"),
                     fg="#0a7d34").pack(pady=(2, 0))
            try:
                self.clipboard_clear()
                self.clipboard_append(banner)   # 自动复制到剪贴板
                tk.Label(self, text="（已自动复制，网页里直接 Ctrl+V 粘贴即可）",
                         font=("Microsoft YaHei UI", 9),
                         fg="#888888").pack()
            except Exception:  # noqa: BLE001
                pass
        if banner_sub:
            tk.Label(self, text=banner_sub, font=("Microsoft YaHei UI", 9),
                     fg="#666666", justify="left",
                     wraplength=460).pack(pady=(4, 0))
        if note:
            tk.Label(self, text=note, font=("Microsoft YaHei UI", 9),
                     fg="#666666", justify="left",
                     wraplength=460).pack(anchor="w", padx=10, pady=(0, 8))

        box = ttk.Frame(self)
        box.pack(fill="x", padx=10)
        for i, (key, label, default, pwd) in enumerate(fields):
            tk.Label(box, text=label, font=FONT).grid(row=i, column=0,
                                                      sticky="w", pady=4)
            v = tk.StringVar(value=default or "")
            e = tk.Entry(box, textvariable=v, width=44, font=FONT,
                         show="*" if pwd else None)
            e.grid(row=i, column=1, sticky="we", pady=4, padx=(8, 0))
            self.vars[key] = v
        box.columnconfigure(1, weight=1)

        bar = ttk.Frame(self)
        bar.pack(fill="x", padx=10, pady=(12, 8))
        ttk.Button(bar, text="取消", command=self._cancel).pack(side="right", padx=4)
        ttk.Button(bar, text=ok_text, command=self._ok).pack(side="right")
        self.bind("<Return>", lambda _e: self._ok())
        self.bind("<Escape>", lambda _e: self._cancel())
        self.protocol("WM_DELETE_WINDOW", self._cancel)
        self.after(120, lambda: self.focus_force())

    def _ok(self):
        self.result = {k: v.get().strip() for k, v in self.vars.items()}
        self.destroy()

    def _cancel(self):
        self.result = None
        self.destroy()


class ChoiceDialog(tk.Toplevel):
    """单选对话框：列出若干选项（含说明），返回选中索引"""

    def __init__(self, parent, title, prompt, options):
        super().__init__(parent)
        self.title(title)
        self.result = None
        self.configure(padx=6, pady=6)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        tk.Label(self, text=prompt, font=FONT_B, justify="left",
                 wraplength=520).pack(anchor="w", padx=10, pady=(10, 8))

        self.var = tk.IntVar(value=0)
        box = ttk.Frame(self)
        box.pack(fill="x", padx=10)
        for i, (label, desc) in enumerate(options):
            rb = ttk.Radiobutton(box, text=label, value=i, variable=self.var)
            rb.grid(row=i * 2, column=0, sticky="w", pady=(6, 0))
            tk.Label(box, text="    " + desc, font=("Microsoft YaHei UI", 9),
                     fg="#666666", justify="left",
                     wraplength=500).grid(row=i * 2 + 1, column=0, sticky="w")

        bar = ttk.Frame(self)
        bar.pack(fill="x", padx=10, pady=(12, 8))
        ttk.Button(bar, text="取消", command=self._cancel).pack(side="right", padx=4)
        ttk.Button(bar, text="确定", command=self._ok).pack(side="right")
        self.bind("<Return>", lambda _e: self._ok())
        self.bind("<Escape>", lambda _e: self._cancel())
        self.protocol("WM_DELETE_WINDOW", self._cancel)
        self.after(120, lambda: self.focus_force())

    def _ok(self):
        self.result = self.var.get()
        self.destroy()

    def _cancel(self):
        self.result = None
        self.destroy()


def ask_inputs(parent, title, prompt, fields, note=None, ok_text="确定"):
    d = InputDialog(parent, title, prompt, fields, note, ok_text)
    parent.wait_window(d)
    return d.result


def ask_choice(parent, title, prompt, options):
    d = ChoiceDialog(parent, title, prompt, options)
    parent.wait_window(d)
    return d.result


# ─────────────────────────── 主向导 ───────────────────────────

class UploaderWizard(tk.Tk):
    MODES = ["device", "pat", "gcm"]

    def __init__(self):
        super().__init__()
        self.title("GitHub 上传向导 · 全球黄页")
        self.geometry("820x640")
        self.minsize(720, 560)
        self.configure(padx=4, pady=4)

        self.q = queue.Queue()
        self.running = False
        self.cancel_flag = False
        self.detail_mode = tk.BooleanVar(value=False)  # 勾选后每步都弹确认

        # 状态：从现有仓库读取默认值
        self.state = {
            "mode": "device",
            "owner": "heiniao-wan",
            "repo": "global-yellow-pages",
            "branch": "main",
            "private": False,
            "desc": "全球热门网站黄页 · 分类导航 + 投票统计 + 四语切换",
            "username": "",
            "email": "",
            "message": "feat: 全球黄页站点（335 站点 / 留言后台 / 四语）",
            "token": "",
            "step": 0,
        }
        self._load_repo_state()

        self._build_ui()
        self.after(120, self._poll)
        self.after(300, lambda: self._enter_step(0))

    # ───────── UI ─────────
    def _build_ui(self):
        head = ttk.Frame(self)
        head.pack(fill="x", padx=8, pady=(6, 4))
        tk.Label(head, text="🚀 GitHub 上传向导", font=FONT_TITLE).pack(side="left")
        self.step_lbl = tk.Label(head, text="", font=FONT, fg="#0a84ff")
        self.step_lbl.pack(side="right")

        self.bar = ttk.Progressbar(self, mode="determinate", maximum=100)
        self.bar.pack(fill="x", padx=8, pady=(0, 6))

        self.tip = tk.Label(self, text="", font=FONT_B, justify="left",
                            wraplength=780, anchor="w")
        self.tip.pack(fill="x", padx=12, pady=(2, 6))

        self.body = scrolledtext.ScrolledText(self, font=MONO, wrap="word",
                                              state="disabled", height=18)
        self.body.pack(fill="both", expand=True, padx=8, pady=(0, 6))

        bar = ttk.Frame(self)
        bar.pack(fill="x", padx=8, pady=(0, 4))
        self.status = tk.Label(bar, text="准备就绪", font=FONT, fg="#666666")
        self.status.pack(side="left")
        ttk.Checkbutton(bar, text="详细模式（每步弹确认框）",
                        variable=self.detail_mode).pack(side="left", padx=16)
        ttk.Button(bar, text="取消", command=self._cancel).pack(side="right", padx=4)
        ttk.Button(bar, text="◀ 上一步", command=self._prev).pack(side="right", padx=4)
        self.next_btn = ttk.Button(bar, text="下一步 ▶", command=self._next)
        self.next_btn.pack(side="right", padx=4)

    def log(self, text):
        self.body.config(state="normal")
        self.body.insert("end", text + "\n")
        self.body.see("end")
        self.body.config(state="disabled")

    def _set_step(self, idx, total):
        self.state["step"] = idx
        self.step_lbl.config(text="第 %d / %d 步" % (idx + 1, total))
        self.bar["value"] = int((idx) / max(total, 1) * 100)

    # ───────── 读取仓库现状 ─────────
    def _load_repo_state(self):
        if not GIT:
            return
        code, out = sh([GIT, "rev-parse", "--is-inside-work-tree"])
        if code == 0 and out.strip() == "true":
            _, u = sh([GIT, "config", "--get", "user.name"])
            _, e = sh([GIT, "config", "--get", "user.email"])
            self.state["username"] = u.strip()
            self.state["email"] = e.strip()
            _, br = sh([GIT, "branch", "--show-current"])
            if br.strip():
                self.state["branch"] = br.strip()
            _, rem = sh([GIT, "remote", "get-url", "origin"])
            rem = rem.strip()
            m = None
            for pat in (r"github\.com[:/]([^/]+)/([^/\s]+?)(?:\.git)?/?$",):
                import re as _re
                m = _re.search(pat, rem)
                if m:
                    break
            if m:
                self.state["owner"] = m.group(1)
                self.state["repo"] = m.group(2)

    # ───────── 步骤编排 ─────────
    def step_defs(self):
        """按当前选择动态生成步骤列表"""
        d = [("选择登录方式", self.s_auth),
             ("填写仓库信息", self.s_repo),
             ("身份与提交说明", self.s_ident)]
        if self.state["mode"] == "device":
            d.append(("网页授权登录", self.s_device))
        elif self.state["mode"] == "pat":
            d.append(("填写个人令牌", self.s_pat))
        d += [("确认上传清单", self.s_confirm),
              ("执行上传", self.s_run)]
        return d

    def _enter_step(self, idx):
        defs = self.step_defs()
        if idx >= len(defs):
            return
        self._set_step(idx, len(defs))
        name, _fn = defs[idx]
        self.tip.config(text="【%s】" % name)
        self.log("\n" + "─" * 62 + "\n▶ 第 %d 步：%s" % (idx + 1, name))
        self.status.config(text="点击「下一步 ▶」开始填写")

    def _next(self):
        defs = self.step_defs()
        idx = self.state["step"]
        if idx >= len(defs):
            return
        name, fn = defs[idx]
        ok = fn()
        if not ok:      # 用户取消或校验失败 → 停在当前步
            return
        if idx + 1 < len(defs):
            self._enter_step(idx + 1)
            if defs[idx + 1][0] in ("确认上传清单", "执行上传"):
                self.after(200, self._next)   # 这两步无需再点，自动推进
        else:
            self.bar["value"] = 100
            self.tip.config(text="【完成】")

    def _prev(self):
        idx = max(0, self.state["step"] - 1)
        self._enter_step(idx)

    def _cancel(self):
        self.cancel_flag = True
        if self.running:
            if messagebox.askyesno("取消", "正在上传，确定要中断吗？"):
                self.destroy()
        else:
            self.destroy()

    # ───────── 第 1 步：登录方式 ─────────
    def s_auth(self):
        opts = [
            ("① 网页授权登录（推荐，不用管令牌）",
             "程序给你 8 位码 → 自动打开浏览器 → 你在已登录的 GitHub 页面粘贴码、点 Authorize → 自动完成上传"),
            ("② 我填个人令牌（PAT）",
             "懂行的用：自己去 GitHub 生成过令牌，粘贴进来即可（只用于本次上传，不保存）"),
            ("③ 凭据管理器（GCM）弹窗授权",
             "由 Git 凭据管理器弹浏览器 OAuth；若你之前弹窗报错过，优先选 ①"),
        ]
        pick = ask_choice(self, "第 1 步 · 选择登录方式",
                          "你想用哪种方式把文件上传到 GitHub？", opts)
        if pick is None:
            return False
        self.state["mode"] = self.MODES[pick]
        self.log("   已选择：" + opts[pick][0])
        return True

    # ───────── 第 2 步：仓库信息 ─────────
    def s_repo(self):
        res = ask_inputs(
            self, "第 2 步 · 仓库信息",
            "填写要上传到的 GitHub 仓库（已按现有配置预填，可直接确定）：",
            [("owner", "账号名（owner）：", self.state["owner"], False),
             ("repo", "仓库名：", self.state["repo"], False),
             ("branch", "分支名：", self.state["branch"], False),
             ("desc", "仓库简介：", self.state["desc"], False)],
            note="仓库不存在时会自动创建（用你网页里登录的那个账号）。")
        if not res:
            return False
        if not res["owner"] or not res["repo"]:
            messagebox.showwarning("缺少信息", "账号名和仓库名必须填写")
            return False
        self.state.update({"owner": res["owner"], "repo": res["repo"],
                           "branch": res["branch"] or "main",
                           "desc": res["desc"]})

        vis = ask_choice(self, "第 2 步 · 仓库可见性",
                         "这个仓库设为公开还是私有？",
                         [("公开（public）", "任何人可见；后续接 Cloudflare Pages 免费版也没问题"),
                          ("私有（private）", "只有你自己可见；Cloudflare Pages 需授权才能读取")])
        if vis is None:
            return False
        self.state["private"] = (vis == 1)
        self.log("   目标仓库：%s/%s（%s，分支 %s）"
                 % (self.state["owner"], self.state["repo"],
                    "私有" if self.state["private"] else "公开",
                    self.state["branch"]))
        return True

    # ───────── 第 3 步：身份与提交说明 ─────────
    def s_ident(self):
        res = ask_inputs(
            self, "第 3 步 · 身份与提交说明",
            "Git 提交需要署名（会写进提交记录，只保存在本机仓库配置里）：",
            [("username", "你的名字/昵称：", self.state["username"] or "heiniao-wan", False),
             ("email", "你的邮箱：", self.state["email"] or "Huoyld@163.com", False),
             ("message", "本次提交说明：", self.state["message"], False)],
            note="提交说明就是这次上传的备注，随便写，例如「站点首版上线」。")
        if not res:
            return False
        if not res["username"] or not res["email"]:
            messagebox.showwarning("缺少信息", "名字和邮箱都要填（用于提交署名）")
            return False
        self.state.update({"username": res["username"], "email": res["email"],
                           "message": res["message"] or "update: 站点更新"})
        self.log("   署名：%s <%s>" % (self.state["username"], self.state["email"]))
        return True

    # ───────── 第 4 步（device）：网页授权 ─────────
    def s_device(self):
        self.status.config(text="正在向 GitHub 申请设备码…")
        self.update_idletasks()
        js, err = device_start()
        if err:
            messagebox.showerror("无法开始网页授权",
                                 err + "\n\n可改用「② 个人令牌」或「③ 凭据管理器」方式。")
            return False

        user_code = js["user_code"]
        verify = js.get("verification_uri", "https://github.com/login/device")
        webbrowser.open(verify)

        d = InputDialog(
            self, "第 4 步 · 网页授权登录",
            "浏览器已打开 GitHub 授权页，请把下面这串码填进去：",
            [("code", "设备码（已自动填好，不用改，直接点下面的按钮）：", user_code, False)],
            banner=user_code,
            banner_sub="若浏览器没自动打开，手动访问：" + verify,
            note="网页操作：粘贴码 → Continue → 点绿色 Authorize → 回到这里点「我已完成授权」。",
            ok_text="我已完成授权")
        self.wait_window(d)
        if d.result is None:
            return False

        self.status.config(text="等待你在网页上确认授权（最长 10 分钟）…")
        self.log("   设备码 %s 已发出，等待网页确认…" % user_code)
        self.update_idletasks()
        token, err = device_poll(js["device_code"],
                                 interval=max(3, int(js.get("interval", 5))),
                                 timeout=600,
                                 should_stop=lambda: self.cancel_flag)
        if err:
            messagebox.showerror("授权未完成", err + "\n\n可返回第 1 步改用其他方式。")
            return False
        self.state["token"] = token
        login, uerr = api_get_user(token)
        if login:
            self.state["owner"] = login
            self.log("   ✅ 已登录为 GitHub 账号：%s" % login)
            messagebox.showinfo("授权成功",
                                "已连接到 GitHub 账号：%s\n下一步将把文件上传到 %s/%s"
                                % (login, login, self.state["repo"]))
        else:
            self.log("   ⚠️ 读取账号名失败：%s（沿用 %s）" % (uerr, self.state["owner"]))
        return True

    # ───────── 第 4 步（pat）：填令牌 ─────────
    def s_pat(self):
        res = ask_inputs(
            self, "第 4 步 · 填写个人令牌",
            "粘贴你的 GitHub 个人令牌（PAT）：",
            [("token", "PAT（ghp_ 或 github_pat_ 开头）：", "", True)],
            note="获取：GitHub 网页 → 右上角头像 → Settings → Developer settings "
                 "→ Personal access tokens → Tokens(classic) → Generate new token，勾选 repo。\n"
                 "本工具只在本次上传中使用它，不会保存到任何文件。")
        if not res or not res["token"]:
            return False
        self.state["token"] = res["token"]
        login, err = api_get_user(res["token"])
        if not login:
            messagebox.showerror("令牌无效",
                                 "这个令牌连不上 GitHub：%s\n\n请确认已勾选 repo 权限且未过期。" % err)
            return False
        self.state["owner"] = login
        self.log("   ✅ 令牌有效，账号：%s" % login)
        return True

    # ───────── 第 5 步：确认 ─────────
    def s_confirm(self):
        files = self._pending_files()
        self.log("   待上传文件：%d 个（已排除 .workbuddy / 本地留言数据等忽略项）" % len(files))
        for f in files[:15]:
            self.log("      · " + f)
        if len(files) > 15:
            self.log("      … 其余 %d 个省略" % (len(files) - 15))

        summary = (
            "上传目标：github.com/%s/%s\n"
            "可见性：%s    分支：%s\n"
            "登录方式：%s\n"
            "提交署名：%s <%s>\n"
            "提交说明：%s\n"
            "文件数量：%d 个\n\n"
            "确定开始上传吗？"
        ) % (self.state["owner"], self.state["repo"],
             "私有" if self.state["private"] else "公开", self.state["branch"],
             {"device": "网页授权登录", "pat": "个人令牌", "gcm": "凭据管理器"}[self.state["mode"]],
             self.state["username"], self.state["email"],
             self.state["message"], len(files))
        return messagebox.askyesno("第 5 步 · 确认上传清单", summary)

    def _pending_files(self):
        code, out = sh([GIT, "status", "--porcelain"])
        if code != 0:
            return []
        files = []
        for line in out.splitlines():
            line = line.rstrip()
            if len(line) > 3:
                files.append(line[3:].strip().strip('"'))
        return files

    # ───────── 第 6 步：执行 ─────────
    def s_run(self):
        self.running = True
        self.next_btn.config(state="disabled")
        self.status.config(text="正在上传，请稍候…")
        threading.Thread(target=self._run_all, daemon=True).start()
        return True

    def _emit(self, kind, payload):
        self.q.put((kind, payload))

    def _run_all(self):
        st = self.state
        token = st["token"]
        owner, repo, branch = st["owner"], st["repo"], st["branch"]

        def step(title, cmd, critical=True, sensitive=None):
            """执行一步并记日志；sensitive 为需要脱敏的字符串"""
            self._emit("out", "\n$ " + title)
            if cmd:
                shown = " ".join(cmd)
                if sensitive:
                    shown = shown.replace(sensitive, "***")
                self._emit("out", "  " + shown)
            code, out = sh(cmd) if cmd else (0, "")
            for line in (out or "").splitlines():
                line = line.rstrip()
                if sensitive:
                    line = line.replace(sensitive, "***")
                self._emit("out", "  " + line)
            if code == 0:
                self._emit("ok", title + " —— 完成")
            else:
                self._emit("bad", "%s —— 失败（退出码 %s）" % (title, code))
                if critical:
                    self._emit("stop", title + " 失败，已中止。\n" + (out or "")[:400])
                    return False
            return True

        if not GIT:
            self._emit("stop", "没找到 git.exe，无法上传。请先安装 Git。")
            return

        # 1) 初始化仓库
        code, _ = sh([GIT, "rev-parse", "--is-inside-work-tree"])
        if code != 0:
            if not step("1/7 初始化本地仓库", [GIT, "init", "-b", branch]):
                return
        else:
            self._emit("ok", "1/7 本地仓库已就绪（跳过初始化）")

        # 2) 署名
        if not step("2/7 设置提交署名",
                    [GIT, "config", "user.name", st["username"]]):
            return
        if not step("2/7 设置提交邮箱",
                    [GIT, "config", "user.email", st["email"]]):
            return

        # 3) 确保分支名
        code, cur = sh([GIT, "branch", "--show-current"])
        if not cur.strip():
            sh([GIT, "branch", "-M", branch])
        elif cur.strip() != branch:
            self._emit("out", "  当前分支 %s（保持不动）" % cur.strip())
            branch = cur.strip()
            st["branch"] = branch

        # 4) 暂存
        if not step("3/7 暂存全部文件", [GIT, "add", "-A"]):
            return

        # 5) 提交（无改动则跳过）
        code, _ = sh([GIT, "diff", "--cached", "--quiet"])
        if code == 0:
            self._emit("ok", "4/7 没有新改动（跳过提交）")
        else:
            if not step("4/7 提交",
                        [GIT, "commit", "-m", st["message"]]):
                return

        # 6) 远程仓库：有 token 就用 API 检查/创建
        if token:
            js, created, err = api_ensure_repo(token, owner, repo,
                                               st["private"], st["desc"])
            if err:
                self._emit("bad", "5/7 仓库处理失败：" + err)
                self._emit("stop", err)
                return
            self._emit("ok", "5/7 仓库%s：%s" % ("已创建" if created else "已存在",
                                                 js.get("full_name", owner + "/" + repo)))
            if created:
                self._emit("ask", "仓库 %s/%s 已创建（%s）"
                           % (owner, repo, "私有" if st["private"] else "公开"))
        else:
            self._emit("ok", "5/7 不检查远端（凭据管理器模式，直接推送）")

        # 7) 设置远程地址
        plain = "https://github.com/%s/%s.git" % (owner, repo)
        code, _ = sh([GIT, "remote", "get-url", "origin"])
        if code == 0:
            sh([GIT, "remote", "set-url", "origin", plain])
        else:
            sh([GIT, "remote", "add", "origin", plain])
        self._emit("ok", "6/7 远程地址 → " + plain)

        # 8) 推送
        if token:
            push_url = "https://x-access-token:%s@github.com/%s/%s.git" % (token, owner, repo)
            cmd = [GIT, "-c", "credential.helper=", "push", "-u", push_url, branch]
            ok = step("7/7 推送到 GitHub", cmd, critical=True, sensitive=token)
            # token 不落盘：remote 始终是普通地址
            sh([GIT, "remote", "set-url", "origin", plain])
        else:
            # 凭据管理器模式：先把 helper 修到本机可用的 GCM（旧配置可能指向已删除的路径）
            if GCM:
                sh([GIT, "config", "--global", "credential.helper", '!"%s"' % GCM])
                sh([GIT, "config", "--global", "credential.https://github.com.provider", "github"])
                self._emit("out", "   凭据管理器 → " + os.path.basename(GCM))
            ok = step("7/7 推送到 GitHub（浏览器会弹授权）",
                      [GIT, "push", "-u", "origin", branch])
            if not ok:
                self._emit("out", "   提示：若远端仓库还不存在，请先到 github.com/new 建一个空仓库再重试。")
        if not ok:
            return

        self._emit("done", "https://github.com/%s/%s" % (owner, repo))

    # ───────── 主线程消息轮询 ─────────
    def _poll(self):
        try:
            while True:
                kind, payload = self.q.get_nowait()
                if kind == "out":
                    self.log(payload)
                elif kind == "ok":
                    self.log("   ✅ " + payload)
                    if self.detail_mode.get():
                        messagebox.showinfo("步骤完成", payload)
                elif kind == "bad":
                    self.log("   ❌ " + payload)
                elif kind == "ask":
                    messagebox.showinfo("已处理", payload)
                elif kind == "stop":
                    self.log("   🛑 " + payload)
                    messagebox.showerror("上传中止", payload)
                    self.running = False
                    self.next_btn.config(state="normal")
                    self.status.config(text="已中止")
                elif kind == "done":
                    self.bar["value"] = 100
                    self.running = False
                    self.next_btn.config(state="normal")
                    self.status.config(text="上传完成")
                    self.log("\n🎉 全部完成 → " + payload)
                    self.tip.config(text="【完成】已上传到 " + payload)
                    if messagebox.askyesno("上传完成 🎉",
                                           "代码已上传到：\n%s\n\n"
                                           "现在打开仓库页面查看吗？" % payload):
                        webbrowser.open(payload)
        except queue.Empty:
            pass
        self.after(150, self._poll)


def selftest():
    """不开窗口的构建自检"""
    if not GIT:
        print("[警告] 未找到 git.exe")
    print("GIT =", GIT)
    print("GCM =", GCM or "(无)")
    app = UploaderWizard()
    defs = app.step_defs()
    print("步骤数 =", len(defs), [d[0] for d in defs])
    app.state["mode"] = "pat"
    print("切 PAT 后步骤 =", [d[0] for d in app.step_defs()])
    app.state["mode"] = "gcm"
    print("切 GCM 后步骤 =", [d[0] for d in app.step_defs()])
    app.destroy()
    print("SELFTEST OK")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    app = UploaderWizard()
    app.mainloop()
