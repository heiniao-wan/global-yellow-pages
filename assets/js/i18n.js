/**
 * I18N — 多语言支持（中文 / English / 日本語 / 한국어）
 *
 * 设计说明：
 * · 静态 DOM 文案通过「选择器映射」应用（本文件底部 MAP），V1 与 V2 布局类名一致，共用一份映射；
 *   V2 专属差异（标题/副标题/页脚）用 *_neo 键，按 location.pathname 自动判别。
 * · 动态渲染文案（卡片、图表、提示条）由 app.js 直接调 t() 取词。
 * · 站点简介（data.js 的 desc）保持中文原文，不在翻译范围内。
 * · 偏好存 localStorage('gyp:lang')，默认中文。
 */
window.I18N = (function () {
  'use strict';

  var LANGS = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' }
  ];

  var DICT = {
    /* ═══════════ 中文（基准） ═══════════ */
    zh: {
      doc_title: '全球黄页 · 优质网站导航与口碑库',
      doc_title_neo: '全球黄页 NEO · 优质网站导航与口碑库',
      nav_dir: '网站目录', nav_stats: '数据统计', nav_prot: '防刷机制',
      search_ph: '搜索网站名称、域名或用途…', search_btn: '搜索',
      hero_kicker: '已收录 <b id="statSites">{n}</b> 个全球站点',
      hero_kicker_neo: 'NEO EDITION · 已收录 <b id="statSites">{n}</b> 个全球站点',
      hero_title: '找到值得信赖的<br><span class="grad">那一个网站</span>',
      hero_title_neo: '探索全球网络<br><span class="grad">下一个入口</span>',
      hero_sub: '按行业分类整理全球知名黄页与导航站点，自动抓取首页截图，配合同一 IP 一次性真实用户投票，让好网站被看见。',
      hero_sub_neo: '深空之上的全球黄页：按行业分类收录知名站点，自动抓取首页截图，同一设备一次性真实投票，让好网站被看见。',
      m_cats: '行业分类', m_regions: '覆盖地区', m_likes: '累计点赞', m_health: '整体好评率',
      sec_browse: '按行业浏览', sec_browse_note: '点击分类筛选，点击下方卡片按钮参与评价',
      sec_stats: '投票数据统计', sec_stats_note: '每个 IP / 设备对同一站点仅可评价一次',
      sec_prot: '防恶意点击机制', sec_prot_note: '参考 Google AdSense 的无效流量识别思路，多信号叠加判定',
      result_count: '<b id="resultCount">{n}</b> 个网站',
      filter_all_region: '全部地区',
      sort_hot: '按热度排序', sort_score: '按口碑排序', sort_name: '按名称排序',
      empty_t: '没有找到匹配的网站', empty_sub: '换个关键词，或把筛选条件放宽试试',
      label_like: '点赞', label_dislike: '不喜欢', label_broken: '无法访问', label_health: '整体好评率',
      health_none: '暂无投票数据，点击卡片上的按钮即可参与评价',
      health_based: '基于 {n} 次有效投票计算的站点好评率',
      chart_ring: '投票构成', chart_dist: '分类投票分布', chart_rank: '口碑榜',
      chart_rank_n: '口碑榜 TOP {n}',
      total_votes: '总投票', no_data: '暂无数据',
      rank_empty: '还没有投票，先从上面几个站点开始吧',
      rank_note: '还没有站点达到 {n} 票，以下为早期参考',
      bar_tip: '赞 {l} · 踩 {d} · 挂 {b}',
      cat_all: '全部', open_site: '访问网站',
      flash_ok: '{type}已记录，感谢反馈',
      flash_already: '你已经评价过这个站点了，每个站点只能评价一次。',
      flash_honeypot: '检测到自动化行为，投票已拦截。',
      flash_automation: '检测到自动化环境，投票已拦截。',
      flash_hidden: '请在页面前台操作，投票已拦截。',
      flash_too_fast: '操作速度异常，请稍候再试。',
      flash_rate_limit: '操作过于频繁，请稍后再试。',
      prot_why: '为什么不能只靠 IP？',
      prot_p1: '家庭宽带、公司网络和校园网共用同一个出口 IP，单纯按 IP 限一次，会把一整屋子的真实用户误伤；而专业刷票方换代理 IP 即可轻松绕过。',
      prot_p2: '所以本站采用 <b>指纹为主、IP 为辅</b> 的复合判定：设备换了、IP 没换照样认得；IP 换了、设备没换一样认得。',
      fp_label: '当前指纹标识', data_q: '数据存放在哪？',
      data_p: '当前版本为纯静态站点，投票数据保存在<b>本机浏览器</b>，仅用于你自己查看统计效果。接入云数据库后，票数将全站共享并永久保存。',
      disclaimer: '⚠️ 说明：前端校验逻辑对访问者可见，理论上可被绕过。真正的强制去重必须在服务端完成——接入数据库后，相同校验会在服务端强制执行，前端拦截只是第一道过滤。',
      layer1_t: '蜜罐字段', layer1_d: '机器人会填隐藏表单，真人看不见',
      layer2_t: '交互时序', layer2_d: '点击快于人类反应极限直接拦下',
      layer3_t: '浏览器指纹', layer3_d: '换 IP 也认得出同一台设备',
      layer4_t: '速率限制', layer4_d: '每分钟最多 20 次，超出即拦截',
      layer5_t: '一票定终身', layer5_d: '每站仅可评价一次，不可修改',
      layer6_t: '存活性检测', layer6_d: '后台标签页的投票不予采信',
      foot_1: '全球黄页 · 优质网站导航与口碑库',
      foot_1_neo: '全球黄页 NEO · 优质网站导航与口碑库',
      foot_2: '© <b id="year">{y}</b> 全球黄页 · 分类体系参考主流流量分析平台通用行业分类',
      foot_3: '所有网站版权归各自所有者所有 · 本页仅作导航索引与用户评价参考',
      theme_to_light: '切换为亮色', theme_to_dark: '切换为暗色',
      foot_about: '关于本站', foot_privacy: '隐私政策', foot_terms: '使用条款',
      foot_disclaimer: '免责声明', foot_contact: '联系我们',
      consent_text: '本站使用浏览器本地存储保存你的投票与偏好，并计划接入 Google AdSense 广告（涉及第三方 Cookie）。详见 <a href="legal.html#privacy">隐私政策</a>。',
      consent_ok: '好的',
      nav_feedback: '网站反馈',
      fb_title: '网站反馈', fb_note: '发现值得收录的网站？留言告诉我们，核实后加入目录',
      fb_label_site: '网站名称或网址', fb_label_cat: '建议分类', fb_label_msg: '补充说明',
      fb_label_phone: '电话', fb_label_email: '邮箱',
      fb_ph_site: '例：example.com', fb_ph_msg: '为什么值得收录？（选填）',
      fb_ph_phone: '+86 138 0000 0000', fb_ph_email: 'you@example.com',
      fb_submit: '发送反馈', fb_cat_none: '暂不确定',
      fb_err_site: '请填写要推荐的网站名称或网址',
      fb_err_contact: '电话和邮箱至少填写一项，方便我们与你联系',
      fb_err_email: '邮箱格式不正确，请检查',
      fb_err_phone: '电话格式不正确，请检查',
      fb_sending: '正在发送…',
      fb_ok: '反馈已发送，感谢你的推荐！',
      fb_fail: '发送失败，请稍后重试',
      fb_rate: '发送太频繁，请一分钟后再试',
      fb_side_t: '联系方式与去向',
      fb_side_p1: '电话与邮箱至少填写一项，用于核实网站信息，不会用于其他用途。',
      fb_side_p2: '留言仅保存在站长专属留言后台，<b>不对外公开、不发送到任何邮箱</b>。',
      cat_fav: '我的收藏', fav_add: '收藏', fav_remove: '取消收藏',
      fav_txt_off: '收藏', fav_txt_on: '已收藏',
      fav_empty: '还没有收藏任何站点',
      fav_empty_sub: '点卡片右上角的 ★ 就能收藏，收藏后会出现在这里',
      lucky_btn: '🎲 手气不错', filter_broken: '⚠ 仅看问题站点',
      badge_broken: '无法访问 ×{n}',
      'region_全部': '全部地区', 'region_中国': '中国', 'region_日本': '日本', 'region_韩国': '韩国',
      'region_欧美': '欧美', 'region_全球': '全球', 'region_东南亚': '东南亚', 'region_其他': '其他',
      'lang_中文': '中文', 'lang_英文': '英文', 'lang_日文': '日文', 'lang_韩文': '韩文', 'lang_多语言': '多语言'
    },

    /* ═══════════ English ═══════════ */
    en: {
      doc_title: 'Global Yellow Pages · Trusted Website Directory & Reviews',
      doc_title_neo: 'Global Yellow Pages NEO · Trusted Website Directory & Reviews',
      nav_dir: 'Directory', nav_stats: 'Statistics', nav_prot: 'Anti-abuse',
      search_ph: 'Search site name, domain or purpose…', search_btn: 'Search',
      hero_kicker: 'Indexing <b id="statSites">{n}</b> top sites worldwide',
      hero_kicker_neo: 'NEO EDITION · Indexing <b id="statSites">{n}</b> top sites worldwide',
      hero_title: 'Find the one site<br><span class="grad">you can trust</span>',
      hero_title_neo: 'Explore the global web<br><span class="grad">next gateway</span>',
      hero_sub: 'A curated directory of the world\u2019s leading portals and yellow-page sites, with auto-captured homepage screenshots and one-vote-per-device reviews \u2014 so good sites get seen.',
      hero_sub_neo: 'A yellow pages above deep space: renowned sites organized by industry, homepage screenshots auto-captured, one genuine vote per device \u2014 so good sites get seen.',
      m_cats: 'Categories', m_regions: 'Regions', m_likes: 'Total likes', m_health: 'Overall approval',
      sec_browse: 'Browse by Industry', sec_browse_note: 'Click a category to filter; vote with the buttons on each card',
      sec_stats: 'Voting Statistics', sec_stats_note: 'One review per IP / device per site',
      sec_prot: 'Anti-abuse Protection', sec_prot_note: 'Inspired by Google AdSense invalid-traffic detection, multiple signals combined',
      result_count: '<b id="resultCount">{n}</b> sites',
      filter_all_region: 'All Regions',
      sort_hot: 'Trending', sort_score: 'Top rated', sort_name: 'By name',
      empty_t: 'No matching sites found', empty_sub: 'Try different keywords, or loosen the filters',
      label_like: 'Like', label_dislike: 'Dislike', label_broken: 'Unreachable', label_health: 'Overall approval',
      health_none: 'No votes yet \u2014 use the buttons on any card to review a site',
      health_based: 'Approval rate based on {n} valid votes',
      chart_ring: 'Vote Breakdown', chart_dist: 'Votes by Category', chart_rank: 'By Reputation',
      chart_rank_n: 'Top {n} by Reputation',
      total_votes: 'Total votes', no_data: 'No data yet',
      rank_empty: 'No votes yet \u2014 start with the sites above',
      rank_note: 'No site has reached {n} votes yet \u2014 early snapshot',
      bar_tip: 'Like {l} \u00b7 Dislike {d} \u00b7 Down {b}',
      cat_all: 'All', open_site: 'Visit site',
      flash_ok: '{type} recorded. Thanks for the feedback!',
      flash_already: 'You have already reviewed this site. One review per site.',
      flash_honeypot: 'Automated behavior detected. Vote blocked.',
      flash_automation: 'Automated environment detected. Vote blocked.',
      flash_hidden: 'Please keep the page in the foreground. Vote blocked.',
      flash_too_fast: 'Interaction faster than humanly possible. Try again shortly.',
      flash_rate_limit: 'Too many actions. Please try again later.',
      prot_why: 'Why IP alone isn\u2019t enough?',
      prot_p1: 'Home, office and campus networks share one public IP. Limiting by IP alone locks out entire households of real users, while professional vote farms simply rotate proxies.',
      prot_p2: 'So this site combines <b>device fingerprinting first, IP second</b>: a new device on the same IP is caught, and the same device on a new IP is caught too.',
      fp_label: 'Your fingerprint', data_q: 'Where is the data stored?',
      data_p: 'This is a static site: votes are stored in <b>your browser</b> for preview purposes only. Once a cloud database is connected, votes are shared site-wide and stored permanently.',
      disclaimer: '\u26a0\ufe0f Note: client-side checks are visible and can theoretically be bypassed. True enforcement happens server-side once a database is connected; the front-end filter is only the first gate.',
      layer1_t: 'Honeypot fields', layer1_d: 'Bots fill hidden forms that humans never see',
      layer2_t: 'Interaction timing', layer2_d: 'Clicks faster than human reaction are blocked',
      layer3_t: 'Browser fingerprint', layer3_d: 'Same device recognized even on a new IP',
      layer4_t: 'Rate limiting', layer4_d: 'Max 20 votes per minute, excess blocked',
      layer5_t: 'One vote per site', layer5_d: 'Each site allows exactly one review, no edits',
      layer6_t: 'Foreground check', layer6_d: 'Votes from background tabs are discarded',
      foot_1: 'Global Yellow Pages \u00b7 Trusted Website Directory & Reviews',
      foot_1_neo: 'Global Yellow Pages NEO \u00b7 Trusted Website Directory & Reviews',
      foot_2: '\u00a9 <b id="year">{y}</b> Global Yellow Pages \u00b7 Taxonomy based on mainstream traffic-analytics industry categories',
      foot_3: 'All site copyrights belong to their respective owners \u00b7 For directory and review reference only',
      theme_to_light: 'Switch to light', theme_to_dark: 'Switch to dark',
      foot_about: 'About', foot_privacy: 'Privacy Policy', foot_terms: 'Terms of Use',
      foot_disclaimer: 'Disclaimer', foot_contact: 'Contact',
      consent_text: 'This site uses your browser\u2019s local storage for votes and preferences, and plans to serve Google AdSense ads (third-party cookies apply). See our <a href="legal.html#privacy">Privacy Policy</a>.',
      consent_ok: 'Got it',
      nav_feedback: 'Feedback',
      fb_title: 'Website Feedback', fb_note: 'Know a site worth listing? Tell us and we will verify and add it',
      fb_label_site: 'Site name or URL', fb_label_cat: 'Suggested category', fb_label_msg: 'Notes',
      fb_label_phone: 'Phone', fb_label_email: 'Email',
      fb_ph_site: 'e.g. example.com', fb_ph_msg: 'Why it deserves a listing (optional)',
      fb_ph_phone: '+1 555 000 0000', fb_ph_email: 'you@example.com',
      fb_submit: 'Send Feedback', fb_cat_none: 'Not sure',
      fb_err_site: 'Please enter the site name or URL you want to suggest',
      fb_err_contact: 'Please provide at least a phone number or an email so we can reach you',
      fb_err_email: 'Invalid email format, please check',
      fb_err_phone: 'Invalid phone format, please check',
      fb_sending: 'Sending…',
      fb_ok: 'Feedback sent. Thanks for your suggestion!',
      fb_fail: 'Sending failed. Please try again later',
      fb_rate: 'Too many messages \u2014 please wait a minute and try again',
      fb_side_t: 'Contact & destination',
      fb_side_p1: 'Provide at least a phone number or an email for verification only; it will not be used otherwise.',
      fb_side_p2: 'Messages go only to the operator\u2019s private console \u2014 <b>never published, never emailed</b>.',
      cat_fav: 'Favorites', fav_add: 'Add to favorites', fav_remove: 'Remove from favorites',
      fav_txt_off: 'Save', fav_txt_on: 'Saved',
      fav_empty: 'No favorites yet',
      fav_empty_sub: 'Click the \u2605 at the top-right of any card to save it here',
      lucky_btn: '🎲 I\u2019m Feeling Lucky', filter_broken: '⚠ Problem sites only',
      badge_broken: 'Unreachable ×{n}',
      'region_全部': 'All Regions', 'region_中国': 'China', 'region_日本': 'Japan', 'region_韩国': 'Korea',
      'region_欧美': 'Western', 'region_全球': 'Global', 'region_东南亚': 'SE Asia', 'region_其他': 'Other',
      'lang_中文': 'Chinese', 'lang_英文': 'English', 'lang_日文': 'Japanese', 'lang_韩文': 'Korean', 'lang_多语言': 'Multilingual'
    },

    /* ═══════════ 日本語 ═══════════ */
    ja: {
      doc_title: '世界のイエローページ \u00b7 信頼できるサイトディレクトリ',
      doc_title_neo: '世界のイエローページ NEO \u00b7 信頼できるサイトディレクトリ',
      nav_dir: 'サイト一覧', nav_stats: '投票データ', nav_prot: '不正防止',
      search_ph: 'サイト名・ドメイン・用途で検索\u2026', search_btn: '検索',
      hero_kicker: '世界の優良サイト <b id="statSites">{n}</b> 件を収録',
      hero_kicker_neo: 'NEO EDITION \u00b7 世界の優良サイト <b id="statSites">{n}</b> 件を収録',
      hero_title: '信頼できるサイトを<br><span class="grad">見つけよう</span>',
      hero_title_neo: '世界のウェブから<br><span class="grad">次の入口を探す</span>',
      hero_sub: '世界中の有名ポータル・イエローページを業界別に整理し、トップページのスクリーンショットを自動取得。同一端末からの投票は1回限りで、良いサイトが見えるように。',
      hero_sub_neo: '深宇宙の上のイエローページ：業界別に有名サイトを収録し、スクリーンショットを自動取得。同一端末1回の正直な投票で、良いサイトが見えるように。',
      m_cats: '業界カテゴリ', m_regions: '対応地域', m_likes: '累計いいね', m_health: '総合好評価率',
      sec_browse: '業界から探す', sec_browse_note: 'カテゴリで絞り込み、カードのボタンで評価できます',
      sec_stats: '投票データ統計', sec_stats_note: '同一 IP / 端末につき各サイト1回のみ評価可能',
      sec_prot: '不正クリック防止', sec_prot_note: 'Google AdSense の無効トラフィック判定を参考に、多層シグナルで判定',
      result_count: '<b id="resultCount">{n}</b> 件のサイト',
      filter_all_region: '全地域',
      sort_hot: '人気順', sort_score: '評判順', sort_name: '名前順',
      empty_t: '一致するサイトが見つかりません', empty_sub: 'キーワードを変えるか、条件を広げてみてください',
      label_like: 'いいね', label_dislike: 'よくない', label_broken: '接続不可', label_health: '総合好評価率',
      health_none: '投票がまだありません。カードのボタンから評価に参加できます',
      health_based: '有効票 {n} 件に基づくサイトの好評価率',
      chart_ring: '投票内訳', chart_dist: 'カテゴリ別投票分布', chart_rank: '評判ランキング',
      chart_rank_n: '評判ランキング TOP {n}',
      total_votes: '総投票数', no_data: 'データなし',
      rank_empty: 'まだ投票がありません。上のサイトから始めてみましょう',
      rank_note: 'まだ {n} 票に達したサイトがありません（早期参考）',
      bar_tip: '賛成 {l} \u00b7 反対 {d} \u00b7 不可 {b}',
      cat_all: '全部', open_site: 'サイトへ',
      flash_ok: '{type}を記録しました。ご協力ありがとうございます',
      flash_already: 'このサイトはすでに評価済みです。各サイト1回のみです。',
      flash_honeypot: '自動化行為を検出したため、投票をブロックしました。',
      flash_automation: '自動化環境を検出したため、投票をブロックしました。',
      flash_hidden: 'ページを前面で操作してください。投票をブロックしました。',
      flash_too_fast: '操作が速すぎます。しばらく待ってからお試しください。',
      flash_rate_limit: '操作が頻繁すぎます。しばらくしてからお試しください。',
      prot_why: 'IP だけでは不十分な理由',
      prot_p1: '家庭・会社・キャンパス網は同じ出口 IP を共有します。IP だけで制限すると実際の複数ユーザーを誤ってブロックし、プロの投票工作はプロキシを変えるだけで回避できてしまいます。',
      prot_p2: 'そこで当サイトは<b>フィンガープリント優先・IP 補助</b>の複合判定を採用：IP が同じでも端末が変われば検出し、端末が同じでも IP が変われば検出します。',
      fp_label: '現在のフィンガープリント', data_q: 'データはどこに保存される？',
      data_p: '現在は静的サイトのため、投票データは<b>お使いのブラウザ</b>に保存され、プレビュー用です。クラウド DB 接続後はサイト全体で共有・永続保存されます。',
      disclaimer: '\u26a0\ufe0f 注意：フロントエンドの検証は閲覧可能で、理論上は回避可能です。本来の強制判定は DB 接続後にサーバー側で実行され、フロントエンドのブロックは最初の関門にすぎません。',
      layer1_t: 'ハニーポット', layer1_d: 'ロボットは隠しフォームに入力する。人間には見えない',
      layer2_t: '操作タイミング', layer2_d: '人間の反応速度より速いクリックはブロック',
      layer3_t: 'ブラウザ指紋', layer3_d: 'IP が変わっても同じ端末と判定',
      layer4_t: 'レート制限', layer4_d: '毎分最大20回、超過でブロック',
      layer5_t: '1票固定', layer5_d: '各サイトは1回のみ評価でき、変更不可',
      layer6_t: 'フォアグラウンド判定', layer6_d: 'バックグラウンドタブからの投票は無効',
      foot_1: '世界のイエローページ \u00b7 信頼できるサイトディレクトリ',
      foot_1_neo: '世界のイエローページ NEO \u00b7 信頼できるサイトディレクトリ',
      foot_2: '\u00a9 <b id="year">{y}</b> 世界のイエローページ \u00b7 分類は主流トラフィック分析プラットフォームの業界分類を参考',
      foot_3: 'すべてのサイトの著作権は各所有者に帰属 \u00b7 ディレクトリと評価の参考のみに使用',
      theme_to_light: 'ライトへ切替', theme_to_dark: 'ダークへ切替',
      foot_about: 'このサイトについて', foot_privacy: 'プライバシーポリシー', foot_terms: '利用規約',
      foot_disclaimer: '免責事項', foot_contact: 'お問い合わせ',
      consent_text: '当サイトはブラウザのローカルストレージに投票と設定を保存し、Google AdSense 広告（サードパーティ Cookie）を表示する予定です。詳しくは<a href="legal.html#privacy">プライバシーポリシー</a>をご覧ください。',
      consent_ok: 'OK',
      nav_feedback: 'フィードバック',
      fb_title: 'サイトのリクエスト', fb_note: '収録してほしいサイトがあれば、確認のうえ追加します',
      fb_label_site: 'サイト名または URL', fb_label_cat: '希望カテゴリ', fb_label_msg: '補足説明',
      fb_label_phone: '電話番号', fb_label_email: 'メール',
      fb_ph_site: '例：example.com', fb_ph_msg: '収録理由（任意）',
      fb_ph_phone: '+81 90 0000 0000', fb_ph_email: 'you@example.com',
      fb_submit: '送信', fb_cat_none: '未定',
      fb_err_site: 'サイト名または URL を入力してください',
      fb_err_contact: '電話番号かメールのいずれかを入力してください',
      fb_err_email: 'メール形式が正しくありません',
      fb_err_phone: '電話番号形式が正しくありません',
      fb_sending: '送信中…',
      fb_ok: '送信しました。ご協力ありがとうございます',
      fb_fail: '送信に失敗しました。しばらくしてからお試しください',
      fb_rate: '送信が集中しています。1 分後に再度お試しください',
      fb_side_t: '連絡先と送信先',
      fb_side_p1: '確認のため電話またはメールのいずれかをご記入ください。他の目的には使用しません。',
      fb_side_p2: 'メッセージは運営者専用の管理画面にのみ保存され、<b>公開もメール送信もされません</b>。',
      cat_fav: 'お気に入り', fav_add: 'お気に入りに追加', fav_remove: 'お気に入りから削除',
      fav_txt_off: '保存', fav_txt_on: '保存済み',
      fav_empty: 'お気に入りはまだありません',
      fav_empty_sub: 'カード右上の \u2605 をクリックすると、ここに保存されます',
      lucky_btn: '🎲 おまかせ', filter_broken: '⚠ 問題サイトのみ',
      badge_broken: '接続不可 ×{n}',
      'region_全部': '全地域', 'region_中国': '中国', 'region_日本': '日本', 'region_韩国': '韓国',
      'region_欧美': '欧米', 'region_全球': 'グローバル', 'region_东南亚': '東南アジア', 'region_其他': 'その他',
      'lang_中文': '中国語', 'lang_英文': '英語', 'lang_日文': '日本語', 'lang_韩文': '韓国語', 'lang_多语言': '多言語'
    },

    /* ═══════════ 한국어 ═══════════ */
    ko: {
      doc_title: '세계 옐로페이지 \u00b7 신뢰할 수 있는 사이트 디렉터리',
      doc_title_neo: '세계 옐로페이지 NEO \u00b7 신뢰할 수 있는 사이트 디렉터리',
      nav_dir: '사이트 목록', nav_stats: '투표 통계', nav_prot: '어뷰징 방지',
      search_ph: '사이트 이름\u00b7도메인\u00b7용도로 검색\u2026', search_btn: '검색',
      hero_kicker: '전 세계 우수 사이트 <b id="statSites">{n}</b>곳 수록',
      hero_kicker_neo: 'NEO EDITION \u00b7 전 세계 우수 사이트 <b id="statSites">{n}</b>곳 수록',
      hero_title: '신뢰할 수 있는<br><span class="grad">그 사이트를 찾다</span>',
      hero_title_neo: '글로벌 웹에서<br><span class="grad">다음 관문을 탐색하다</span>',
      hero_sub: '세계 유명 포털과 옐로페이지를 업종별로 정리하고, 홈페이지 스크린샷을 자동 수집하며, 같은 기기에서 한 번만 투표할 수 있어 좋은 사이트가 드러납니다.',
      hero_sub_neo: '딥 스페이스 위의 옐로페이지: 업종별로 유명 사이트를 수록하고 스크린샷을 자동 수집하며, 기기당 한 번의 정직한 투표로 좋은 사이트를 드러냅니다.',
      m_cats: '업종 분류', m_regions: '지역', m_likes: '누적 좋아요', m_health: '전체 호평율',
      sec_browse: '업종별 탐색', sec_browse_note: '분류를 눌러 필터링하고 카드의 버튼으로 평가에 참여하세요',
      sec_stats: '투표 데이터 통계', sec_stats_note: 'IP / 기기당 사이트 하나에 한 번만 평가 가능',
      sec_prot: '악성 클릭 방지', sec_prot_note: 'Google AdSense 무효 트래픽 판정을 참고한 다중 신호 판정',
      result_count: '<b id="resultCount">{n}</b>개 사이트',
      filter_all_region: '전체 지역',
      sort_hot: '인기순', sort_score: '평판순', sort_name: '이름순',
      empty_t: '일치하는 사이트가 없습니다', empty_sub: '키워드를 바꾸거나 조건을 넓혀 보세요',
      label_like: '좋아요', label_dislike: '싫어요', label_broken: '접속불가', label_health: '전체 호평율',
      health_none: '아직 투표가 없습니다. 카드의 버튼으로 평가에 참여하세요',
      health_based: '유효표 {n}건 기준의 사이트 호평율',
      chart_ring: '투표 구성', chart_dist: '분류별 투표 분포', chart_rank: '평판 랭킹',
      chart_rank_n: '평판 랭킹 TOP {n}',
      total_votes: '총 투표', no_data: '데이터 없음',
      rank_empty: '아직 투표가 없습니다. 위의 사이트부터 시작해 보세요',
      rank_note: '아직 {n} 표에 도달한 사이트가 없습니다 (초기 참고용)',
      bar_tip: '좋아요 {l} \u00b7 싫어요 {d} \u00b7 불가 {b}',
      cat_all: '전체', open_site: '사이트 열기',
      flash_ok: '{type}이(가) 기록되었습니다. 감사합니다',
      flash_already: '이 사이트는 이미 평가했습니다. 사이트당 한 번만 가능합니다.',
      flash_honeypot: '자동화 행위가 감지되어 투표가 차단되었습니다.',
      flash_automation: '자동화 환경이 감지되어 투표가 차단되었습니다.',
      flash_hidden: '페이지를 앞에서 조작해 주세요. 투표가 차단되었습니다.',
      flash_too_fast: '조작 속도가 비정상입니다. 잠시 후 다시 시도하세요.',
      flash_rate_limit: '조작이 너무 잦습니다. 잠시 후 다시 시도하세요.',
      prot_why: 'IP 만으로는 부족한 이유',
      prot_p1: '가정\u00b7회사\u00b7캠퍼스 네트워크는 같은 공용 IP 를 공유합니다. IP 만으로 제한하면 실제 사용자 전체가 잠기고, 전문 투표 조작은 프록시만 바꾸면 우회됩니다.',
      prot_p2: '그래서 이 사이트는 <b>지문 우선\u00b7IP 보조</b> 복합 판정을 사용합니다: IP 가 같아도 기기가 바뀌면 잡히고, 기기가 같아도 IP 가 바뀌면 잡힙니다.',
      fp_label: '현재 지문 식별자', data_q: '데이터는 어디에 저장되나요?',
      data_p: '현재 정적 사이트로 투표 데이터는 <b>브라우저</b>에 저장되며 미리보기용입니다. 클라우드 DB 연결 후 사이트 전체 공유 및 영구 저장됩니다.',
      disclaimer: '\u26a0\ufe0f 안내: 프런트엔드 검증은 노출되어 이론적으로 우회 가능합니다. 실제 강제 차단은 DB 연결 후 서버 측에서 수행되며, 프런트엔드 차단은 1차 필터일 뿐입니다.',
      layer1_t: '허니팟 필드', layer1_d: '봇은 숨겨진 폼을 채웁니다. 사람에게는 보이지 않음',
      layer2_t: '조작 타이밍', layer2_d: '인간 반응 속도보다 빠른 클릭은 차단',
      layer3_t: '브라우저 지문', layer3_d: 'IP 가 바뀌어도 같은 기기로 식별',
      layer4_t: '속도 제한', layer4_d: '분당 최대 20회, 초과 시 차단',
      layer5_t: '1인 1표', layer5_d: '사이트당 한 번만 평가 가능, 수정 불가',
      layer6_t: '포그라운드 검사', layer6_d: '백그라운드 탭의 투표는 무효',
      foot_1: '세계 옐로페이지 \u00b7 신뢰할 수 있는 사이트 디렉터리',
      foot_1_neo: '세계 옐로페이지 NEO \u00b7 신뢰할 수 있는 사이트 디렉터리',
      foot_2: '\u00a9 <b id="year">{y}</b> 세계 옐로페이지 \u00b7 분류체계는 주류 트래픽 분석 플랫폼의 업종 분류 참고',
      foot_3: '모든 사이트 저작권은 각 소유자에게 있음 \u00b7 디렉터리 및 평가 참고용',
      theme_to_light: '라이트로 전환', theme_to_dark: '다크로 전환',
      foot_about: '소개', foot_privacy: '개인정보 처리방침', foot_terms: '이용약관',
      foot_disclaimer: '면책 조항', foot_contact: '문의',
      consent_text: '본 사이트는 브라우저 로컬 스토리지에 투표와 설정을 저장하며 Google AdSense 광고(서드파티 쿠키)를 표시할 예정입니다. 자세한 내용은 <a href="legal.html#privacy">개인정보 처리방침</a>을 참고하세요.',
      consent_ok: '확인',
      nav_feedback: '피드백',
      fb_title: '사이트 요청', fb_note: '수록했으면 하는 사이트가 있으면 알려주세요. 확인 후 추가합니다',
      fb_label_site: '사이트 이름 또는 URL', fb_label_cat: '희망 분류', fb_label_msg: '추가 설명',
      fb_label_phone: '전화번호', fb_label_email: '이메일',
      fb_ph_site: '예: example.com', fb_ph_msg: '수록 이유 (선택)',
      fb_ph_phone: '+82 10 0000 0000', fb_ph_email: 'you@example.com',
      fb_submit: '전송', fb_cat_none: '미정',
      fb_err_site: '사이트 이름 또는 URL 을 입력하세요',
      fb_err_contact: '전화번호 또는 이메일 중 하나를 입력하세요',
      fb_err_email: '이메일 형식이 올바르지 않습니다',
      fb_err_phone: '전화번호 형식이 올바르지 않습니다',
      fb_sending: '전송 중…',
      fb_ok: '전송 완료. 추천해 주셔서 감사합니다',
      fb_fail: '전송 실패. 잠시 후 다시 시도하세요',
      fb_rate: '전송이 너무 잦습니다. 1분 후에 다시 시도하세요',
      fb_side_t: '연락처와 전송지',
      fb_side_p1: '확인을 위해 전화번호 또는 이메일 중 하나를 입력해 주세요. 다른 용도로는 사용하지 않습니다.',
      fb_side_p2: '메시지는 운영자 전용 콘솔에만 저장되며 <b>공개되거나 이메일로 전송되지 않습니다</b>.',
      cat_fav: '즐겨찾기', fav_add: '즐겨찾기 추가', fav_remove: '즐겨찾기 해제',
      fav_txt_off: '저장', fav_txt_on: '저장됨',
      fav_empty: '아직 즐겨찾기가 없습니다',
      fav_empty_sub: '카드 오른쪽 위의 \u2605 를 누르면 여기에 저장됩니다',
      lucky_btn: '🎲 랜덤 발견', filter_broken: '⚠ 문제 사이트만',
      badge_broken: '접속불가 ×{n}',
      'region_全部': '전체 지역', 'region_中国': '중국', 'region_日本': '일본', 'region_韩国': '한국',
      'region_欧美': '서양', 'region_全球': '글로벌', 'region_东南亚': '동남아', 'region_其他': '기타',
      'lang_中文': '중국어', 'lang_英文': '영어', 'lang_日文': '일본어', 'lang_韩文': '한국어', 'lang_多语言': '다국어'
    }
  };

  var cur = 'zh';
  try {
    var saved = localStorage.getItem('gyp:lang');
    if (saved && DICT[saved]) cur = saved;
  } catch (e) { /* 隐私模式忽略 */ }

  /** 取词：缺失时回退中文，再缺失返回 key 本身 */
  function t(key) {
    var d = DICT[cur];
    if (d && d[key] != null) return d[key];
    return DICT.zh[key] != null ? DICT.zh[key] : key;
  }

  /* ───────────── 静态 DOM 应用：选择器映射 ───────────── */
  /* V1 与 V2 类名一致，共用此映射；V2 专属键在下方 IS_NEO 分支处理 */
  var IS_NEO = /index-v2/.test(location.pathname);

  function setEl(el, key, mode) {
    if (!el) return;
    if (mode === 'html') el.innerHTML = t(key);
    else if (mode === 'ph') el.placeholder = t(key);
    else el.textContent = t(key);
  }

  function applyGroup(sel, entries) {
    var els = document.querySelectorAll(sel);
    entries.forEach(function (en, i) {
      if (!els[i]) return;
      if (en.mode === 'lasttext') {
        // 保留图标节点（图例圆点），只替换末尾文本
        var nodes = els[i].childNodes;
        for (var k = nodes.length - 1; k >= 0; k--) {
          if (nodes[k].nodeType === 3 && nodes[k].textContent.trim()) { nodes[k].textContent = t(en.key); return; }
        }
        els[i].textContent = t(en.key);
      } else setEl(els[i], en.key, en.mode);
    });
  }

  function fill(tpl, n, y) { return tpl.replace('{n}', n).replace('{y}', y); }

  function apply() {
    document.documentElement.setAttribute('lang', cur === 'zh' ? 'zh-CN' : cur);
    document.title = t(IS_NEO ? 'doc_title_neo' : 'doc_title');

    // 带内嵌动态值的模板：先取现值再整体替换，节点重建后 id 不变，app.js 的渲染照常工作
    var statN = (document.getElementById('statSites') || {}).textContent || '0';
    var yearV = (document.getElementById('year') || {}).textContent || new Date().getFullYear();

    var kicker = document.querySelector('.hero-kicker');
    if (kicker) kicker.innerHTML = fill(t(IS_NEO ? 'hero_kicker_neo' : 'hero_kicker'), statN, yearV);
    setEl(document.querySelector('.hero-title'), IS_NEO ? 'hero_title_neo' : 'hero_title', 'html');
    setEl(document.querySelector('.hero-sub'), IS_NEO ? 'hero_sub_neo' : 'hero_sub');

    var MAP = [
      ['.topnav a[href="#results"]', 'nav_dir'],
      ['.topnav a[href="#stats"]', 'nav_stats'],
      ['.topnav a[href="#protection"]', 'nav_prot'],
      ['#search', 'search_ph', 'ph'],
      ['.search-btn', 'search_btn'],
      ['.cat-section .section-head h2', 'sec_browse'],
      ['.cat-section .section-note', 'sec_browse_note'],
      ['.results .results-count', 'result_count', 'html'],
      ['.empty p:not(.muted)', 'empty_t'],
      ['.empty p.muted', 'empty_sub'],
      ['.stats .section-head h2', 'sec_stats'],
      ['.stats .section-note', 'sec_stats_note'],
      ['.protection .section-head h2', 'sec_prot'],
      ['.protection .section-note', 'sec_prot_note'],
      ['.footer p:first-child', null],
      ['.footer p:nth-child(2)', null, 'html'],
      ['.footer p:nth-child(3)', 'foot_3'],
      ['.foot-links a:nth-child(1)', 'foot_about'],
      ['.foot-links a:nth-child(2)', 'foot_privacy'],
      ['.foot-links a:nth-child(3)', 'foot_terms'],
      ['.foot-links a:nth-child(4)', 'foot_disclaimer'],
      ['.foot-links a:nth-child(5)', 'foot_contact'],
      ['.topnav a[href="#feedback"]', 'nav_feedback'],
      ['.feedback .section-head h2', 'fb_title'],
      ['.feedback .section-note', 'fb_note'],
      ['#fbSite', 'fb_ph_site', 'ph'],
      ['#fbMsg', 'fb_ph_msg', 'ph'],
      ['#fbPhone', 'fb_ph_phone', 'ph'],
      ['#fbEmail', 'fb_ph_email', 'ph'],
      ['.fb-submit', 'fb_submit'],
      ['.lucky-btn', 'lucky_btn'],
      ['#brokenSel', 'filter_broken']
    ];
    MAP.forEach(function (m) {
      var el = document.querySelector(m[0]);
      if (!el) return;
      var key = m[1];
      if (m[0] === '.results .results-count') {
        el.innerHTML = fill(t('result_count'), (document.getElementById('resultCount') || {}).textContent || '0', yearV);
        return;
      }
      if (m[0] === '.footer p:first-child') { el.textContent = t(IS_NEO ? 'foot_1_neo' : 'foot_1'); return; }
      if (m[0] === '.footer p:nth-child(2)') { el.innerHTML = fill(t('foot_2'), statN, yearV); return; }
      setEl(el, key, m[2]);
    });

    applyGroup('.hero-metrics .metric-label', [
      { key: 'm_cats' }, { key: 'm_regions' }, { key: 'm_likes' }, { key: 'm_health' }
    ]);
    applyGroup('.stat-cards .sc-label', [
      { key: 'label_like' }, { key: 'label_dislike' }, { key: 'label_broken' }, { key: 'label_health' }
    ]);
    applyGroup('.chart-panel h3', [
      { key: 'chart_ring' }, { key: 'chart_dist' }, { key: 'chart_rank' }
    ]);
    applyGroup('.chart-legend span', [
      { key: 'label_like', mode: 'lasttext' },
      { key: 'label_dislike', mode: 'lasttext' },
      { key: 'label_broken', mode: 'lasttext' }
    ]);
    applyGroup('.protect-note h4', [
      { key: 'prot_why' }, { key: 'fp_label' }, { key: 'data_q' }
    ]);
    applyGroup('.protect-note p:not(.disclaimer)', [
      { key: 'prot_p1', mode: 'html' }, { key: 'prot_p2', mode: 'html' }, { key: 'data_p', mode: 'html' }
    ]);
    setEl(document.querySelector('.protect-note .disclaimer'), 'disclaimer');

    /* 反馈表单标签与侧栏说明 */
    applyGroup('.fb-form label', [
      { key: 'fb_label_site' }, { key: 'fb_label_cat' }, { key: 'fb_label_msg' },
      { key: 'fb_label_phone' }, { key: 'fb_label_email' }
    ]);
    setEl(document.querySelector('.fb-side h4'), 'fb_side_t');
    applyGroup('.fb-side p', [
      { key: 'fb_side_p1' }, { key: 'fb_side_p2', mode: 'html' }
    ]);

    /* Cookie 同意条（存在才填） */
    setEl(document.querySelector('.consent .consent-text'), 'consent_text', 'html');
    setEl(document.querySelector('.consent .consent-btn'), 'consent_ok');
  }

  function setLang(code) {
    if (!DICT[code]) return;
    cur = code;
    try { localStorage.setItem('gyp:lang', code); } catch (e) { /* 忽略 */ }
    apply();
    if (typeof window.__gypRefresh === 'function') window.__gypRefresh();
  }

  /* 语言选择器：两版 HTML 里的 #langSel 都由这里填充与绑定 */
  function bindSelector() {
    var sel = document.getElementById('langSel');
    if (!sel || sel._bound) return;
    sel._bound = true;
    sel.innerHTML = LANGS.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === cur ? ' selected' : '') + '>' + l.label + '</option>';
    }).join('');
    sel.addEventListener('change', function (e) { setLang(e.target.value); });
  }

  function boot() { bindSelector(); apply(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { t: t, lang: function () { return cur; }, setLang: setLang, apply: apply, LANGS: LANGS };
})();
