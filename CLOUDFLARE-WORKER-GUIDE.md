# Cloudflare Pages 留言后台开通指引（KV + Worker 绑定）

> 目标：让 https://ypage.ccwu.cc 的「反馈留言」真正入库，站长能用 `admin.html` 看留言。
> 适用：已在 Cloudflare Pages 上线本项目（GitHub 自动部署）、框架 None / 构建命令空 / 输出目录 `/`。
> 最后更新：2026-10-18

---

## 先搞清楚一件事：你要的"Worker"已经存在了

在 Cloudflare 的产品里：

| 你看到的名字 | 实际是什么 |
|---|---|
| **Pages Functions** | 就是运行在 Cloudflare 边缘的 **Worker**，只不过由 Pages 项目自动托管和部署 |
| **Workers**（独立 Worker） | 单独创建的服务，需要自己部署、自己绑路由 |

本项目的 `functions/api/feedback.js`、`functions/api/messages.js` 就是 **Pages Functions（= Worker）**。
只要它们在仓库里被推送上去，Cloudflare 会自动打包上线并挂到 `https://ypage.ccwu.cc/api/*`。

✅ **所以你不需要点"Create Worker"。** 真正缺的是两样**绑定**：
1. KV 命名空间绑定 `MESSAGES`（存留言）
2. 环境变量/密钥 `ADMIN_KEY`（后台登录密钥）

---

## 第 1 步 · 创建 KV 命名空间

1. 打开 https://dash.cloudflare.com 并登录
2. 左侧菜单 **Storage & Databases → KV**（有的版本叫 **Workers KV**）
3. 点右上角 **Create namespace**
4. 命名空间名称填：`gyp-messages`（名称随意，只要好认）
5. 点 **Add** 创建
6. 记下它的 **Namespace ID**（一串 32 位十六进制），列表里也能看到

> 💡 免费额度：10 万次读 / 1000 次写 **每天**，个人站完全够用。

---

## 第 2 步 · 把 KV 绑到 Pages 项目

1. 左侧 **Workers & Pages**（有的版本叫 Compute / Workers）
2. 点进你的项目 **`global-yellow-pages`**
3. 顶部标签点 **Settings**
4. 左侧子菜单找到 **Bindings**（KV 绑定和 Variables and Secrets 都在 Settings 这一层）
5. 点 **Add binding**
6. 填：
   - **Variable name（变量名）**：`MESSAGES` ← 必须一字不差，全大写
   - **Type**：选 `KV Namespace`
   - **KV namespace**：下拉选 `gyp-messages`
7. 点 **Add binding / Save**

> ⚠️ 变量名必须是 `MESSAGES`，代码里读的是 `env.MESSAGES`，填错会返回 `KV not bound`。

---

## 第 3 步 · 设置管理员密钥 ADMIN_KEY

1. 还在 Pages 项目里 → **Settings → Variables and Secrets**
   （旧版界面叫 Environment variables，是同一个地方）
2. 页面顶部有 **Production ｜ Preview** 两个标签页，先确认当前停在 **Production**
3. 点 **Add**，填：
   - **Type**：选 **Encrypt**（明文可见会变成 Secret；不选则存成明文变量）
   - **Variable name**：`ADMIN_KEY`
   - **Value**：自己定一个强密码，建议 20 位以上随机串
4. 点 **Save**
5. **再点一次 Add**，重复上面三步，这次把顶部标签切到 **Preview**，名字同样填 `ADMIN_KEY`

> ⚠️ **Production 和 Preview 不是勾选框，是两个分开的标签页。**
> 你必须**添加两次**才能两个环境都有这个变量——只在 Production 加的话，
> 预览分支（每个 PR / 其他分支的部署）读不到 ADMIN_KEY，测试时会误判成"密钥没配"。
> 两个环境的值可以设成不同值，测试时互不干扰。

**生成强密码的两种办法**（任选其一）：

