# 🧭 全球黄页 · Global Yellow Pages

> **🌐 线上站点：https://ypage.ccwu.cc/**

**中文**：收录全球优质网站的多行业导航与口碑库。每个站点都有首页截图（点开前先看清楚）、官网直达按钮，以及真实用户的三向投票（点赞 / 不喜欢 / 无法访问）。17 个行业、335 个站点，四语界面，无广告、无第三方追踪。

**English**: A curated directory of **335 of the world's most useful websites**, organized into **17 industries** — Search, AI & LLMs, Developer & Tech, Finance, Travel, Machinery and more. Every entry shows a **live homepage screenshot** so you know what you're opening, and you can vote **👍 good / 👎 dislike / ⚠️ broken** to surface what's actually worth visiting. Four languages (zh / en / ja / ko), installs as a PWA, no ads and no tracking.

```
🧭 Global Yellow Pages — 335 hand-picked websites across 17 industries.
   Homepage screenshots · community voting · 4 languages · no ads, no tracking
   → https://ypage.ccwu.cc/
```

| | |
|---|---|
| 官网 Live site | https://ypage.ccwu.cc/ |
| 无 JS 全站索引（335 站全量链接，零 JS） | https://ypage.ccwu.cc/sites.html |
| V2 科技风版本 | https://ypage.ccwu.cc/index-v2.html |

## 功能

| 需求 | 实现 |
|---|---|
| 全球黄页收录，按行业分类 | 17 个一级分类，335 个真实站点，覆盖中国 / 日本 / 韩国 / 欧美 / 东南亚 |
| 按钮式控件，点击直达官网 | 卡片内「访问网站」按钮，`target="_blank"` + `rel="noopener noreferrer nofollow"` |
| 三个投票按钮 + 数据图表 | 点赞 / 不喜欢 / 无法访问，环形图 + 分类分布条形图 + 口碑榜 |
| 同一 IP 只许投一次（防恶意点击） | 六层信号叠加防护，详见下方 |
| 首页自动截图 | 三级降级：mShots → Microlink → favicon → 占位卡 |
| 苹果风格简洁美观 | 毛玻璃导航、大留白、柔和圆角、克制的系统色 |
| 两套皮肤 | V1 苹果风（`index.html`，含暗色模式）、V2 未来科技风（`index-v2.html`） |
| 四语切换 | 简体中文 / English / 日本語 / 한국어（`assets/js/i18n.js`） |
| 收藏与口碑榜 | 星标收藏常驻胶囊；口碑榜按好评率排序，动态 TOP n |
| 本地数据加密 | 票数与收藏经 `vault.js` 加密后落 `localStorage`，键前缀 `gyp:` |
| 安装到桌面 | PWA：`manifest.webmanifest` + `sw.js` |
| 站长留言后台 | Cloudflare Pages Functions + KV（`functions/api/*`、`admin.html`） |
| SEO / 社交卡片 | `robots.txt`、`sitemap.xml`、静态索引 `sites.html`、OG 封面 `og-cover.png`、IndexNow 已提交 |

## 快速开始（访客视角）

打开 https://ypage.ccwu.cc/ → 选行业 → 看截图 → 点「访问网站」→ 回来投一票 → 顺手收藏。
不启用 JavaScript 也能看全量列表：https://ypage.ccwu.cc/sites.html

## 防刷机制

需求里说「每个 IP 只允许点击一次」。但单靠 IP 有两个硬伤：

- **误伤真实用户** — 家庭宽带、公司网络、校园网共用同一个出口 IP，一整屋子的用户会被当成同一个人锁票。
- **挡不住专业刷票** — 刷票方改个代理 IP 就绕过去了。

所以实现的是参考 Google AdSense 无效流量识别思路的**多信号复合判定**，指纹为主、IP 为辅：

| 层 | 手段 | 拦什么 |
|---|---|---|
| ① | 蜜罐字段 | 视觉隐藏但对脚本可见的输入框，填了就是机器 |
| ② | 交互时序 | 快于人类反应极限（800ms）的点击直接拦下 |
| ③ | 浏览器指纹 | Canvas + WebGL GPU + 屏幕 + 时区 + 语言哈希，换 IP 也认得出同一台设备 |
| ④ | 速率限制 | 滑动窗口内每分钟最多 20 次 |
| ⑤ | 一票定终身 | `指纹 × 站点ID` 联合唯一键，投过不可改 |
| ⑥ | 存活性检测 | 后台标签页发起的投票不予采信 |

### ⚠️ 必须知道的局限

当前是**纯静态站点**，前端校验逻辑对访问者可见，理论上可被绕过。真正的强制去重必须在服务端完成。

而且纯前端**拿不到访问者的真实公网 IP**，所以现在的「IP 限制」实际上是以指纹为主。这是一次产品取舍，不是 bug。

接入云数据库后，同样的信号会在服务端强制校验，前端拦截只是第一道过滤 —— 到那时才是真正的铁闸。

## 数据存放

投票数据与收藏存在浏览器 `localStorage`，**经 `vault.js` 加密**后落盘，**仅本机可见**，用于查看统计效果。接入数据库后票数全站共享。

