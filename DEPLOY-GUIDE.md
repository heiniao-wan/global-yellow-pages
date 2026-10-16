# 全球黄页 · GitHub 托管 + Cloudflare Pages 发布操作手册

> 适用环境：Windows + PowerShell，Git 用便携版（绝对路径调用），
> GitHub 账号 `heiniao-wan`。推送认证两种方式任选：
> ① **浏览器授权（推荐，免 PAT）**：部署助手 `deploy-gui.py` 里点「🔑 授权推送」，
>    首次会弹浏览器，用已登录的 GitHub 点一下 Authorize，凭据存进 Windows 凭据管理器，之后免输；
> ② PAT + store 模式（旧方案，仍可用）：凭据在 `C:\Users\heini\.git-credentials`。
> 全程零成本：GitHub 仓库免费 + Cloudflare Pages 免费额度足够纯静态站。

---

## 阶段 0 · 上线前检查（2 分钟，必做）

1. **替换法律页占位符**（`legal.html`），否则隐私投诉通道是死链：
   - 搜索 `privacy@example.com`（2 处）→ 改成你的真实邮箱（Gmail / QQ 邮箱均可，AdSense 要求可达）
   - 搜索「占位：请根据实际运营主体」→ 填管辖地，如「中华人民共和国」或「美国加州」
2. 确认根目录有这些文件（缺一不可）：
   `index.html`、`index-v2.html`、`legal.html`、`assets/`（css/js）、`_headers`
3. 本地最后跑一遍打开 `index.html`，确认四语切换、暗色切换、分类点击正常。

---

## 阶段 1 · 创建 GitHub 仓库

### 🌟 推荐路线：用「上传向导」一键搞定（不用手写命令）

```powershell
C:\Python\Python312\python.exe "D:\D-02_WorkBD\网页开发\github-uploader.py"
```

弹出向导窗口，**每一步都有输入框和提示框**，跟着填即可：

| 步骤 | 你要做的事 |
|---|---|
| ① 选择登录方式 | 选「网页授权登录」（推荐）——程序给你 8 位码，浏览器自动打开 GitHub，你粘贴码点 **Authorize** 即可，**全程不用 PAT** |
| ② 填写仓库信息 | 账号名、仓库名、分支、简介（已预填 `heiniao-wan/global-yellow-pages`）；再选公开 / 私有 |
| ③ 身份与提交说明 | 提交署名（名字 + 邮箱）和本次提交说明 |
| ④ 网页授权登录 | 复制大字设备码（已自动复制到剪贴板）→ 网页粘贴 → Continue → 绿色 Authorize → 回来点「我已完成授权」 |
| ⑤ 确认上传清单 | 显示将上传的文件数量与关键项，点「是」开始 |
| ⑥ 执行上传 | 自动完成 建仓 → 暂存 → 提交 → 推送，实时日志；完成后弹仓库地址，可一键打开 |

要点：仓库不存在时**自动创建**；令牌只用一次、不保存、日志里显示为 `***`；失败会明确提示在哪一步。
想每步都弹确认框，勾选窗口底部的「详细模式」。

> 部署助手 `deploy-gui.py` 里也加了「🚀 上传向导」按钮，点一下就会打开这个向导。

### 备选路线：手动在网页创建仓库

1. 浏览器打开 https://github.com/new ，登录 `heiniao-wan`
2. 填写：
   - **Repository name**：`global-yellow-pages`（可自定，下文均以此为例）
   - **Description**：全球黄页 · 多语言网站导航与口碑库
   - **可见性**：选 `Public`（Cloudflare Pages 对 Public 仓库授权最顺；Private 也能用，见附录 A）
   - **不要**勾选 "Add a README"、"Add .gitignore"、"Choose a license"（保持空仓库，否则推送要先合并）
3. 点 **Create repository**，创建后**不要关页面**，复制仓库地址：
   `https://github.com/heiniao-wan/global-yellow-pages.git`

---

## 阶段 2 · 本地推送到 GitHub（PowerShell，3 分钟）

> 注意：这些命令在你自己的 PowerShell 里跑（WorkBuddy 沙箱连不上 GitHub）。