```powershell
# 方式 A：PowerShell 20 位随机
-join ((1..20) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

```bash
# 方式 B：Python
python -c "import secrets;print(secrets.token_urlsafe(24))"
```

> 🔐 这个值 = 你在 `admin.html` 登录时输入的密钥。
> **不要**用 `gyp-admin-dev-2026` 这种本地开发默认值，也**不要**写进任何提交到 GitHub 的文件。
> 只保存在 Cloudflare 控制台 + 你的密码管理器里。

---

## 第 4 步 · 重新部署让绑定生效

改了绑定和变量后，**必须重新部署**才生效。

- 方式 1（推荐）：随便改一个文件再推送一次，Cloudflare 自动重新部署
- 方式 2：Pages 项目 → **Deployments** → 找到最新一次 → 右侧 **⋯ → Retry deployment**

部署日志里应该能看到 Functions 被编译打包的步骤。

---

## 第 5 步 · 四步验证

### ① 提交留言（公开接口，无需密钥）

浏览器打开你的主页 → 反馈表单填一条测试留言 → 应提示「发送成功」。

或命令行：

```bash
curl -X POST https://ypage.ccwu.cc/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"site":"测试站点","cat":"AI工具","msg":"这是一条测试留言","email":"test@example.com"}'
```
预期：`{"ok":true,"id":"fb:xxx"}`

### ② KV 未绑定时会看到什么

如果返回 `{"ok":false,"error":"KV not bound"}` → 第 2 步的变量名填错或没重新部署。

### ③ 后台读取（需密钥）

```bash
curl https://ypage.ccwu.cc/api/messages -H "Authorization: Bearer 你的ADMIN_KEY"
```
预期：返回 `{"ok":true,"messages":[...]}`，包含刚才那条留言。

不带密钥或密钥错 → `401 {"ok":false,"error":"unauthorized"}`（这是**正常的保护行为**）。

### ④ 页面验证

打开 `https://ypage.ccwu.cc/admin.html` → 输入 ADMIN_KEY → 应看到留言列表（时间 / 站点 / 联系方式 / IP / UA），支持单条删除。

---

## 常见问题排查

| 现象 | 真正原因 | 解决 |
|---|---|---|
| 表单提示「发送失败，请稍后重试」 | 静态服务器打开的，或 API 404 | Functions 只在 Cloudflare 上运行；确认域名是 Pages 域名且已重新部署 |
| `KV not bound` | 变量名不是 `MESSAGES`，或加完没重新部署 | 回第 2 步核对变量名 → 第 4 步重新部署 |
| 后台提示「密钥不正确，或服务器未配置 ADMIN_KEY」 | ADMIN_KEY 没设 / 只加了 Production 没加 Preview / 加完没重新部署 | 回第 3 步；Preview 环境要**单独再 Add 一次**（同名 ADMIN_KEY） |
| 401 但密钥确定没错 | 前后端差一个空格或换行 | 密钥前后不要有空格；`Bearer` 后有一个空格 |
| 提交返回 429「发送太频繁」 | 同 IP 1 分钟内已有留言 | 等待 1 分钟，或换网络（设计如此，防滥用） |
| **连发两条都不 429，限流像没生效** | **KV 最终一致性**：写入最多 60 秒才对其他边缘节点可见 | 不是故障，实测间隔 2 秒两条都会入库；限流在分钟尺度上生效 |
| 后台看不到刚提交的留言 | 同上，KV 有约 60 秒全球传播延迟 | 等 1 分钟再刷新（Cloudflare KV 特性，非 bug） |

---

## 安全须知

- `admin.html` **不要**放进任何外链或 README，知道地址 + 持有密钥才能看
- 留言内容对公众完全不可见，只有持 ADMIN_KEY 的你能读
- 访客的联系方式只存 Cloudflare KV，**不发送到任何邮箱**
- 若怀疑密钥泄露：Cloudflare → Pages → Settings → **Variables and Secrets** 删掉 `ADMIN_KEY` 重新生成，旧密钥立即失效
- 同 IP 每分钟 1 条限流已实现在 `feedback.js`（KV 计数，2 分钟 TTL 自动过期）

---

## 相关文件速查

| 文件 | 作用 |
|---|---|
| `functions/api/feedback.js` | POST 留言入库（公开） |
| `functions/api/messages.js` | GET/DELETE 管理员查看删除（Bearer 鉴权） |
| `admin.html` | 后台页面，登录框输入 ADMIN_KEY |
| `assets/js/app.js` 第 704 行 | `FEEDBACK.endpoint = '/api/feedback'` 已预置 |
| `tools/verify-functions.js` | Functions 逻辑本地单测（21 项），改动后跑一遍 |
| `node tools/dev-server.js` | 本地跑完整 /api 流程（开发密钥，非线上） |
| `DEPLOY-GUIDE.md` 附录 F | 项目内的原始部署说明 |

---

## 一句话总结

**不用建 Worker。** `functions/` 目录已经是 Worker，上线自动生效。
你只需要：**建 KV → 绑定 `MESSAGES` → 设密钥 `ADMIN_KEY` → 重新部署 → 四步验证**。