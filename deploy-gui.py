# -*- coding: utf-8 -*-
"""
部署助手（DEPLOY-GUIDE.md 的窗口版）
====================================
把部署指南里的常用命令做成本地小工具：
· 左侧列表选择操作 → 命令自动填入编辑框（可手动修改再运行）
· 常用按钮一键执行；长驻进程（本地服务器）单独启停
· 所有输出实时滚动显示在下方

运行方式（本机Tkinter在系统Python里）：
    C:\\Python\\Python312\\python.exe deploy-gui.py
"""
import os
import queue
import subprocess
import sys
import threading
import webbrowser
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_URL = "http://127.0.0.1:8901/"
ADMIN_URL = "http://127.0.0.1:8901/admin.html"


def _find_exe(name, extra_candidates):
    """自动探测可执行文件：环境变量 → 已知路径 → PATH"""
    for c in extra_candidates:
        if c and os.path.isfile(c):
            return c
    import shutil
    return shutil.which(name) or name


GIT = _find_exe("git", [
    os.environ.get("GIT_EXE"),
    r"C:\Users\heini\.workbuddy\binaries\PortableGit\versions\current\cmd\git.exe",
    r"C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe",
    r"C:\Program Files\Git\cmd\git.exe",
])
NODE = _find_exe("node", [
    os.environ.get("NODE_EXE"),
    r"C:\Users\heini\.workbuddy\binaries\node\versions\22.22.2-6\node.exe",
])
# 与 git.exe 同一套便携目录里的凭据管理器（浏览器 OAuth 授权用，免 PAT）
GCM = os.path.normpath(os.path.join(GIT, "..", "..", "mingw64", "bin", "git-credential-manager.exe"))
if not os.path.isfile(GCM):
    GCM = _find_exe("git-credential-manager", [])

# (操作名, 命令)；__COMMIT__ 用「提交信息」输入框拼接，__XXX__ 为内置动作
PRESETS = [
    ("① 初始化仓库（首次发布）",  f'"{GIT}" init -b main'),
    ("② 查看改动状态",           f'"{GIT}" status -s'),
    ("③ 暂存全部改动",           f'"{GIT}" add -A'),
    ("④ 提交（用下方提交信息）",   "__COMMIT__"),
    ("⑤ 关联远程仓库（首次发布）", f'"{GIT}" remote add origin https://github.com/heiniao-wan/global-yellow-pages.git'),
    ("⑥ 推送上线（自动部署）",    f'"{GIT}" push -u origin main'),
    ("⑦ 查看最近提交记录",       f'"{GIT}" log --oneline -5'),
    ("⑧ 启动本地服务器（常驻）",  f'"{NODE}" tools/dev-server.js'),
    ("⑨ 停止本地服务器",         "__STOP_SERVER__"),
    ("⑩ 浏览器打开站点主页",     "__OPEN_SITE__"),
    ("⑪ 浏览器打开留言后台",     "__OPEN_ADMIN__"),
    ("⑫ 数据校验",              f'"{NODE}" tools/verify-data.js'),
    ("⑬ 防刷机制测试",           f'"{NODE}" tools/verify-antiabuse.js'),
    ("⑭ 存储加密测试",           f'"{NODE}" tools/verify-storage.js'),
    ("⑮ 留言接口测试",           f'"{NODE}" tools/verify-functions.js'),
    ("⑯ 自定义命令（自行填写）",  ""),
    ("⑰ 浏览器授权推送（免 PAT，首次推荐）", "__AUTH_PUSH__"),
    ("⑱ GitHub 网页上传（手动拖拽）",        "__WEB_UPLOAD__"),
    ("⑲ 🚀 上传向导（逐步填表，推荐新手）",   "__WIZARD__"),
]

REPO_URL = "https://github.com/heiniao-wan/global-yellow-pages"