```powershell
# 1. 进入项目目录
cd D:\D-02_WorkBD\网页开发

# 2. 初始化仓库（main 分支）
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" init -b main

# 3. 添加全部文件并提交（.gitignore 会自动排除 .workbuddy 本地数据）
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" add .
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" commit -m "全球黄页 v1.0：335 站点 / 17 分类 / 四语 / 暗色切换 / 法律合规页"

# 4. 关联远程仓库并推送
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" remote add origin https://github.com/heiniao-wan/global-yellow-pages.git
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" push -u origin main
```

**可能遇到的情况**：
- 认证优先用部署助手的「🔑 授权推送」：自动配置 GCM（凭据管理器）并推送，首次弹浏览器点一下 Authorize 即可，**全程不用 PAT**。
- 若仍弹出登录窗口：用户名 `heiniao-wan`，密码填 **PAT**（存在 `C:\Users\heini\.git-credentials`）。
- 实在不行用兜底：部署助手「🌐 网页传」会打开 GitHub 网页上传页 + 本地文件夹，把文件拖进网页提交（注意：网页上传不会删除远端已有文件）。
- 提示 `remote origin already exists`：说明之前关联过，跳过第 4 步第一条直接 push。
- 推完刷新 GitHub 仓库页面，能看到 `index.html` 等文件即成功。

---

## 阶段 3 · Cloudflare Pages 创建站点（网页操作，5 分钟）

1. 打开 https://dash.cloudflare.com → 左侧 **Workers & Pages** → **Create** → 切到 **Pages** 标签 → **Connect to Git**
2. 选择 **GitHub** → 弹窗授权：选 `Only select repositories`，勾上 `global-yellow-pages` → Install
3. 回到 Cloudflare，选中该仓库，进入构建配置，**三项全部照抄**：
   | 配置项 | 值 |
   |---|---|
   | Framework preset | `None` |
   | Build command | （留空） |
   | Build output directory | `/` |
4. 点 **Save and Deploy**，约 30 秒后得到网址：
   `https://global-yellow-pages.pages.dev`（名字自动取自仓库名）
5. 以后每次 `git push`，Cloudflare 会**自动重新部署**，无需手动操作。

---

## 阶段 4 · 绑定自定义域名（可选，10 分钟）

### 情况 A：还没有域名
在 Cloudflare 买一个最方便：左侧 **Domain Registration → Register Domains**，按成本价出售（`.com` 约 $10/年），买完自动托管在 Cloudflare，直接跳到下面第 2 步。

### 情况 B：域名在别家注册商
先把域名接入 Cloudflare（添加站点 → 选 Free 计划 → 按提示去注册商处把 NS 改成 Cloudflare 给的两条 → 等生效，几分钟到几小时）。

### 绑定操作（两种情况一样）：
1. 进入 Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入域名，如 `yellowpages.example.com`（或裸域 `example.com`）
3. Cloudflare 自动添加 CNAME 记录指向 `global-yellow-pages.pages.dev`，确认即可
4. SSL 证书自动签发（几分钟），`https://` 直接可用
5. 可同时绑定根域 + `www.` 子域，选一个作为主域（另一个 301 跳转）

---

## 阶段 5 · 上线验证清单

- [ ] `https://你的域名/` 打开是中文版（V1 苹果风）
- [ ] `https://你的域名/index-v2.html` 是 V2 NEO 暗色版
- [ ] 顶栏语言下拉切 English / 日本語 / 한국어 界面文字变化
- [ ] 🌙 切暗色、分类点击、搜索回车正常
- [ ] 页脚「隐私政策」打开 `legal.html`，占位符已替换
- [ ] 投一次票刷新后仍在（本机 localStorage）
- [ ] F12 控制台无红色报错

**注意**：投票数据存在每个访问者自己的浏览器里（无后端），不同用户看到的票数互不相通——这是当前架构的已知边界，接云数据库后才全站共享。

---

## 阶段 6 · 日常更新流程（3 条命令）

改完代码后，在你自己的 PowerShell 里：

```powershell
cd D:\D-02_WorkBD\网页开发
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" add .
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" commit -m "更新说明"
& "C:\Users\heini\.workbuddy\binaries\PortableGit\versions\1.3.0\cmd\git.exe" push
```

推送后 Cloudflare 自动重新部署，约 30 秒生效。

---

## 附录 A · 私有仓库说明

Cloudflare Pages 支持私有仓库（通过 GitHub App 授权，阶段 3 一样操作）。
但注意：GitHub 免费账户的 **Pages 托管**（如果以后想换 GitHub Pages）对私有仓库要 Pro 计划；Cloudflare Pages 无此限制。维持现状（私有仓库 + Cloudflare Pages）即可，与 mech-calc-tools 一致。

