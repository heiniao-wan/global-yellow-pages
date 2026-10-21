# Google AdSense 申请操作指南

> 站点：https://ypage.ccwu.cc/
> 状态：**技术准备已完成（自检 63 项全过），等待你提交申请**

---

## 一、现在的状态：技术侧已就绪

用 Googlebot 视角实测 + 自动化自检（`tools/verify-adsense.js`）结果：

| 检查项 | 状态 | 实测值 |
|---|---|---|
| 首页可见文字 | ✅ | 1999 字（改前 131） |
| 首页出站链接 | ✅ | 36 条（改前 0） |
| 独立信任页面 | ✅ | about / privacy / contact / disclaimer 四个独立 URL |
| 404 状态码 | ✅ | 不存在的路径返回 404（改前返回 200 + 首页内容） |
| 分类独立页 | ✅ | 17 个，平均 1109 字 |
| 站长长文 | ✅ | 2968 字 |
| sitemap | ✅ | 26 条 URL |
| ads.txt | ✅ | 根目录可访问（**原本完全缺失，是硬性红线**） |
| 广告版位 | ✅ | 2 个 `ins.adsbygoogle` 版位 |
| 首屏传输量 | ✅ | 约 90 KB（brotli 压缩后） |
| 移动端适配 | ✅ | viewport 齐全 |
| HTTPS | ✅ | 含 HSTS |
| Cookie 同意条 | ✅ | 接入广告后自动启用 |
| 隐私政策 AdSense 专章 | ✅ | 中英双语，含 DART / GDPR 说明 |

**AdSense 官方无最低流量门槛**（PV、访客数、字数、外链数、域名年龄都不在门槛列表里），
所以现在就可以递申请。

---

## 二、申请前的 4 个准备动作

### ① 注册 AdSense 账号

打开 https://adsense.google.com，用你的 Google 账号登录。

> ⚠️ **关于收款主体（重要）**
> Google 目前**不向中国大陆主体开放 AdSense 付款**。你需要具备以下之一：
> - 香港 / 台湾 / 新加坡等地区的 AdSense 账号，并配对应区域的收款方式
> - 或改用百度联盟、腾讯广告等对大陆站点更友好的平台
>
> 这一步过不去，技术做得再好也无意义。请先确认这条路走不走得通。

### ② 拿到发布商 ID 并填入两处

登录后在「信息源管理」能看到你的 **发布商 ID**（形如 `pub-1234567890123456`）。

**第一处** —— 打开 `assets/js/ads-config.js`，把：
```js
var enabled = false;        →  var enabled = true;
var clientId = '';          →  var clientId = 'ca-pub-1234567890123456';
```
（广告脚本在 `enabled = true` 且填了 ID 时才会真正加载；获批前保持 false 不影响任何功能）

**第二处** —— 打开根目录 `ads.txt`，把文件末尾那行注释替换成 Google 给你的授权行：
```
# google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```
改成
```
google.com, pub-你的真实ID, DIRECT, f08c47fec0942fa0
```
> ★ `ads.txt` **必须**在站点根目录（`https://ypage.ccwu.cc/ads.txt`）能被访问。
> 放错位置或 404 会直接被拒审。

### ③ 提交 ads.txt 后确认可访问

浏览器打开 https://ypage.ccwu.cc/ads.txt ，能看到那行授权行就算成功。

### ④ 在 AdSense 后台添加站点并放代码

1. 「信息源管理」→「添加网站」→ 填 `ypage.ccwu.cc`
2. 它会给你一段 `<script>` 代码，粘贴到 `<head>` 和 `</body>` 之间
   —— 你的站点**已经有 `ins.adsbygoogle` 版位了**，把 Google 给的 `client` 值
   同步到 `assets/js/ads-config.js` 即可，脚本会由它按需注入
3. 回「信息源管理」点「完成」

---

## 三、提交后

- **审核周期**：通常 1-2 周，最长 4 周
- 期间保持站点正常更新，不要大改结构
- 收到通过邮件后，把 `ads-config.js` 的 `enabled` 改成 `true` 并填上 clientId
- 通过后到 AdSense 后台开「自动广告」，或手动设置广告单元

### 如果被拒了

Google 会给出具体拒审理由。按最常见的三类对应处理：

| 拒审理由关键词 | 实际含义 | 怎么改 |
|---|---|---|
| **低价值内容 / 内容不足** | 人工审核读不出站点价值 | 继续扩写分类页文案、加更多原创长文 |
| **导航混乱 / 破节** | 站点结构或链接有问题 | 检查 404 页、面包屑、内链 |
| **流量不足** | 收录或访问量不够 | 提交 Search Console、继续补内容 |

改完等 **7-14 天**再重新提交，别连续提交。

---

## 四、自检工具

随时可以跑一遍确认站点状态：

```bash
node tools/verify-adsense.js https://ypage.ccwu.cc
```

> **关于性能指标的说明**：脚本里的 FCP / DCL 阈值（2.5s / 3s）是按正常网络设定的。
> 如果在受限网络环境下跑，会偶发超标 —— 脚本会自动拿 `example.com` 做基线对照，
> 基线同样慢时会标注「网络环境所致」而不是报 FAIL，不用误判。

---

## 五、还没做但值得做的（提升过审率）

这些不是硬性门槛，但能显著提高人工审核的评价：

1. **Search Console 提交站点地图** —— 目前还没做
   打开 https://search.google.com/search-console → 添加 `ypage.ccwu.cc`
   → 验证 → 提交 `https://ypage.ccwu.cc/sitemap.xml`
2. **继续扩充原创内容** —— 分类页文案可以再深（现在平均 1109 字）
3. **清理投票脏数据** —— KV 里有早期测试残留（`google`、`github` 等无效 ID）
4. **加一个「热门站点」排行页** —— 既是产品功能，也能增加一个高价值内容页
