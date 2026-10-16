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

import base64
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


def open_url(url):
    """在独立线程里打开浏览器。

    坑：Python 3.12 + Windows 下，在 tkinter 主线程里直接 webbrowser.open()
    会触发 GIL 相关的致命错误导致整个进程崩溃，所以必须挪到子线程，
    并且失败时退回命令方式。
    """
    def _go():
        # 先用系统命令打开（不经过 webbrowser 模块，最稳），失败再退回 webbrowser
        try:
            subprocess.Popen(["cmd", "/c", "start", "", url],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             creationflags=0x08000000)  # CREATE_NO_WINDOW，不闪黑框
            return
        except Exception:  # noqa: BLE001
            pass
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    threading.Thread(target=_go, daemon=True).start()


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


def auth_header(token):
    """GitHub 官方做法（Actions 同款）：凭据走请求头，URL 保持干净"""
    cred = base64.b64encode(("x-access-token:%s" % token).encode("utf-8")).decode("ascii")
    return "http.extraHeader=Authorization: Basic %s" % cred, cred


def git_ls_remote(token, owner, repo, timeout=90):
    """用 git 亲自探一下远端仓库在不在、有没有权限——比 API 更贴近真实推送能力"""
    if not GIT:
        return False, "未找到 git.exe"
    url = "https://github.com/%s/%s.git" % (owner.strip("/"), repo.strip("/"))
    if token:
        hdr, _cred = auth_header(token)
        args = [GIT, "-c", "credential.helper=", "-c", hdr, "ls-remote", url, "HEAD"]
    else:
        args = [GIT, "ls-remote", url, "HEAD"]
    code, out = sh(args, timeout=timeout)
    return code == 0, out.strip()


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
    """Device Flow 第 1 步：申请设备码

    scope 一定要显式带上 repo，否则 GitHub 会发一个「只读」令牌，
    能 ls-remote 但 push 时会被 403（Permission denied）。
    """
    st, js, txt = http_json(
        "https://github.com/login/device/code",
        data={"client_id": CLIENT_ID, "scope": "repo,workflow,read:user"})
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