## 附录 B · `_headers` 文件（已备好）

仓库根目录的 `_headers` 会给全站加安全响应头（禁止 iframe 嵌套、MIME 嗅探防护等）并对 `assets/` 设一天缓存。AdSense 审核&安全扫描都加分，无需额外配置。

## 附录 C · `tools/` 目录说明

`tools/` 里是本地开发校验脚本（数据校验、防刷测试、可达性检查），不含密钥或敏感信息，随仓库公开无风险；不想公开也可以在 `.gitignore` 加一行 `tools/` 再重新提交。

## 附录 D · 关于邮箱通道（已按隐私要求移除）

反馈表单**只有一条通道**：留言后台（附录 F）。访客的联系方式与留言内容仅存于
Cloudflare KV，仅站长凭 ADMIN_KEY 在 `admin.html` 查看——**不会发送到任何邮箱、不会公开**。
早期版本可选的 Web3Forms「留言直发站长邮箱」备选通道已移除（避免访客隐私数据落入邮箱）；
若历史配置里有 `accessKey`，删除即可，代码已不再读取。

## 附录 E · PWA（可安装 / 离线）

项目根目录已带 `manifest.webmanifest` + `sw.js` + `assets/img/icon.svg`，部署后自动生效：
- 手机浏览器打开站点 →「添加到主屏幕」即可像 App 一样全屏启动
- 离线时可继续浏览已访问过的页面与静态资源
- Service Worker 版本号在 `sw.js` 顶部 `CACHE` 常量，改动静态资源后 +1 即可让用户拿到新版
- 注：iOS 的「添加到主屏幕」用页面截图作图标；Android/Chrome 用 manifest 图标

## 附录 F · 留言后台（Cloudflare Pages Functions + KV，推荐）

访客在主页反馈表单留言 → 存入云端 KV → 你在 `admin.html` 用密钥查看/删除。
访客**零操作**（不用打开邮箱客户端）；留言对公众完全不可见，只有持有 ADMIN_KEY 的你能看。
`app.js` 里的 `FEEDBACK.endpoint = '/api/feedback'` 已预置，按下面三步开通即自动生效；
没开通时表单会提示「发送失败，请稍后重试」；开通后留言直接入库，你到 `admin.html` 查看。

### F-1 创建 KV 并绑定（Cloudflare 网页操作）

1. 登录 dash.cloudflare.com → 左侧 **Storage & Databases → KV**
2. **Create namespace**，名称随意（如 `gyp-messages`）
3. 进入你的 Pages 项目 → **Settings → Functions → KV namespace bindings**
4. **Add binding**：变量名填 `MESSAGES`，选刚创建的命名空间 → Save

### F-2 配置管理员密钥

1. Pages 项目 → **Settings → Environment variables**
2. **Add**：变量名 `ADMIN_KEY`，值自己定一个强密码（如 20 位随机字符串）
   - Production 和 Preview 都加
   - 这个值就是 admin.html 的登录密钥，**只保存在 Cloudflare 和你自己的密码管理器里**

### F-3 重新部署 + 验证

1. 推送一次代码触发部署（functions 目录会自动上线，用你常用的推送流程即可）
2. 验证提交：主页反馈表单发一条测试留言 → 显示「发送成功」
3. 验证后台：打开 `https://你的域名/admin.html` → 输入 ADMIN_KEY → 看到留言（含时间/站点/联系方式/IP）
4. 后台支持单条删除；密钥保存在浏览器会话里，关标签页即失效

### 说明与防护

- 入口：`functions/api/feedback.js`（提交）、`functions/api/messages.js`（查看/删除）；`admin.html` 不要外链，知道地址 + 持有密钥才能看
- 防滥用：服务端二次校验字段格式与联系方式规则；同一 IP 每分钟限 1 条（429，前端提示「发送太频繁」）
- KV 免费额度：每天 10 万次读 / 1000 次写，个人站绰绰有余
- 本地测试：Functions 只在 Cloudflare 上运行；想本地体验完整流程用 `node tools/dev-server.js`（真实运行 /api，密钥 `gyp-admin-dev-2026`），普通静态服务器打开时表单会提示发送失败（属正常现象）
- `tools/verify-functions.js`：Functions 逻辑的本地单测（21 项），改动这两个文件后跑一遍
