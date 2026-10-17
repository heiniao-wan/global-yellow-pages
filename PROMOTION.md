# 全球黄页 · 对外宣传作战包

站点：https://ypage.ccwu.cc/
静态索引页（供爬虫与无 JS 环境）：https://ypage.ccwu.cc/sites.html

---

## 一、已经做完的（技术层，无需你操作）

| 动作 | 状态 |
| --- | --- |
| `robots.txt` 实体文件（原来被 SPA 回退成首页 HTML，等于没有） | ✅ 已修复上线 |
| `sitemap.xml`（4 个页面，含 sitemap 声明） | ✅ 已上线 |
| `sites.html` 纯静态全站索引（**335 条真实外链**、17 类、零 JS） | ✅ 已上线（337 个 https 链接） |
| OG / Twitter Card 社交卡片元信息 + canonical + hreflang | ✅ 注入首页与 V2 |
| `og-cover.png` 1200×630 分享封面（中英文标题） | ✅ 已上线 |
| IndexNow 提交 → **Bing / Yandex / Seznam / Naver / Yep** | ✅ HTTP 202 已接收 |
| Yandex sitemap ping | ✅ HTTP 200 |
| Google | ⏳ 需你在 Search Console 手动验证一次（见第三节） |

> 补一句关键背景：首页原来**原始 HTML 里 0 条外链**，全靠 JS 渲染。除 Google 外多数引擎、以及所有社交平台爬虫（Twitter/微信/Telegram/Discord 的链接预览）都读不到内容、也生成不了卡片。现在 `sites.html` 把这件事补上了，分享出去才有封面和摘要。

---

## 二、可直接复制发布的文案

### 🇨🇳 中文 · 短版（微博 / 即刻 / 小红书 / 朋友圈）

> 做了一个「全球黄页」：335 个精选网站，17 个行业分类，带首页截图和真实口碑投票，中英日韩四语。
> 找工具不用再翻收藏夹了 👉 https://ypage.ccwu.cc/

### 🇨🇳 中文 · 长版（知乎 / 掘金 / 少数派）

> **标题**：我整理了一份 335 个网站的全球黄页，带截图和口碑投票
>
> 起因是自己找工具站每次都要翻半天收藏夹，于是干脆做了一份全球黄页：
>
> - 335 个站点，17 个行业分类（搜索、AI、开发、设计、电商、视频、机械…）
> - 每个站点带首页截图，打不开的会自动标注
> - 三档投票（好评 / 不喜欢 / 打不开），数据本地加密存储，每站每 IP 限一票
> - 支持中 / 英 / 日 / 韩四语切换，PWA 可装到桌面
> - 纯静态，无追踪，无广告
>
> 地址：https://ypage.ccwu.cc/
> 不想开 JS 也能看全量列表：https://ypage.ccwu.cc/sites.html
>
> 缺什么站点欢迎留言，会持续补。

### 🇺🇸 English · Twitter / X

> 🧭 Global Yellow Pages — 335 hand-picked websites across 17 industries, with homepage screenshots and community voting. 4 languages, no tracking, no ads.
> https://ypage.ccwu.cc/

### 🇺🇸 English · Show HN（Hacker News）

> Show HN: Global Yellow Pages – 335 curated sites with screenshots and reputation voting
>
> I kept losing track of useful sites in my bookmarks, so I built a yellow pages: 335 sites in 17 categories, each with a homepage screenshot and three-way voting (good / dislike / broken). Votes are stored encrypted in the browser, one per site per IP. Supports zh/en/ja/ko, installs as a PWA, no ads and no third-party trackers.
> There's also a no-JS index with all 335 links: https://ypage.ccwu.cc/sites.html
> Feedback on missing categories welcome.

### 🇺🇸 English · Product Hunt

> **Tagline**（≤60 字符）：Global Yellow Pages — 335 curated sites, screenshots, votes
>
> **Description**：
> A curated directory of 335 of the world's most useful websites, organized into 17 industries.
> Every entry shows a homepage screenshot so you know what you're opening, and you can vote
> good / dislike / broken to surface what's actually worth visiting. Four languages (zh/en/ja/ko),
> installs as a PWA, no ads and no tracking.
>
> **首条评论（Maker's comment）**：
> Hi PH 👋 I built this because my bookmark bar stopped being usable. Two details I'd highlight:
> sites that fail to load get flagged automatically, and there's a static, JavaScript-free index
> page (ypage.ccwu.cc/sites.html) so the content stays crawlable and usable everywhere.
> Happy to add any category you think is missing.