def http_json_h(url, headers=None, timeout=25):
    """与 http_json 相同，但额外返回响应头（要读 GitHub 回传的 X-OAuth-Scopes）"""
    hdr = dict(UA)
    if headers:
        hdr.update(headers)
    req = urllib.request.Request(url, headers=hdr, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = decode_out(r.read())
            try:
                return r.status, json.loads(txt), txt, dict(r.headers)
            except ValueError:
                return r.status, None, txt, dict(r.headers)
    except urllib.error.HTTPError as e:
        txt = decode_out(e.read())
        try:
            return e.code, json.loads(txt), txt, dict(e.headers or {})
        except ValueError:
            return e.code, None, txt, dict(e.headers or {})
    except Exception as e:  # noqa: BLE001
        return -1, None, str(e), {}


def api_get_user(token):
    st, js, _ = http_json(GITHUB_API + "/user",
                          headers={"Authorization": "Bearer " + token})
    if st == 200 and js:
        return js.get("login", ""), ""
    return "", "读取账号失败（HTTP %s）" % st


def token_kind(tok):
    """按前缀判断令牌类型，报错时好定位"""
    t = (tok or "").strip()
    if t.startswith("github_pat_"):
        return "细粒度个人令牌（fine-grained PAT）"
    if t.startswith("ghp_"):
        return "经典个人令牌（classic PAT）"
    if t.startswith("gho_"):
        return "OAuth 网页授权令牌"
    if t.startswith("ghs_"):
        return "GitHub 服务端令牌"
    if t.startswith("ghu_"):
        return "OAuth 用户令牌（只读倾向）"
    return "未知类型（长度 %d）" % len(t)


def api_token_diag(token, owner, repo):
    """授权体检：这个令牌到底能不能推送？

    返回 dict：login / scopes / exists / private / push / admin / pull / err
    说明：
      · scopes 来自响应头 X-OAuth-Scopes（经典 PAT / OAuth 令牌才有）
      · push=False 而仓库存在 → 就是「能读不能写」，推送必 403
    """
    d = {"login": "", "scopes": "", "exists": False, "private": None,
         "push": None, "admin": None, "pull": None, "err": ""}
    st, js, _, hdrs = http_json_h(GITHUB_API + "/user",
                                  headers={"Authorization": "Bearer " + token})
    if st == 200 and js:
        d["login"] = js.get("login", "")
        d["scopes"] = (hdrs.get("X-OAuth-Scopes") or "").strip()
    else:
        d["err"] = "读取账号失败（HTTP %s）" % st
        return d

    st2, js2, _, h2 = http_json_h("%s/repos/%s/%s" % (GITHUB_API, owner, repo),
                                  headers={"Authorization": "Bearer " + token})
    if not d["scopes"]:
        d["scopes"] = (h2.get("X-OAuth-Scopes") or "").strip()
    if st2 == 200 and js2:
        d["exists"] = True
        d["private"] = bool(js2.get("private"))
        perm = js2.get("permissions") or {}
        d["push"] = perm.get("push")
        d["admin"] = perm.get("admin")
        d["pull"] = perm.get("pull")
    elif st2 == 404:
        d["err"] = "仓库不存在（404），或令牌看不到它"
    else:
        d["err"] = "查询仓库失败（HTTP %s）" % st2
    return d


def api_check_repo(token, owner, repo):
    """用 token 查仓库。返回 (dict|None, 错误)——None 且无错表示不存在"""
    st, js, _ = http_json("%s/repos/%s/%s" % (GITHUB_API, owner, repo),
                          headers={"Authorization": "Bearer " + token})
    if st == 200 and js:
        return js, ""
    if st == 404:
        return None, ""
    return None, "查询仓库失败（HTTP %s）" % st


def api_check_repo_anon(owner, repo):
    """匿名查仓库（公开仓库不需要任何令牌）"""
    st, js, _ = http_json("%s/repos/%s/%s" % (GITHUB_API, owner, repo))
    if st == 200 and js:
        return js, ""
    if st == 404:
        return None, ""
    return None, "匿名查询失败（HTTP %s）" % st


def api_list_repos(token, limit=300):
    """列出当前账号名下所有仓库（含私有），返回 (名字列表, 错误)"""
    names, page = [], 1
    while len(names) < limit:
        st, js, txt = http_json(
            "%s/user/repos?per_page=100&page=%d&sort=updated" % (GITHUB_API, page),
            headers={"Authorization": "Bearer " + token})
        if st != 200 or not isinstance(js, list):
            return names, ("读取仓库列表失败（HTTP %s）" % st) if not names else ""
        if not js:
            break
        names += [r.get("name", "") for r in js]
        if len(js) < 100:
            break
        page += 1
    return names, ""


def api_create_repo(token, repo, private, description):
    st, js, txt = http_json(GITHUB_API + "/user/repos",
                            data={"name": repo, "private": "true" if private else "false",
                                  "description": description, "auto_init": "false"},
                            headers={"Authorization": "Bearer " + token})
    if st in (200, 201) and js:
        return js, ""
    msg = (js or {}).get("message", txt[:200]) if js else txt[:200]
    return None, "创建仓库失败（HTTP %s）：%s" % (st, msg)


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
            "repo_ready": False,
            "step": 0,
        }
        self._load_repo_state()
        self._fix_credential_helper()

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

    def _fix_credential_helper(self):
        """旧配置可能指向已被删除的 PortableGit 目录，导致凭据管理器根本起不来"""
        if not GIT or not GCM:
            return
        code, out = sh([GIT, "config", "--global", "--get", "credential.helper"])
        if code != 0:
            return
        cur = out.strip()
        if not cur or "git-credential-manager" not in cur:
            return
        m = None
        import re as _re
        m = _re.search(r"([A-Za-z]:\\[^\"']*?git-credential-manager\.exe)", cur)
        if m and os.path.isfile(m.group(1)):
            return                      # 指向的文件还在，别动
        sh([GIT, "config", "--global", "credential.helper", '!"%s"' % GCM])
        sh([GIT, "config", "--global", "credential.https://github.com.provider", "github"])
        self._helper_fixed = GCM   # 稍后进了第 1 步再打日志（此时日志框还没建好）

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
        if getattr(self, "_helper_fixed", ""):
            self.log("   🔧 已把凭据管理器修到本机可用路径：%s" % self._helper_fixed)
        opts = [
            ("① 网页授权登录（推荐，不用管令牌）",
             "程序给你 8 位码 → 自动打开浏览器 → 你在已登录的 GitHub 页面粘贴码、点 Authorize → 自动完成上传"),
            ("② 我填个人令牌（PAT）",
             "最稳的一种：生成时勾选 repo（读写仓库）。推送报 403 权限不足时，选它就对了"),
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
        return self._device_flow() and self._prepare_repo() and self._ensure_push_rights()

    def _device_flow(self):
        """走一遍 Device Flow，拿到令牌写进 state['token']"""
        self.status.config(text="正在向 GitHub 申请设备码…")
        self.update_idletasks()
        js, err = device_start()
        if err:
            messagebox.showerror("无法开始网页授权",
                                 err + "\n\n可改用「② 个人令牌」或「③ 凭据管理器」方式。")
            return False

        user_code = js["user_code"]
        verify = js.get("verification_uri", "https://github.com/login/device")
        open_url(verify)

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
        self.state["token"] = res["token"].strip()
        login, err = api_get_user(self.state["token"])
        if not login:
            messagebox.showerror("令牌无效",
                                 "这个令牌连不上 GitHub：%s\n\n请确认已勾选 repo 权限且未过期。" % err)
            return False
        self.state["owner"] = login
        self.log("   ✅ 令牌有效，账号：%s" % login)
        return self._prepare_repo() and self._ensure_push_rights()

    # ───────── 授权体检：确认令牌真的能写 ─────────
    def _log_diag(self, d):
        self.log("   ── 授权体检 ─────────────────────────────")
        self.log("   令牌类型：%s" % token_kind(self.state.get("token")))
        self.log("   登录账号：%s" % (d.get("login") or "(读取失败)"))
        self.log("   GitHub 回传权限：%s" % (d.get("scopes") or "（空 —— 只读，推不上去）"))
        if d.get("exists"):
            self.log("   对 %s/%s 的权限：push=%s admin=%s pull=%s"
                     % (self.state["owner"], self.state["repo"],
                        d.get("push"), d.get("admin"), d.get("pull")))
        else:
            self.log("   仓库查询结果：%s" % (d.get("err") or "查不到该仓库"))
        self.log("   ────────────────────────────────────────")

    def _ensure_push_rights(self):
        """推送前先确认令牌有写权限；没有就当场引导换 PAT / 重授权。返回是否继续。"""
        st = self.state
        token = st.get("token")
        if not token:
            return True
        self.status.config(text="正在体检授权权限…")
        self.update_idletasks()
        d = api_token_diag(token, st["owner"], st["repo"])
        self._log_diag(d)
        if d.get("push") is not False:
            return True

        self.log("   ❌ 该令牌对 %s/%s 没有写权限（push=false），继续推送必然 403"
                 % (st["owner"], st["repo"]))
        pick = ask_choice(
            self, "授权权限不足（只能读，不能写）",
            "这个令牌能读到仓库，但 GitHub 不让它推送（典型报错 403 Permission denied）。\n"
            "最常见原因：网页授权时拿到的是只读令牌（没有 repo 写权限）。\n\n"
            "想怎么处理？",
            [("① 改用个人令牌 PAT（最稳，推荐）",
              "打开令牌生成页（权限已预勾 repo），生成后粘贴回来，立刻继续上传"),
             ("② 撤销旧的网页授权，重新授权一次",
              "打开 GitHub 授权管理页，Revoke 掉旧的授权，再重新走一遍网页授权"),
             ("③ 不管它，强行推送",
              "除非你确定是别的原因，否则多半还是 403")])
        if pick is None:
            return False
        if pick == 0:
            return self._switch_to_pat(st["repo"])
        if pick == 1:
            open_url("https://github.com/settings/applications")
            messagebox.showinfo(
                "撤销旧授权",
                "请在打开的页面里：\n"
                "  1) 点上方「Authorized OAuth Apps」标签\n"
                "  2) 找到 GitHub CLI（本工具借用的官方应用）→ 点 Revoke\n"
                "  3) 回来点「下一步」，我会重新发起一次网页授权")
            if not self._device_flow():
                return False
            d2 = api_token_diag(st["token"], st["owner"], st["repo"])
            self._log_diag(d2)
            if d2.get("push") is False:
                messagebox.showerror(
                    "重新授权后仍然只读",
                    "新令牌依旧没有写权限。建议改用「① 个人令牌」：\n"
                    "GitHub → Settings → Developer settings → Personal access tokens "
                    "→ Tokens (classic) → 勾选 repo。")
                return False
            self.log("   ✅ 重新授权后已具备写权限")
            return True
        self.log("   ⚠️ 用户选择强行推送")
        return True

    def _switch_to_pat(self, repo_for_check=None):
        """引导用户生成一个带 repo 权限的 PAT 并替换当前令牌"""
        open_url("https://github.com/settings/tokens/new?scopes=repo,workflow"
                 "&description=global-yellow-pages-uploader")
        res = ask_inputs(
            self, "改用个人令牌（PAT）",
            "已打开 GitHub 令牌生成页（repo 权限已预勾）。\n"
            "网页上滚到最底部点「Generate token」，把生成的令牌粘贴进来：",
            [("token", "PAT（ghp_ 或 github_pat_ 开头）：", "", True)],
            note="令牌只在本次上传中使用，不会写入任何文件。\n"
                 "若页面要求输入密码/二次验证，按提示完成即可。",
            ok_text="用这个令牌")
        if not res or not res["token"]:
            return False
        tok = res["token"].strip()
        login, err = api_get_user(tok)
        if not login:
            messagebox.showerror("令牌无效", "这个令牌连不上 GitHub：%s" % err)
            return False
        owner = login
        rp = repo_for_check or self.state["repo"]
        d = api_token_diag(tok, owner, rp)
        self._log_diag(d)
        if d.get("push") is False:
            messagebox.showerror(
                "仍然没有写权限",
                "令牌可用（账号 %s），但对 %s/%s 没有写权限。\n"
                "请确认：令牌由本人账号生成、勾选了 repo（或该仓库的 Read and write）。"
                % (owner, owner, rp))
            return False
        self.state["token"] = tok
        self.state["owner"] = owner
        self.log("   ✅ 已换成个人令牌（账号 %s），具备写权限" % owner)
        return True

    # ───────── 仓库准备（授权成功后、确认清单前）─────────
    def _prepare_repo(self):
        """检查仓库 → 不存在才创建 → 创建被拒则引导。全程在主线程，可弹框。"""
        st = self.state
        token = st.get("token")
        if not token:
            return True
        self.status.config(text="正在检查远程仓库 %s/%s …" % (st["owner"], st["repo"]))
        self.update_idletasks()

        info, err = api_check_repo(token, st["owner"], st["repo"])
        if info:
            st["repo_ready"] = True
            st["private"] = bool(info.get("private"))
            self.log("   ✅ 仓库已存在：%s（%s）——直接用它"
                     % (info.get("full_name"), "私有" if st["private"] else "公开"))
            messagebox.showinfo("仓库已存在",
                                "%s 已经存在（%s），\n不需要新建，稍后直接把文件推上去。"
                                % (info.get("full_name"),
                                   "私有" if st["private"] else "公开"))
            return True

        # token 查不到 → 试匿名（公开仓库不需要令牌）
        if not err:
            info2, _ = api_check_repo_anon(st["owner"], st["repo"])
            if info2:
                st["repo_ready"] = True
                self.log("   ✅ 仓库已存在（公开）：%s/%s —— 直接用它" % (st["owner"], st["repo"]))
                messagebox.showinfo("仓库已存在",
                                    "%s/%s 已经存在（公开），\n不需要新建，稍后直接把文件推上去。"
                                    % (st["owner"], st["repo"]))
                return True

        # 单查不到 → 用「列出名下仓库」兜底（私有仓库单查可能 404，但列表里能看到）
        if not err:
            names, lerr = api_list_repos(token)
            if st["repo"] in names:
                st["repo_ready"] = True
                self.log("   ✅ 在账号 %s 的仓库列表里找到了 %s —— 直接用它" % (st["owner"], st["repo"]))
                messagebox.showinfo("仓库已存在",
                                    "你的账号下已经有 %s 这个仓库了。\n"
                                    "不需要新建，稍后直接把文件推上去。"
                                    % st["repo"])
                return True
            if lerr:
                self.log("   ⚠️ %s" % lerr)

        # 仓库确实不存在 → 自动创建
        self.status.config(text="仓库不存在，正在自动创建…")
        self.update_idletasks()
        js, cerr = api_create_repo(token, st["repo"], st["private"], st["desc"])
        if js:
            st["repo_ready"] = True
            self.log("   ✅ 已创建仓库：%s" % js.get("full_name"))
            messagebox.showinfo("仓库已创建",
                                "仓库 %s 已创建（%s）。"
                                % (js.get("full_name"),
                                   "私有" if st["private"] else "公开"))
            return True

        # 创建被拒（典型：网页授权的 App 无建仓权限）→ 让 git 亲自探一下
        self.log("   ⚠️ %s" % cerr)
        self.status.config(text="用 git 探测远端仓库是否可达…")
        self.update_idletasks()
        ok, out = git_ls_remote(token, st["owner"], st["repo"])
        if ok:
            st["repo_ready"] = True
            self.log("   ✅ git 能访问 %s/%s —— 仓库确实存在，稍后直接推送" % (st["owner"], st["repo"]))
            messagebox.showinfo("仓库可访问",
                                "git 已确认能访问 %s/%s，\n稍后直接把文件推上去。" % (st["owner"], st["repo"]))
            return True

        # git 也访问不到 → 基本可以确定：远端还没有这个仓库（或账号/权限对不上）
        self.log("   ❌ git 也访问不到该仓库：%s" % (out or "无输出"))
        ans = messagebox.askyesno(
            "远端没有这个仓库",
            "自动创建失败：%s\n"
            "git 探测也访问不到 %s/%s。\n\n"
            "说明 GitHub 上还没有这个仓库（或你登录的账号不是 %s）。\n\n"
            "点「否」→ 我帮你打开建仓页面，建好后再继续（推荐）；\n"
            "点「是」→ 认为仓库已存在，强行尝试推送（多半仍会失败）。"
            % (cerr, st["owner"], st["repo"], st["owner"]))
        if ans:
            st["repo_ready"] = True
            self.log("   ⚠️ 用户选择强行推送")
            return True

        open_url("https://github.com/new")
        messagebox.showinfo(
            "去网页建仓库",
            "已打开 github.com/new，请这样填：\n"
            "  · Repository name：%s（必须一模一样）\n"
            "  · 可见性：%s\n"
            "  · 【重要】不要勾选 README / .gitignore / license（保持空仓库）\n\n"
            "建好后回到这里点确定。" % (st["repo"], "Private 或 Public 都行"))
        if not messagebox.askyesno("等待确认", "仓库建好了吗？（建好后点「是」）"):
            self.log("   🛑 用户取消，可点「上一步」换登录方式再试")
            return False
        # 建好后二次验证，避免再白跑一趟
        self.status.config(text="验证刚创建的仓库…")
        self.update_idletasks()
        ok2, out2 = git_ls_remote(token, st["owner"], st["repo"])
        if ok2:
            st["repo_ready"] = True
            self.log("   ✅ 已确认仓库 %s/%s 可访问" % (st["owner"], st["repo"]))
            return True
        messagebox.showerror(
            "仍然访问不到",
            "git 还是访问不到 %s/%s：\n%s\n\n"
            "请确认：仓库名完全一致、账号是 %s、以及授权时勾选了仓库权限。\n"
            "也可以点「上一步」改选「③ 凭据管理器」再试。"
            % (st["owner"], st["repo"], out2 or "无输出", st["owner"]))
        return False

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
            "仓库状态：%s    可见性：%s    分支：%s\n"
            "登录方式：%s\n"
            "提交署名：%s <%s>\n"
            "提交说明：%s\n"
            "文件数量：%d 个\n\n"
            "确定开始上传吗？"
        ) % (self.state["owner"], self.state["repo"],
             "已确认存在，直接推送" if self.state.get("repo_ready") else "推送时按需处理",
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

    def ask_main(self, kind, payload, timeout=1800):
        """工作线程 → 主线程弹框取输入（返回用户输入或 None）

        tkinter 只能在主线程弹窗，所以这里把请求丢进队列，
        由 _poll 在主线程弹出对话框，再用 Event 把结果传回工作线程。
        """
        self._answer = None
        self._answer_ev = threading.Event()
        self.q.put((kind, payload))
        self._answer_ev.wait(timeout)
        return self._answer

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

        # 6) 远程仓库：第 4 步已备好则直接用；否则（凭据管理器模式）交给 git 自己处理
        if st.get("repo_ready"):
            self._emit("ok", "5/7 远程仓库已就绪：%s/%s" % (owner, repo))
        else:
            self._emit("ok", "5/7 不检查远端（凭据管理器模式，直接推送）")

        # 7) 设置远程地址
        plain = "https://github.com/%s/%s.git" % (owner.strip("/"), repo.strip("/"))
        code, _ = sh([GIT, "remote", "get-url", "origin"])
        if code == 0:
            sh([GIT, "remote", "set-url", "origin", plain])
        else:
            sh([GIT, "remote", "add", "origin", plain])
        self._emit("ok", "6/7 远程地址 → " + plain)

        # 8) 推送
        if token:
            def do_push(tok, title="7/7 推送到 GitHub"):
                # 凭据走请求头（GitHub Actions 同款），URL 保持干净，令牌不会串进地址
                hdr, cred = auth_header(tok)
                cmd = [GIT, "-c", "credential.helper=", "-c", hdr,
                       "push", "-u", plain, branch]
                good = step(title, cmd, critical=False, sensitive=cred)
                # token 不落盘：remote 始终是普通地址
                sh([GIT, "remote", "set-url", "origin", plain])
                return good

            ok = do_push(token)
            if not ok:
                # 403 / denied → 当场体检，并给用户一次「换令牌重试」的机会
                d = api_token_diag(token, owner, repo)
                self._emit("out", "   ── 授权体检 ── 账号：%s｜权限：%s｜push=%s"
                           % (d.get("login") or "?", d.get("scopes") or "（空）", d.get("push")))
                newtok = self.ask_main("need_pat", (
                    "推送被 GitHub 拒绝了（403 Permission denied）。\n\n"
                    "账号：%s\n令牌类型：%s\nGitHub 回传权限：%s\n\n"
                    "最快的解法：换一个带 repo 权限的个人令牌（PAT）。\n"
                    "点「确定」→ 我会打开 GitHub 令牌生成页（权限已预勾），\n"
                    "生成后粘贴回来，立刻自动重试，不用重走整个向导。"
                    % (d.get("login") or "?", token_kind(token),
                       d.get("scopes") or "（空 = 只读）")))
                if newtok:
                    login, err = api_get_user(newtok)
                    if not login:
                        self._emit("out", "   ❌ 新令牌无效：%s" % err)
                    else:
                        self._emit("out", "   ✅ 已换成个人令牌（账号 %s），重试推送…" % login)
                        ok = do_push(newtok, "7/7 推送到 GitHub（换 PAT 重试）")
            if not ok:
                self._emit("out",
                           "   提示：403 denied = 令牌没有写权限，换一个勾选了 repo 的个人令牌最省事；\n"
                           "         repository not found = 远端还没有这个仓库，去 github.com/new 建一个空的。")
                self._emit("stop", "7/7 推送失败，已中止。\n"
                                   "可点「上一步」回到第 1 步改选「② 个人令牌」。")
                return
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
                elif kind == "need_pat":
                    # 主线程：开令牌页 → 弹输入框 → 结果回传工作线程
                    open_url("https://github.com/settings/tokens/new?scopes=repo,workflow"
                             "&description=global-yellow-pages-uploader")
                    res = ask_inputs(
                        self, "推送被拒绝 · 换一个令牌", payload,
                        [("token", "个人令牌（PAT）：", "", True)],
                        note="网页上滚到最底部点「Generate token」，粘贴回这里。\n"
                             "留空或取消 = 放弃重试。",
                        ok_text="确定，自动重试")
                    self._answer = (res["token"].strip() if res and res["token"] else None)
                    self._answer_ev.set()
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
                        open_url(payload)
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