存储键（全部以 `gyp:` 开头）：
- `gyp:counts` — 各站点累计票数
- `gyp:favs` — 我的收藏
- `gyp:voted:<指纹>:<站点ID>` — 一票定终身的锁
- `gyp:rate:<指纹>` — 滑动窗口计数
- `gyp:visitor` — 本机访客标识
- `gyp:theme` / `gyp:lang` / `gyp:consent` — 界面偏好

访客留言则走服务端：Cloudflare Pages Functions → KV `MESSAGES`，仅站长凭 `ADMIN_KEY` 在 `admin.html` 查看，**不发送任何邮件、不公开**。

## 本地运行

```bash
# 任选一种静态服务器
python -m http.server 8899
# 打开 http://127.0.0.1:8899
```

直接双击 `index.html` 用 `file://` 打开也能跑，但截图服务可能受浏览器安全策略限制，建议用 http 起服务。

## 部署到 Cloudflare Pages

| 配置项 | 值 |
|---|---|
| 框架 | None |
| 构建命令 | 留空 |
| 输出目录 | `/` |
| 分支 | `main` |

`index.html` 和 `assets/` 必须在仓库根目录。

## 目录结构

```
├── index.html                  V1 页面（苹果风，含暗色模式）
├── index-v2.html               V2 页面（未来科技风）
├── admin.html                  站长留言后台（需 ADMIN_KEY，已 noindex）
├── sites.html                  纯静态全站索引（335 条链接，零 JS，供爬虫/无 JS 访客）
├── robots.txt / sitemap.xml    SEO 基建
├── assets/
│   ├── css/style.css           视觉系统（V1 苹果风）
│   ├── css/style-v2.css        视觉系统（V2 科技风）
│   ├── img/og-cover.png        1200×630 社交分享封面
│   └── js/
│       ├── data.js             335 个站点的种子数据 + 分类定义 + 品牌色派生
│       ├── i18n.js             四语词条
│       ├── vault.js            本地数据加密存储
│       ├── antiabuse.js        六层防刷引擎
│       ├── thumbs.js           首页截图三级降级
│       ├── app.js / app-v2.js  渲染 / 搜索 / 投票 / 图表
│       ├── share.js            V1↔V2 与多标签页的数据共享层（统一读写 + 历史键合并 + 广播同步）
│       └── sw.js               PWA Service Worker（JS/CSS 网络优先，离线可用）
├── functions/api/              Cloudflare Pages Functions（留言入库 / 列表 / 删除）
├── tools/
│   ├── verify-data.js          数据完整性校验
│   ├── verify-antiabuse.js     防刷逻辑单测（14 项）
│   ├── verify-storage.js       存储层单测（11 项）
│   ├── verify-functions.js     Functions 单测（21 项）
│   ├── verify-remote.py        外网可达性检测（38 文件逐个拉取）
│   ├── gen-seo.py              生成 robots / sitemap / sites.html / OG 封面
│   ├── promote-submit.py       IndexNow / Yandex 搜索引擎提交
│   ├── gh-api-commit.py        通过 GitHub API 提交文件（git 协议不通时的备用通道）
│   ├── dev-server.js           本地联调服务器（:8901，模拟 KV）
│   └── e2e-vote-share.js       无头 Chrome 实测 V1/V2 数据共享（`node tools/e2e-vote-share.js [--live]`）
├── github-uploader.py          图形化上传向导（Tkinter）
└── 上传GitHub.bat              双击即可运行上传向导
```

## 数据校验

```bash
node tools/verify-data.js         # 数据完整性
node tools/verify-antiabuse.js    # 防刷 14 项
node tools/verify-storage.js      # 存储 11 项
node tools/verify-functions.js    # 留言后台 21 项
python tools/verify-remote.py     # 外网可达性（38 文件逐个拉）
```

## 扩充站点

直接在 `assets/js/data.js` 的 `SITE_DATA` 数组里加一行即可，ID、域名、favicon、品牌色会自动派生：

```js
{ name: '站名', url: 'https://example.com', category: 'ai', desc: '一句话中文简介，20~35 字。', region: '欧美', lang: '英文' }
```

`category` 必须是 `SITE_CATEGORIES` 里已定义的 key。`region` 限定 `中国 / 日本 / 韩国 / 欧美 / 全球 / 东南亚 / 其他`，`lang` 限定 `中文 / 英文 / 日文 / 韩文 / 多语言`。

## 宣传与收录

- 对外文案（中 / 英 / 日 / 韩四语，含 X、Show HN、Product Hunt 版本）见 [`PROMOTION.md`](PROMOTION.md)
- 部署与运维手册见 [`DEPLOY-GUIDE.md`](DEPLOY-GUIDE.md)
- 搜索引擎已通过 IndexNow 提交（覆盖 Bing / Yandex / Seznam / Naver / Yep）；Google 需在 Search Console 手动提交 `sitemap.xml`

觉得缺了哪个站点或哪个行业？在 https://ypage.ccwu.cc/ 底部「网站反馈」留一句即可，会持续补充。

## 许可与合规

站点已配置隐私政策与条款页（`legal.html`），未启用广告前不加载 Cookie 提示；所有外链均带 `rel="noopener noreferrer nofollow"`。内容数据仅作导航索引之用，版权归各站点所有。