def decode_out(data):
    """子进程输出解码：优先 UTF-8，失败退 GBK"""
    for enc in ("utf-8", "gbk"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            pass
    return data.decode("utf-8", errors="replace")


class DeployGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("部署助手 · 全球黄页")
        self.root.geometry("980x640")
        self.out_queue = queue.Queue()
        self.server_proc = None
        self.running = False
        self._build()
        self._poll_queue()
        self.log(f"工作目录：{ROOT}")
        self.log("提示：左侧选择操作 → 命令会填进编辑框，可改完再点「▶ 运行」。\n")

    # ────────────────── 界面 ──────────────────
    def _build(self):
        main = ttk.Frame(self.root, padding=8)
        main.pack(fill="both", expand=True)

        # 左：操作列表
        left = ttk.LabelFrame(main, text=" 选择操作 ", padding=6)
        left.pack(side="left", fill="y", padx=(0, 8))
        self.listbox = tk.Listbox(left, width=30, height=20, activestyle="dotbox",
                                  font=("Microsoft YaHei UI", 10))
        self.listbox.pack(fill="y", expand=True)
        for name, _ in PRESETS:
            self.listbox.insert("end", name)
        self.listbox.bind("<<ListboxSelect>>", self._on_select)

        # 右：命令编辑 + 按钮
        right = ttk.Frame(main)
        right.pack(side="left", fill="both", expand=True)

        row1 = ttk.LabelFrame(right, text=" 命令（可编辑后运行） ", padding=6)
        row1.pack(fill="x")
        self.cmd_var = tk.StringVar()
        cmd_entry = ttk.Entry(row1, textvariable=self.cmd_var, font=("Consolas", 10))
        cmd_entry.pack(side="left", fill="x", expand=True, ipady=3)
        ttk.Button(row1, text=" ▶ 运行 ", command=self.run_entry).pack(side="left", padx=(6, 0))

        row2 = ttk.LabelFrame(right, text=" 提交信息（供操作③使用） ", padding=6)
        row2.pack(fill="x", pady=6)
        self.msg_var = tk.StringVar(value="update: 站点更新")
        ttk.Entry(row2, textvariable=self.msg_var, font=("Microsoft YaHei UI", 10)).pack(
            fill="x", ipady=3)

        # 常用按钮
        btns = ttk.LabelFrame(right, text=" 一键操作 ", padding=6)
        btns.pack(fill="x")
        quick = [
            ("🚀 上传向导", 18), ("查看状态", 1), ("暂存全部", 2), ("提交", 3),
            ("推送上线", 5), ("🔑 授权推送", 16),
            ("▶ 服务器", 7), ("■ 停止", 8),
            ("打开站点", 9), ("打开后台", 10),
        ]
        for i, (label, idx) in enumerate(quick):
            ttk.Button(btns, text=label, width=10,
                       command=lambda k=idx: self._quick(k)).grid(
                row=i // 4, column=i % 4, padx=3, pady=3, sticky="we")
        for c in range(4):
            btns.columnconfigure(c, weight=1)

        # 校验按钮
        tests = ttk.LabelFrame(right, text=" 本地校验 ", padding=6)
        tests.pack(fill="x", pady=(6, 0))
        for i, idx in enumerate([11, 12, 13, 14]):
            ttk.Button(tests, text=PRESETS[idx][0][2:], width=14,
                       command=lambda k=idx: self._quick(k)).grid(
                row=0, column=i, padx=3, pady=3, sticky="we")
        for c in range(4):
            tests.columnconfigure(c, weight=1)

        # 输出区
        outf = ttk.LabelFrame(right, text=" 输出 ", padding=6)
        outf.pack(fill="both", expand=True, pady=(6, 0))
        self.output = scrolledtext.ScrolledText(outf, font=("Consolas", 9), state="disabled",
                                                wrap="word")
        self.output.pack(fill="both", expand=True)

        # 状态栏
        self.status = ttk.Label(main, text="就绪", relief="sunken", anchor="w", padding=(6, 2))
        self.status.pack(fill="x", pady=(6, 0))

    # ────────────────── 行为 ──────────────────
    def _on_select(self, _event=None):
        sel = self.listbox.curselection()
        if sel:
            self.cmd_var.set(PRESETS[sel[0]][1])

    def _quick(self, preset_idx):
        """一键操作：填入命令并立即执行"""
        self.listbox.selection_clear(0, "end")
        self.listbox.selection_set(preset_idx)
        self.listbox.see(preset_idx)
        self.cmd_var.set(PRESETS[preset_idx][1])
        self.run_entry()

    def _resolved_cmd(self, raw):
        """把占位命令翻译成真实命令；返回 None 表示已自行处理或参数缺失"""
        if raw == "__COMMIT__":
            msg = self.msg_var.get().strip().replace('"', "'")
            if not msg:
                messagebox.showwarning("缺少提交信息", "请先在「提交信息」框里填写内容")
                return None
            return f'"{GIT}" commit -m "{msg}"'
        if raw == "__STOP_SERVER__":
            self._stop_server()
            return None
        if raw == "__OPEN_SITE__":
            self._ensure_server()
            webbrowser.open(SITE_URL)
            return None
        if raw == "__OPEN_ADMIN__":
            self._ensure_server()
            webbrowser.open(ADMIN_URL)
            return None
        if raw == "__WIZARD__":
            self._open_wizard()
            return None
        return raw

    def _open_wizard(self):
        """另起一个进程打开「GitHub 上传向导」（逐步弹框填写，网页授权免 PAT）"""
        wizard = os.path.join(ROOT, "github-uploader.py")
        if not os.path.isfile(wizard):
            messagebox.showerror("缺少文件", "没找到 github-uploader.py")
            return
        try:
            subprocess.Popen([sys.executable, wizard], cwd=ROOT)
            self.log("（已打开「GitHub 上传向导」窗口，按提示每步填写即可）")
        except Exception as e:  # noqa: BLE001
            messagebox.showerror("启动失败", str(e))

    def _ensure_server(self):
        """打开网页前确认本地服务器在跑"""
        if not (self.server_proc and self.server_proc.poll() is None):
            self._start_server()
            self.log("（本地服务器已自动启动，稍候页面即可访问）")

    def run_entry(self):
        """运行编辑框里的命令（线程执行，避免卡界面）"""
        if self.running:
            messagebox.showinfo("请稍候", "上一个命令还在执行中")
            return
        raw = self.cmd_var.get().strip()
        if not raw:
            messagebox.showinfo("空命令", "请先在左侧选择一个操作，或直接输入命令")
            return
        if raw == "__AUTH_PUSH__":
            self._auth_push()
            return
        if raw == "__WEB_UPLOAD__":
            self._web_upload()
            return
        cmd = self._resolved_cmd(raw)
        if cmd is None:
            return
        self.running = True
        self.status.config(text=f"执行中：{cmd}")
        self.log(f"\n$ {cmd}")
        threading.Thread(target=self._exec, args=(cmd,), daemon=True).start()

    def _auth_push(self):
        """浏览器授权推送：修好 GCM 配置后直接 push，
        首次会弹浏览器 → 用已登录的 GitHub 点一下 Authorize → 之后免输任何密码"""
        if self.running:
            messagebox.showinfo("请稍候", "上一个命令还在执行中")
            return
        if not os.path.isfile(GCM):
            messagebox.showwarning(
                "未找到凭据管理器",
                "没找到 git-credential-manager.exe，请改用「⑯ 自定义命令」手动推送")
            return
        self.running = True
        self.status.config(text="浏览器授权推送中…")
        threading.Thread(target=self._exec_auth_push, daemon=True).start()

    def _exec_auth_push(self):
        """子线程：配置 GCM → 标记 GitHub 提供商 → 推送（GCM 弹浏览器授权）"""
        try:
            # 1) 配置 GCM。不经 shell（list 参数），避免引号被 cmd 吃掉
            self.out_queue.put(("out", "\n$ 1/3 配置凭据管理器（GCM）"))
            r1 = subprocess.run([GIT, "config", "--global", "credential.helper", f'!"{GCM}"'],
                                cwd=ROOT, capture_output=True)
            if r1.returncode != 0:
                self.out_queue.put(("out", decode_out(r1.stderr or r1.stdout)))
                self.out_queue.put(("done", "[失败] GCM 配置未写入"))
                return
            self.out_queue.put(("out", "   credential.helper → " + GCM))

            # 2) 标记 github.com 用 GitHub 专用授权流程
            self.out_queue.put(("out", "$ 2/3 标记 GitHub 提供商"))
            r2 = subprocess.run([GIT, "config", "--global",
                                 "credential.https://github.com.provider", "github"],
                                cwd=ROOT, capture_output=True)
            if r2.returncode != 0:
                self.out_queue.put(("out", decode_out(r2.stderr or r2.stdout)))
                self.out_queue.put(("done", "[失败] provider 标记未写入"))
                return

            # 3) 推送：首次 GCM 会弹浏览器，用已登录的 GitHub 点一下 Authorize 即可
            self.out_queue.put(("out", "$ 3/3 推送（首次会弹浏览器授权，点 Authorize 即可）"))
            proc = subprocess.Popen(f'"{GIT}" push -u origin main', cwd=ROOT, shell=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            for line in iter(proc.stdout.readline, b""):
                self.out_queue.put(("out", decode_out(line).rstrip("\r\n")))
            proc.wait()
            if proc.returncode != 0:
                self.out_queue.put(("done", f"[推送失败，退出码 {proc.returncode}]"
                                    "（可改用「⑱ GitHub 网页上传」兜底）"))
            else:
                self.out_queue.put(("done", "[完成] 已推送，Cloudflare Pages 会自动部署"))
        except Exception as e:  # noqa: BLE001
            self.out_queue.put(("done", f"[执行出错] {e}"))

    def _web_upload(self):
        """无配置兜底：打开 GitHub 网页上传页 + 本地目录，手动拖拽上传"""
        webbrowser.open(REPO_URL + "/upload/main")
        if hasattr(os, "startfile"):
            os.startfile(ROOT)  # noqa: S606 打开资源管理器方便拖拽
        self.log("已打开 GitHub 上传页和本地文件夹：把要上传的文件拖进网页即可"
                 "（网页上传不会删除远端已有文件，日常更新仍推荐 git 推送）")

    def _exec(self, cmd):
        """子线程：执行命令并把输出推入队列"""
        try:
            proc = subprocess.Popen(cmd, cwd=ROOT, shell=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            for line in iter(proc.stdout.readline, b""):
                self.out_queue.put(("out", decode_out(line).rstrip("\r\n")))
            proc.wait()
            self.out_queue.put(("done", f"[退出码 {proc.returncode}]"))
        except Exception as e:  # noqa: BLE001
            self.out_queue.put(("done", f"[执行出错] {e}"))

    def _start_server(self):
        """启动本地开发服务器（常驻进程，输出持续滚入日志）"""
        if self.server_proc and self.server_proc.poll() is None:
            self.log("本地服务器已在运行中（端口 8901）")
            return
        self.server_proc = subprocess.Popen(
            [NODE, os.path.join("tools", "dev-server.js")], cwd=ROOT,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.out_queue.put(("out", "—— 本地服务器启动中（站点 8901 / 后台 admin.html）——"))
        threading.Thread(target=self._pump_server, daemon=True).start()

    def _pump_server(self):
        for line in iter(self.server_proc.stdout.readline, b""):
            self.out_queue.put(("srv", decode_out(line).rstrip("\r\n")))
        self.out_queue.put(("srv", "—— 本地服务器已退出 ——"))

    def _stop_server(self):
        if self.server_proc and self.server_proc.poll() is None:
            self.server_proc.terminate()
            self.log("已发送停止指令给本地服务器")
        else:
            self.log("本地服务器当前没有运行")

    # ────────────────── 日志 ──────────────────
    def log(self, text):
        self.output.config(state="normal")
        self.output.insert("end", text + "\n")
        self.output.see("end")
        self.output.config(state="disabled")

    def _poll_queue(self):
        """主线程轮询子进程输出，刷新到界面"""
        try:
            while True:
                tag, text = self.out_queue.get_nowait()
                if tag == "done":
                    self.log(text)
                    self.running = False
                    self.status.config(text="就绪")
                else:
                    self.log(text)
        except queue.Empty:
            pass
        self.root.after(120, self._poll_queue)


def main():
    if "--selftest" in sys.argv:
        root = tk.Tk()
        app = DeployGUI(root)
        root.update_idletasks()
        root.update()
        app.log("selftest ok")
        root.update()
        root.destroy()
        print("SELFTEST OK")
        return
    root = tk.Tk()
    try:
        ttk.Style().theme_use("vista")
    except tk.TclError:
        pass
    DeployGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