### 🇯🇵 日本語（Twitter / note）

> 🧭 世界の厳選サイト 335 件を 17 業種に整理した「グローバル・イエローページ」を作りました。
> 各サイトのスクリーンショット付き、評価投票もできます。中英日韓の4言語対応。
> https://ypage.ccwu.cc/

### 🇰🇷 한국어（Twitter / 블로그）

> 🧭 전 세계 엄선 사이트 335개를 17개 업종으로 정리한 글로벌 옐로페이지를 만들었습니다.
> 스크린샷 + 평가 투표, 중·영·일·한 4개 언어 지원, 광고·추적 없음.
> https://ypage.ccwu.cc/

---

## 三、发布渠道清单（按推荐顺序，附各家规矩）

| # | 渠道 | 怎么用 | 规矩（不看容易被删/封） |
| --- | --- | --- | --- |
| 1 | **Google Search Console** | search.google.com/search-console → 添加「网址前缀」→ 验证所有权 → 提交 sitemap.xml → 网址检查「请求编入索引」 | 必做，否则 Google 可能几周才抓到 |
| 2 | **Reddit · r/InternetIsBeautiful** | 贴英文短版 + 链接 | 非商业、无广告才行；标题别带营销词；先看侧栏规则 |
| 3 | **Hacker News · Show HN** | news.ycombinator.com/submit，标题 `Show HN: …` | 只接受项目讨论，不接受营销；最好在评论里解释技术细节 |
| 4 | **Product Hunt** | producthunt.com/posts/new | 北京时间凌晨 1 点发布效果最好；要准备好首条 Maker 评论 |
| 5 | **V2EX · 分享创造** | v2ex.com/go/share | 标题写清「分享创造」，正文讲动机和技术，不要只丢链接 |
| 6 | **Indie Hackers** | indiehackers.com | 讲做站的故事和数据，比发链接有效 |
| 7 | **知乎 / 掘金 / 少数派** | 发中文长版 | 少数派要求原创深度，别纯发链接；掘金放「随笔/工具」分区 |
| 8 | **微博 / 即刻 / 小红书** | 中文短版 + 封面图 | 带上 og-cover.png 当配图，小红书需做成图文卡片 |
| 9 | **Telegram / Discord 相关群** | 英文短版 | 先潜水看群规，很多群禁止纯广告；以「求反馈」的姿态发 |
| 10 | **BetaList / SaaSHub / Curlie.org** | 提交站点（需注册） | Curlie 是 DMOZ 继承者，按类目提交，审核慢但外链质量高 |
| 11 | **Bing / Yandex 站长平台** | bing.com/webmasters、webmaster.yandex.com | 已通过 IndexNow 推送，去平台确认收录状态即可 |
| 12 | **同类导航站交换友链** | 找 10~20 个导航站站长邮件互换 | 对 SEO 最有效，但要逐个手写邮件，别群发 |

### 发布节奏建议

- **第 1 天**：Search Console 提交 + Reddit + V2EX
- **第 3 天**：Show HN（避开周末，周二~周四上午美西时间效果最好）
- **第 5 天**：Product Hunt（凌晨 1 点，配好首条评论）
- **第 2 周**：四语推特 + 知乎/掘金长文 + 目录站提交
- **长期**：每月补 20~30 个新站点，保持 `sites.html` 更新（跑 `python tools/gen-seo.py` 会自动重生成）

---

## 四、维护命令

```powershell
cd D:\D-02_WorkBD\网页开发
C:\Python\Python312\python.exe tools\gen-seo.py --base https://ypage.ccwu.cc   # 重生成 sitemap/索引页/封面
C:\Python\Python312\python.exe tools\promote-submit.py --host ypage.ccwu.cc    # 再推一次 IndexNow
C:\Python\Python312\python.exe tools\verify-remote.py                          # 检查外网可达性
```

---

## 五、我没法替你做的

社交平台发帖需要你的账号登录（X / Reddit / HN / PH / 微信 / 微博…），代发等于冒用身份，也不符合各平台规则。
上面的文案都是复制即用的，你挑渠道贴就行；需要我按某个平台的字数/语气再改一版，说一声。
