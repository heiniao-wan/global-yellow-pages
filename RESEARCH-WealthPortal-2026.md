# 研究笔记：The Wealth Portal（thewealthportal.com）

> 2026-10-18 调研。目的：学习其站点结构、转化设计与技术实现，提炼可借鉴点。

## 一、这是什么网站

- **定位**：YouTube 千万级理财博主 **Mark Tilbury** 的付费会员制在线学院（"The Only Academy You Need to Build a Profitable Online Income in 2026"）。
- **Slogan**：Learn, Earn and Invest With Mark Tilbury。
- **运营主体**：Tilbury Ventures LTD（页脚版权）。
- **当前状态**：**Waitlist（候补名单）模式** —— 全站所有 CTA 都是 "Join Waitlist"，未开放直接购买；FAQ 声称"会员数有上限，有人退出才放出名额"（典型稀缺营销）。
- **目标人群**：Beginners / Students / Employees / Freelancers / Entrepreneurs 五类（页面用 Tab 切换各自话术）。

## 二、页面结构（一条完整的转化漏斗）

1. **Hero**：背景视频 + 大标题（Mazzard 字体、特大号）+ 头像胶囊社会证明 "Trusted By 1,000+ Side Hustlers" + 橙黄渐变 CTA。
2. **Insights（免费试看内容）**：30+ 条 Mark Tilbury 大师课视频标题（股票、期权、红利、黄金、FIRE、72 法则、谈判、副业……），带 "CONTINUE WATCHING" 续播入口。
3. **Proven Skill Pathways™**：核心卖点 —— 3 小时+ 的成套课程，宣称导师"年利润 ≥ $100,000"。从图片命名可见 5 条路径：remote-revenue（远程收入）、commission-closer（成交销售）、reels-to-riches（短视频变现）、design-dollars（设计接单）、ecom-empire（电商）。
4. **导师直达**（"people who've done it before"）→ **每周 Live Workshops**（列出近期场次：AMA、10X 收入、Ecom Hour、影响力、$10k/月）。
5. **社区** + **Mark 会员专属线下活动**。
6. **三组证言**：Top Members（$25,000 首月战绩）/ Early Access Members（8 条轮播）/ 奖品挑战。
7. **权益 Marquee**：21 项会员权益无限滚动两排（Pathways、Mentorship、Workshops、Progress Tracking、AI Education、Pitch Ideas…）。
8. **个性化算法**：按五类人群 Tab 切换图文（"proprietary algorithm"）。
9. **Before / After 对比**：左"现状痛点（STAY STUCK）"右"加入后收益"，双栏红黑对照。
10. **FAQ**：分 General / Content / Pricing 三个 Tab（定价藏在 Pricing 里，页面不直接标价）。
11. 页脚：Contact / Terms / Cookie / Privacy + 版权。

## 三、内容体系（它到底教什么）

- **赚钱技能**：数字技能路径（视频剪辑、设计、电商、销售、短视频）→ 目标 "$10,000/月 Digital Architect"。
- **投资教育**：股票研究（EPS、股息）、期权入门、指数基金/ETF、黄金、熊市防守、FIRE、72 法则、租房 vs 买房 9% 法则。
- **软技能/商业**：涨价不丢单、Sell Me This Pen、合伙人协议、商标保护（英美）、辞职 vs 坚持（沉没成本）。
- **形式**：录播课 + 每周直播 + 月度挑战赛（有奖品）+ 线下聚会 + 1v1 反馈 + "Progress Tracking"。
- 明确喊出 "Stay ahead of AI and not get replaced by it"，把 AI 焦虑当卖点。

## 四、技术栈与实现细节

| 项 | 结果 |
|---|---|
| 框架 | Next.js（Turbopack 分包，x-powered-by: Next.js） |
| 托管 | Vercel（x-vercel-cache/id）+ Cloudflare CDN（SSL/HSTS 2 年） |
| 样式 | CSS Modules（`XxxSection-module__` 前缀），gradient 类出现 118 次 |
| 轮播 | **Swiper**（swiper-slide 138 个，共 6 组轮播：缩略图课列表、证言、社区卡片墙） |
| 手风琴 | Accordion 模块（FAQ 三分组） |
| 字体 | 自有品牌字体 Mazzard H/M 全 11 字重 + Roboto Medium，TTF 自托管 |
| 媒体 | 自有 CDN cdn.thewealthportal.com（图片带 `?v=` 版本号） |
| 统计 | Meta Pixel（Facebook tr），未发现 GA/GTM |
| 邮箱防爬 | Cloudflare email-protection（support 邮箱混淆） |
| SEO | sitemap.xml 仅 1 条 URL；robots.txt 屏蔽 `/register`、`/limited-offer`（销售页不收录）；OG 图专用 webp |

**性能反例（可引以为戒）**：
- HTML 高达 **544KB**（大量数据内联在 RSC payload）。
- `<link rel=preload>` 一次性预载 **22 个 TTF 字体文件**（全字重全量 preload 是典型反模式，首屏只用到 2-3 个字重）。
- TTFB ~4.4s（沙箱代理放大了 TLS 握手，仅供参考，但 544KB HTML 是真实负担）。

## 五、可借鉴到我们 Global Yellow Pages 的点

| # | 借鉴点 | 落地方式 |
|---|---|---|
| 1 | **社会证明胶囊**：头像堆叠 + "Trusted By 1,000+" | 首页顶部加"已收录 381 个精选站点 · 62 个 AI 神器"胶囊条 |
| 2 | **橙黄渐变 CTA**（黑底 + 渐变按钮 + 圆角胶囊） | V2 neo 皮肤主按钮配色可对齐（已有基础，强化 hover 光晕） |
| 3 | **Before / After 双栏** | "普通导航站 vs 本站"对比叙事：散乱书签 vs 分类+投票+口碑榜 |
| 4 | **FAQ 分组 Tab**（General/Content/Pricing） | 我们的 FAQ 可按"使用/投票/收录申请"分三组 |
| 5 | **人群个性化 Tab** | 按访客意图切换推荐：学生/开发者/设计师/投资人 各推不同分类 |
| 6 | **权益 Marquee 双排无限滚动** | 把 17 个分类做成两排 marquee 横滚条（现分类按钮已多排，可加分类型滚动条） |
| 7 | **证言卡片轮播**（引号图标 + 头像 + 职务） | 若开放留言后台，可把精选用户留言轮播上首页 |
| 8 | **稀缺/waitlist 机制** | 若做"站长推荐位/增值收录"，可用 waitlist 制造稀缺 |
| 9 | **robots 屏蔽内部页** | 我们可屏蔽 /api、后台留言页，避免收录无价值 URL（我们 sitemap 已更完善，这点我们更好） |
| 10 | **自有 CDN + 图片版本号** | 与我们 `data.js?v=` 同思路，截图/OG 图上 CDN 时带版本 |

**反面教材（我们已避免）**：全字重字体 preload、544KB 内联 HTML、sitemap 只有一条。我们的 gen-seo.py（多 URL sitemap + 按需 preload）在这几点上更健康。

## 六、一句话总结

这是一套**"个人 IP + 付费社群"的标准转化页范本**：视频背书 → 免费试看内容 → 成套路径课 → 导师/直播/社区三重承诺 → 三层证言 → 人群个性化 → 痛点对比 → 稀缺 waitlist。视觉上黑底 + 橙黄渐变 + 超大标题 + Swiper 轮播；技术上 Next.js + Vercel + Cloudflare，但字体与 HTML 体积管理粗糙。
