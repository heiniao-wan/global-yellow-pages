/**
 * 全球优质黄页 — 站点种子数据
 * 分类体系参考主流搜索引擎与流量分析平台（Similarweb / Ahrefs 类目）的通用行业分类法
 * 每个站点：名称 / 官网 URL / 所属分类 / 中文简介 / 地区 / 语言
 */
window.SITE_CATEGORIES = [
  { key: 'search',      zh: '搜索引擎',      en: 'Search Engines',          ja: '検索エンジン',       ko: '검색 엔진',        icon: '🔍', desc: '通用与垂直搜索引擎，各国本土检索入口' },
  { key: 'portal',      zh: '门户与导航',    en: 'Portals & Directories',   ja: 'ポータル・ナビ',     ko: '포털·내비게이션',  icon: '🧭', desc: '综合门户首页与网址导航类站点' },
  { key: 'social',      zh: '社区与社交',    en: 'Social & Communities',    ja: 'コミュニティ・SNS',  ko: '커뮤니티·소셜',    icon: '💬', desc: '社交网络、兴趣社区与即时通讯工具' },
  { key: 'news',        zh: '新闻与媒体',    en: 'News & Media',            ja: 'ニュース・メディア', ko: '뉴스·미디어',      icon: '📰', desc: '通讯社、主流报纸与新闻资讯站点' },
  { key: 'media',       zh: '视频与流媒体',  en: 'Video & Streaming',       ja: '動画・配信',         ko: '동영상·스트리밍',  icon: '🎬', desc: '视频平台、在线影视与直播服务' },
  { key: 'ai',          zh: 'AI 与大模型',   en: 'AI & LLMs',               ja: 'AI・大規模モデル',   ko: 'AI·거대 모델',     icon: '🤖', desc: '大模型对话、AI 产品与模型开源平台' },
  { key: 'reference',   zh: '百科与词条',    en: 'Encyclopedias',           ja: '百科・辞典',         ko: '백과·사전',        icon: '📚', desc: '百科全书、词典与学术文献检索平台' },
  { key: 'devtools',    zh: '开发者与技术',  en: 'Developer & Tech',        ja: '開発者・技術',       ko: '개발자·기술',      icon: '💻', desc: '代码托管、技术问答、云服务与主机' },
  { key: 'shopping',    zh: '电商与购物',    en: 'E-commerce',              ja: 'EC・ショッピング',   ko: '쇼핑',             icon: '🛒', desc: '综合电商、二手交易与垂直零售平台' },
  { key: 'local-life',  zh: '本地生活与黄页', en: 'Local Life & Yellow Pages', ja: '生活情報・イエローページ', ko: '생활정보·옐로페이지', icon: '📍', desc: '商户信息、点评评价与地图导航服务' },
  { key: 'jobs',        zh: '招聘与求职',    en: 'Jobs & Recruitment',      ja: '求人・転職',         ko: '채용·구직',        icon: '💼', desc: '综合招聘平台与政府人才服务机构' },
  { key: 'finance',     zh: '金融与证券',    en: 'Finance & Securities',    ja: '金融・証券',         ko: '금융·증권',        icon: '📈', desc: '财经门户、行情数据与证券交易平台' },
  { key: 'travel',      zh: '旅游与出行',    en: 'Travel & Transport',      ja: '旅行・交通',         ko: '여행·교통',        icon: '✈️', desc: '在线旅游代理、酒店预订与目的地资讯' },
  { key: 'tools',       zh: '设计与效率工具', en: 'Design & Productivity',   ja: 'デザイン・効率ツール', ko: '디자인·생산성 도구', icon: '🎨', desc: '在线设计协作、素材图库与团队效率工具' },
  { key: 'education',   zh: '教育与学习',    en: 'Education & Learning',    ja: '教育・学習',         ko: '교육·학습',        icon: '🎓', desc: '在线课程、学习社区与语言学习平台' },
  { key: 'lifestyle',   zh: '健康与生活方式', en: 'Health & Lifestyle',      ja: '健康・ライフスタイル', ko: '건강·라이프스타일', icon: '🌿', desc: '医疗健康、运动健身与品质生活内容' },
  { key: 'machinery',   zh: '机械制造',      en: 'Machinery & Industrial',  ja: '機械製造',           ko: '기계 제조',        icon: '⚙️', desc: '全球工程机械、机床机器人与重工装备强企官网' }
];

/**
 * 场景化入口：按访客意图（要做什么）分流，而不是按行业分类分流。
 * 每个场景是一份策展清单——整类倒出来动辄几十个，策展后十几个更准。
 * domains 用 hostname 去 www 的形式，与下面 site.domain 一致。
 * 按钮文案在 i18n.js（sc_code / sc_ai / sc_design / sc_money / sc_job / sc_learn）。
 */
window.SCENE_DATA = {
  code: {
    icon: '💻',
    domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'news.ycombinator.com',
      'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'hub.docker.com',
      'cloudflare.com', 'vercel.com', 'namecheap.com',
      'cursor.com', 'copilot.github.com', 'replit.com', 'lovable.dev']
  },
  ai: {
    icon: '🤖',
    domains: ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai',
      'deepseek.com', 'kimi.com', 'midjourney.com', 'gamma.app',
      'notebooklm.google.com', 'heygen.com', 'deepl.com', 'huggingface.co']
  },
  design: {
    icon: '🎨',
    domains: ['canva.com', 'figma.com', 'dribbble.com', 'behance.net',
      'unsplash.com', 'pexels.com', 'pixabay.com', 'freepik.com',
      'zcool.com.cn', 'huaban.com', 'gaoding.com', 'remove.bg', 'tinypng.com']
  },
  money: {
    icon: '📈',
    domains: ['bloomberg.com', 'cnbc.com', 'finance.yahoo.com', 'investing.com',
      'tradingview.com', 'eastmoney.com', '10jqka.com.cn', 'xueqiu.com', 'coinbase.com']
  },
  job: {
    icon: '💼',
    domains: ['linkedin.com', 'indeed.com', 'glassdoor.com', 'zhipin.com', 'liepin.com',
      'lagou.com', 'job.rikunabi.com', 'mynavi.jp', 'jobkorea.co.kr', 'wanted.co.kr', 'doda.jp']
  },
  learn: {
    icon: '📚',
    domains: ['wikipedia.org', 'britannica.com', 'wolframalpha.com', 'scholar.google.com',
      'coursera.org', 'khanacademy.org', 'cnki.net', 'duolingo.com',
      'dict.youdao.com', 'merriam-webster.com']
  }
};

/**
 * 编辑推荐大卡：站长亲自用过、愿意长期收藏的站点，带着一句推荐理由。
 * 这是 trust signal——比起「381 个站随便挑」，先给新手几个不会踩坑的锚点。
 * reason 给四语，生成静态块时写进 data-zh/en/ja/ko，运行时由 i18n 按语言取。
 * domain 与 site.domain（hostname 去 www）一致，用于回查站点元数据与截图。
 */
window.EDITOR_PICKS = [
  {
    domain: 'github.com',
    reason: {
      zh: '全球开发者协作与代码托管的事实标准，开源项目的第一站',
      en: 'The de-facto standard for code hosting and developer collaboration',
      ja: '開発者協力・コードホスティングのデファクト標準',
      ko: '개발자 협업과 코드 호스팅의 사실상 표준'
    }
  },
  {
    domain: 'chatgpt.com',
    reason: {
      zh: '最易上手的通用 AI 助手，写作、答疑、编程一把抓',
      en: 'The most approachable general-purpose AI assistant for writing, Q&A, and coding',
      ja: 'もっとも手軽な汎用 AI アシスタント。文章・質問・コードに対応',
      ko: '글쓰기·질의응답·코딩을 한 번에, 가장 접근성 높은 범용 AI'
    }
  },
  {
    domain: 'unsplash.com',
    reason: {
      zh: '免费高质感图片素材库，可商用，再也不用为配图发愁',
      en: 'Free high-quality photos you can use commercially — no more stock-photo hunt',
      ja: '商用可の高品質写真が無料。素材探しに困らない',
      ko: '상업적으로 써도 되는 고품질 무료 사진, 소재 걱정 끝'
    }
  },
  {
    domain: 'coursera.org',
    reason: {
      zh: '顶尖大学的系统在线课程，从入门到专业认证一条龙',
      en: 'Structured online courses from top universities, from intro to professional certs',
      ja: 'トップ大学の体系的オンライン講座。入門から資格まで',
      ko: '명문 대학의 체계적 온라인 강좌, 입문부터 전문 자격까지'
    }
  }
];

window.SITE_DATA = [
  // ── 搜索引擎 ──
  { name: 'Google', url: 'https://www.google.com', category: 'search', desc: '全球覆盖面最广的搜索引擎，提供网页、图片、视频等多形态检索服务。', region: '全球', lang: '多语言' },
  { name: '百度', url: 'https://www.baidu.com', category: 'search', desc: '中国市场份额第一的搜索引擎，覆盖网页、贴吧、地图与智能问答。', region: '中国', lang: '中文' },
  { name: 'Bing', url: 'https://www.bing.com', category: 'search', desc: '微软旗下搜索引擎，提供网页、图片与人工智能 Copilot 搜索能力。', region: '欧美', lang: '英文' },
  { name: 'Naver', url: 'https://www.naver.com', category: 'search', desc: '韩国占有率最高的搜索门户，集成新闻、地图、购物与博客检索。', region: '韩国', lang: '韩文' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com', category: 'search', desc: '主打隐私保护的独立搜索引擎，不追踪用户搜索记录。', region: '欧美', lang: '英文' },
  { name: 'Yandex', url: 'https://yandex.com', category: 'search', desc: '俄罗斯及东欧地区主导的搜索引擎，附带图片与地图服务。', region: '其他', lang: '多语言' },
  { name: 'Yahoo! JAPAN', url: 'https://www.yahoo.co.jp', category: 'search', desc: '日本国民级搜索与门户，由 LINE 雅虎运营，本地生态极强。', region: '日本', lang: '日文' },
  { name: ' goo', url: 'https://www.goo.ne.jp', category: 'search', desc: 'NTT 旗下的日本老牌门户搜索引擎，提供词典与转乘换乘工具。', region: '日本', lang: '日文' },
  { name: 'Yahoo!', url: 'https://www.yahoo.com', category: 'search', desc: '美国老牌互联网门户，旗下 Yahoo 搜索现由 Bing 技术提供支持。', region: '欧美', lang: '英文' },
  { name: '搜狗搜索', url: 'https://www.sogou.com', category: 'search', desc: '腾讯旗下中文搜索引擎，擅长微信公众号文章与中文内容检索。', region: '中国', lang: '中文' },
  { name: '360搜索', url: 'https://www.so.com', category: 'search', desc: '奇虎 360 推出的中文搜索引擎，依托安全与浏览器生态推广。', region: '中国', lang: '中文' },
  { name: 'Daum', url: 'https://www.daum.net', category: 'search', desc: 'Kakao 旗下韩国第二大门户，新闻与邮箱社区业务积累深厚。', region: '韩国', lang: '韩文' },
  { name: 'Brave Search', url: 'https://search.brave.com', category: 'search', desc: '源自隐私浏览器 Brave 的独立搜索索引，不建立用户画像。', region: '欧美', lang: '英文' },
  { name: 'Qwant', url: 'https://www.qwant.com', category: 'search', desc: '源自法国的欧洲独立搜索引擎，强调隐私与多元结果来源。', region: '欧美', lang: '英文' },
  { name: 'Startpage', url: 'https://www.startpage.com', category: 'search', desc: '荷兰起家的搜索服务，以匿名代理与 Google 结果中立呈现著称。', region: '欧美', lang: '英文' },
  { name: 'Ecosia', url: 'https://www.ecosia.org', category: 'search', desc: '德国搜索引擎，将搜索广告收入用于植树等环保项目。', region: '欧美', lang: '英文' },

  // ── 门户与导航 ──
  { name: 'hao123', url: 'https://www.hao123.com', category: 'portal', desc: '百度旗下网址导航，按分类整理全网站点，是中国最早导航站之一。', region: '中国', lang: '中文' },
  { name: '360导航', url: 'https://hao.360.com', category: 'portal', desc: '奇虎 360 网址导航，聚合门户、新闻、影视等入口并承接安全软件流量。', region: '中国', lang: '中文' },
  { name: '2345网址导航', url: 'https://www.2345.com', category: 'portal', desc: '老牌中文网址导航，收录音乐、小说、财经与热门游戏等分类站点。', region: '中国', lang: '中文' },
  { name: '搜狗网址导航', url: 'https://123.sogou.com', category: 'portal', desc: '搜狗推出的上网导航，提供网址直达与天气、充值等查询服务。', region: '中国', lang: '中文' },
  { name: 'QQ导航', url: 'https://hao.qq.com', category: 'portal', desc: '腾讯 QQ 浏览器配套导航站，聚合常用网站与内容频道入口。', region: '中国', lang: '中文' },
  { name: '毒霸', url: 'https://www.duba.com', category: 'portal', desc: '安全软件厂商旗下的网址大全，分类收录各类实用站点入口。', region: '中国', lang: '中文' },
  { name: '腾讯网', url: 'https://www.qq.com', category: 'portal', desc: '腾讯综合门户首页，聚合新闻、视频、邮箱与自家生态产品入口。', region: '中国', lang: '中文' },
  { name: '新浪网', url: 'https://www.sina.com.cn', category: 'portal', desc: '中国老牌综合门户，新闻、微博与财经频道构成主要内容矩阵。', region: '中国', lang: '中文' },
  { name: '网易', url: 'https://www.163.com', category: 'portal', desc: '网易综合门户，覆盖新闻、邮箱、游戏与公开课等业务入口。', region: '中国', lang: '中文' },
  { name: '搜狐', url: 'https://www.sohu.com', category: 'portal', desc: '中文综合门户，新闻与视频内容为主并承载搜狐号自媒体生态。', region: '中国', lang: '中文' },
  { name: '凤凰网', url: 'https://www.ifeng.com', category: 'portal', desc: '华文媒体门户，聚合时政、财经与文化类深度报道与专栏内容。', region: '中国', lang: '中文' },
  { name: 'Livedoor', url: 'https://www.livedoor.jp', category: 'portal', desc: '日本老牌门户，博客服务起家并提供新闻、目录与社区服务。', region: '日本', lang: '日文' },
  { name: 'BIGLOBE', url: 'https://www.biglobe.ne.jp', category: 'portal', desc: '日本老牌 ISP 门户，提供网络服务、邮箱、社区与本地生活信息。', region: '日本', lang: '日文' },
  { name: 'Nate', url: 'https://www.nate.com', category: 'portal', desc: 'SK 旗下的韩国老牌门户，早期以社区论坛与邮箱服务见长。', region: '韩国', lang: '韩文' },
  { name: 'Zum', url: 'https://zum.com', category: 'portal', desc: '韩国轻量级门户，首页聚合新闻热点并内置独立韩文搜索。', region: '韩国', lang: '韩文' },
  { name: 'Tistory', url: 'https://www.tistory.com', category: 'portal', desc: '韩国最主流的免费博客平台，由 Kakao 运营并面向创作者。', region: '韩国', lang: '韩文' },
  { name: 'Cốc Cốc', url: 'https://coccoc.com', category: 'portal', desc: '越南本土浏览器与搜索门户，本地市场份额高，集成新闻聚合。', region: '东南亚', lang: '多语言' },
  { name: 'detikcom', url: 'https://www.detik.com', category: 'portal', desc: '印尼影响力最大的媒体集团门户，新闻与资讯覆盖全国各岛。', region: '东南亚', lang: '多语言' },
  { name: 'The Straits Times', url: 'https://www.straitstimes.com', category: 'portal', desc: '新加坡主流英文报纸官方网站，报道东南亚时政、商业与社会新闻。', region: '东南亚', lang: '英文' },

  // ── 社区与社交 ──
  { name: 'Facebook', url: 'https://www.facebook.com', category: 'social', desc: '全球用户规模最大的社交网络，承载好友动态、群组与商务广告。', region: '全球', lang: '多语言' },
  { name: 'X', url: 'https://x.com', category: 'social', desc: '原 Twitter 的实时信息流平台，以短文本与话题传播见长。', region: '全球', lang: '英文' },
  { name: 'Instagram', url: 'https://www.instagram.com', category: 'social', desc: '以图片与短视频分享为核心的照片社交平台，青少年用户占比高。', region: '全球', lang: '多语言' },
  { name: 'Reddit', url: 'https://www.reddit.com', category: 'social', desc: '全球最大的兴趣论坛社区，按子版块组织各垂直话题讨论。', region: '欧美', lang: '英文' },
  { name: 'TikTok', url: 'https://www.tiktok.com', category: 'social', desc: '字节跳动旗下短视频社交平台，算法推荐驱动全球内容爆发。', region: '全球', lang: '多语言' },
  { name: 'Pinterest', url: 'https://www.pinterest.com', category: 'social', desc: '以图片收藏与灵感发现为核心的平台，充当全球视觉搜图入口。', region: '欧美', lang: '英文' },
  { name: 'Discord', url: 'https://discord.com', category: 'social', desc: '面向游戏与兴趣社群的语音文字社区，已广泛用于各类线上社群。', region: '欧美', lang: '英文' },
  { name: 'Threads', url: 'https://www.threads.net', category: 'social', desc: 'Meta 推出的文字短帖社交应用，与 Instagram 账号体系互通。', region: '全球', lang: '英文' },
  { name: '微博', url: 'https://weibo.com', category: 'social', desc: '中国头部社交平台，热点话题传播与明星资讯扩散能力极强。', region: '中国', lang: '中文' },
  { name: '知乎', url: 'https://www.zhihu.com', category: 'social', desc: '中文问答社区，以专业讨论与经验分享聚集大量长尾内容。', region: '中国', lang: '中文' },
  { name: '豆瓣', url: 'https://www.douban.com', category: 'social', desc: '中文兴趣社区，图书影音评分与小组讨论构成核心使用场景。', region: '中国', lang: '中文' },
  { name: '百度贴吧', url: 'https://tieba.baidu.com', category: 'social', desc: '按兴趣主题划分的论坛社区，覆盖大量下沉城市的用户讨论。', region: '中国', lang: '中文' },
  { name: '小红书', url: 'https://www.xiaohongshu.com', category: 'social', desc: '生活方式种草社区，以笔记形式分享消费、美妆与旅游体验。', region: '中国', lang: '中文' },
  { name: '抖音', url: 'https://www.douyin.com', category: 'social', desc: '中国头部短视频平台，短视频与直播电商生态高度完整。', region: '中国', lang: '中文' },
  { name: '快手', url: 'https://www.kuaishou.com', category: 'social', desc: '下沉市场渗透率高的短视频社区平台，直播与电商并重发展。', region: '中国', lang: '中文' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com', category: 'social', desc: '中国年轻用户聚集的视频社区，番剧、游戏与知识区内容突出。', region: '中国', lang: '中文' },
  { name: 'LINE', url: 'https://line.me', category: 'social', desc: '日本国民级即时通讯应用，扩展出支付、内容与生活服务生态。', region: '日本', lang: '日文' },
  { name: 'mixi', url: 'https://mixi.co.jp', category: 'social', desc: '日本早期大型 SNS 社区，以日记功能与兴趣圈层互动为核心。', region: '日本', lang: '日文' },
  { name: '5ちゃんねる', url: 'https://5ch.net', category: 'social', desc: '日本最具影响力的匿名板型论坛，话题覆盖社会与网络文化。', region: '日本', lang: '日文' },
  { name: '디시인사이드', url: 'https://dcinside.com', category: 'social', desc: '韩国流量最大的匿名社区，设有画廊、即时通讯等独立板块。', region: '韩国', lang: '韩文' },
  { name: 'KakaoTalk', url: 'https://www.kakaotalk.com', category: 'social', desc: '韩国国民级即时通讯工具，衍生出支付、打车与电商等服务。', region: '韩国', lang: '韩文' },

  // ── 新闻与媒体 ──
  { name: 'BBC News', url: 'https://www.bbc.com', category: 'news', desc: '英国广播公司新闻站点，国际时政报道以中立严谨著称。', region: '欧美', lang: '英文' },
  { name: 'Reuters', url: 'https://www.reuters.com', category: 'news', desc: '国际顶级财经通讯社，突发快讯与市场数据被全球广泛引用。', region: '欧美', lang: '英文' },
  { name: 'CNN', url: 'https://www.cnn.com', category: 'news', desc: '美国有线电视新闻网，擅长突发热点与现场连线式深度报道。', region: '欧美', lang: '英文' },
  { name: 'The Guardian', url: 'https://www.theguardian.com', category: 'news', desc: '英国主流数字报纸，评论版与调查报道影响力尤其突出。', region: '欧美', lang: '英文' },
  { name: 'AP News', url: 'https://apnews.com', category: 'news', desc: '美联社新闻门户，为全球媒体提供权威突发新闻稿件来源。', region: '欧美', lang: '英文' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com', category: 'news', desc: '卡塔尔半岛电视台官网，覆盖中东、非洲与国际政治深度报道。', region: '其他', lang: '英文' },
  { name: '新华网', url: 'https://www.news.cn', category: 'news', desc: '中国国家级通讯社门户，发布时政要闻与对外宣传内容。', region: '中国', lang: '中文' },
  { name: '澎湃新闻', url: 'https://www.thepaper.cn', category: 'news', desc: '上海报业旗下新闻客户端，调查报道与深度评论影响力突出。', region: '中国', lang: '中文' },
  { name: '财新网', url: 'https://www.caixin.com', category: 'news', desc: '专注财经的独立媒体，深度调查与公司报道专业度较高。', region: '中国', lang: '中文' },
  { name: '联合早报', url: 'https://www.zaobao.com.sg', category: 'news', desc: '新加坡中文主流日报，报道覆盖东南亚、中国与两岸议题。', region: '东南亚', lang: '中文' },
  { name: '日本経済新聞', url: 'https://www.nikkei.com', category: 'news', desc: '日本第一大经济时报，股市与企业经营报道行业标杆。', region: '日本', lang: '日文' },
  { name: '朝日新聞', url: 'https://www.asahi.com', category: 'news', desc: '日本全国性主流报纸，调查报道与政治新闻版面质量高。', region: '日本', lang: '日文' },
  { name: '毎日新聞', url: 'https://mainichi.jp', category: 'news', desc: '日本老牌每日新闻社，以社会新闻与体育版面见长。', region: '日本', lang: '日文' },
  { name: '読売新聞', url: 'https://www.yomiuri.co.jp', category: 'news', desc: '日本发行量最大的报纸，政论立场保守并拥有庞大读者群。', region: '日本', lang: '日文' },
  { name: 'NHK', url: 'https://www.nhk.or.jp', category: 'news', desc: '日本公共广播机构官网，节目、新闻与灾害信息权威发布渠道。', region: '日本', lang: '日文' },
  { name: 'ITmedia', url: 'https://www.itmedia.co.jp', category: 'news', desc: '日本领先科技媒体集团，覆盖企业 IT、网络与消费电子评测。', region: '日本', lang: '日文' },
  { name: 'PR TIMES', url: 'https://prtimes.jp', category: 'news', desc: '日本企业新闻稿发布平台，科技与服务新品公告集中发布地。', region: '日本', lang: '日文' },
  { name: '연합뉴스', url: 'https://www.yna.co.kr', category: 'news', desc: '韩国联合通讯社官网，提供全国最快速的韩文新闻更新。', region: '韩国', lang: '韩文' },
  { name: '동아일보', url: 'https://www.donga.com', category: 'news', desc: '韩国主流保守阵营日报，擅长时政分析与深度专题报道。', region: '韩国', lang: '韩文' },
  { name: '조선일보', url: 'https://www.chosun.com', category: 'news', desc: '韩国发行量最大的日报之一，财经与体育内容覆盖面广。', region: '韩国', lang: '韩文' },

  // ── 视频与流媒体 ──
  { name: 'YouTube', url: 'https://www.youtube.com', category: 'media', desc: '全球最大视频平台，兼具长视频创作者生态与短视频信息流。', region: '全球', lang: '多语言' },
  { name: 'Netflix', url: 'https://www.netflix.com', category: 'media', desc: '全球最大流媒体订阅平台，自制剧集与电影内容库覆盖广泛。', region: '全球', lang: '多语言' },
  { name: 'Twitch', url: 'https://www.twitch.tv', category: 'media', desc: '以游戏直播为核心的视频平台，电竞赛事与主播生态成熟。', region: '欧美', lang: '英文' },
  { name: 'Vimeo', url: 'https://vimeo.com', category: 'media', desc: '面向创作者的专业视频托管平台，主打高质量作品集托管。', region: '欧美', lang: '英文' },
  { name: 'Disney+', url: 'https://www.disneyplus.com', category: 'media', desc: '迪士尼流媒体服务，汇集旗下动画、漫威与卢卡斯影业内容。', region: '欧美', lang: '多语言' },
  { name: 'Hulu', url: 'https://www.hulu.com', category: 'media', desc: '美国流媒体平台，剧集更新节奏快且与电视端生态打通。', region: '欧美', lang: '英文' },
  { name: '爱奇艺', url: 'https://www.iqiyi.com', category: 'media', desc: '中国头部长视频平台，自制剧集、综艺与动漫内容储备丰富。', region: '中国', lang: '中文' },
  { name: '腾讯视频', url: 'https://v.qq.com', category: 'media', desc: '腾讯旗下综合视频平台，覆盖剧集、综艺、电竞与动漫内容。', region: '中国', lang: '中文' },
  { name: '优酷', url: 'https://www.youku.com', category: 'media', desc: '阿里系长视频平台，承接大量剧集版权与独家自制内容。', region: '中国', lang: '中文' },
  { name: 'ABEMA', url: 'https://www.abema.tv', category: 'media', desc: '日本网络电视台，提供 24 小时频道与赛事、网络剧集直播。', region: '日本', lang: '日文' },
  { name: 'TVer', url: 'https://tver.jp', category: 'media', desc: '日本免费流媒体平台，聚合电视台节目与独家网络内容。', region: '日本', lang: '日文' },
  { name: 'ニコニコ動画', url: 'https://www.nicovideo.jp', category: 'media', desc: '日本弹幕视频社区，用户评论以弹幕形式叠加在画面之上。', region: '日本', lang: '日文' },
  { name: 'U-NEXT', url: 'https://video.unext.jp', category: 'media', desc: '日本综合流媒体，提供电影、动画、漫画与体育多品类订阅。', region: '日本', lang: '日文' },
  { name: 'WATCHA', url: 'https://watcha.net', category: 'media', desc: 'Naver 旗下影视内容平台，主打原创网剧与欧美影视内容。', region: '韩国', lang: '韩文' },
  { name: 'Coupang Play', url: 'https://www.coupangplay.com', category: 'media', desc: 'Coupang 生态内的视频会员服务，与电商会员体系打通。', region: '韩国', lang: '韩文' },
  { name: 'TVING', url: 'https://www.tving.com', category: 'media', desc: '韩国综合流媒体，涵盖电视台直播、剧集与体育赛事版权。', region: '韩国', lang: '韩文' },
  { name: 'Viu', url: 'https://www.viu.com', category: 'media', desc: '东南亚主流流媒体平台，本地剧集与免费内容占比较高。', region: '东南亚', lang: '多语言' },
  { name: 'Viki', url: 'https://www.viki.com', category: 'media', desc: '亚洲剧集与动漫的流媒体平台，字幕组翻译社区知名度高。', region: '东南亚', lang: '多语言' },

  // ── AI 与大模型 ──
  { name: 'ChatGPT', url: 'https://chatgpt.com', category: 'ai', desc: 'OpenAI 旗下通用对话助手，是全球用户规模最大的 AI 应用入口。', region: '全球', lang: '英文' },
  { name: 'OpenAI', url: 'https://openai.com', category: 'ai', desc: '美国人工智能研究机构官网，发布模型、研究成果与开发者 API。', region: '欧美', lang: '英文' },
  { name: 'Claude', url: 'https://claude.ai', category: 'ai', desc: 'Anthropic 推出的对话式 AI 助手，长文本分析与写作能力突出。', region: '欧美', lang: '英文' },
  { name: 'Anthropic', url: 'https://www.anthropic.com', category: 'ai', desc: 'Claude 模型的开发公司官网，发布安全对齐研究与模型文档。', region: '欧美', lang: '英文' },
  { name: 'Gemini', url: 'https://gemini.google.com', category: 'ai', desc: 'Google 推出的多模态 AI 助手，与搜索及 Workspace 办公套件联动。', region: '全球', lang: '英文' },
  { name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com', category: 'ai', desc: '微软 AI 助手，深度集成于 Windows 与 Office 全套办公场景。', region: '欧美', lang: '英文' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai', category: 'ai', desc: '主打搜索增强的 AI 问答工具，回答附带可溯源的引用链接。', region: '欧美', lang: '英文' },
  { name: 'DeepSeek', url: 'https://www.deepseek.com', category: 'ai', desc: '国产通用大模型服务，以推理与代码能力在开发者中快速普及。', region: '中国', lang: '中文' },
  { name: '豆包', url: 'https://www.doubao.com', category: 'ai', desc: '字节跳动旗下 AI 助手，依托大模型能力提供多场景智能服务。', region: '中国', lang: '中文' },
  { name: 'Kimi', url: 'https://www.kimi.com', category: 'ai', desc: '月之暗面推出的长文本 AI 助手，超长上下文处理是核心卖点。', region: '中国', lang: '中文' },
  { name: '讯飞星火', url: 'https://xinghuo.xfyun.cn', category: 'ai', desc: '科大讯飞推出的认知大模型平台，语音交互与教育场景优势明显。', region: '中国', lang: '中文' },
  { name: '智谱清言', url: 'https://chatglm.cn', category: 'ai', desc: '智谱 AI 推出的对话助手，基于自研 GLM 大模型构建。', region: '中国', lang: '中文' },
  { name: 'Hugging Face', url: 'https://huggingface.co', category: 'ai', desc: '全球最大开源模型与数据集社区，托管海量 AI 训练资源。', region: '全球', lang: '英文' },
  { name: 'Midjourney', url: 'https://www.midjourney.com', category: 'ai', desc: '知名 AI 图像生成工具，作品风格鲜明并被大量设计师采用。', region: '欧美', lang: '英文' },
  { name: 'Character.AI', url: 'https://character.ai', category: 'ai', desc: '角色扮演类 AI 对话平台，用户可自定义并训练虚拟角色。', region: '欧美', lang: '英文' },
  { name: 'Poe', url: 'https://poe.com', category: 'ai', desc: '多模型聚合平台，可在一个界面内切换调用各家 AI 模型。', region: '全球', lang: '英文' },
  { name: 'Grok', url: 'https://grok.com', category: 'ai', desc: 'xAI 推出的对话助手，联动 X 平台实时信息，回答风格犀利。', region: '欧美', lang: '英文' },
  { name: '通义千问', url: 'https://chat.qwen.ai', category: 'ai', desc: '阿里通义千问官方对话入口，覆盖问答、写作、图像与深度研究。', region: '中国', lang: '中文' },
  { name: 'NotebookLM', url: 'https://notebooklm.google.com', category: 'ai', desc: 'Google 出品的笔记式研究助手，上传资料即可问答并生成摘要。', region: '全球', lang: '多语言' },
  { name: 'GitHub Copilot', url: 'https://copilot.github.com', category: 'ai', desc: '主流 AI 编程助手，在编辑器内补全代码、生成函数并解释逻辑。', region: '全球', lang: '多语言' },
  { name: 'Cursor', url: 'https://cursor.com', category: 'ai', desc: 'AI 优先的代码编辑器，支持对话式改码与整仓上下文理解。', region: '欧美', lang: '英文' },
  { name: 'Lovable', url: 'https://lovable.dev', category: 'ai', desc: '对话式生成完整网页应用的 AI 开发平台，出码即可部署上线。', region: '欧美', lang: '英文' },
  { name: 'Manus', url: 'https://manus.im', category: 'ai', desc: '通用型 AI 智能体，可自主拆解任务、检索资料并交付成品文件。', region: '全球', lang: '多语言' },
  { name: 'Suno', url: 'https://suno.com', category: 'ai', desc: '文本生成歌曲的 AI 音乐工具，含人声与配器，创作门槛极低。', region: '欧美', lang: '英文' },
  { name: 'ElevenLabs', url: 'https://elevenlabs.io', category: 'ai', desc: '拟真 AI 语音合成平台，支持多语种配音与声音克隆。', region: '欧美', lang: '多语言' },
  { name: 'CapCut', url: 'https://www.capcut.com', category: 'ai', desc: '全球流行的 AI 视频剪辑工具，自动字幕、一键成片与智能抠像。', region: '全球', lang: '多语言' },
  { name: 'Higgsfield', url: 'https://higgsfield.ai', category: 'ai', desc: '主打电影感镜头与热门预设的 AI 视频与图像生成平台。', region: '欧美', lang: '英文' },
  { name: 'Runway', url: 'https://runwayml.com', category: 'ai', desc: '专业级 AI 视频生成与编辑平台，支持补帧、擦除与影视特效。', region: '欧美', lang: '英文' },
  { name: 'Gamma', url: 'https://gamma.app', category: 'ai', desc: '输入文字即生成演示文稿的 AI 工具，适合汇报与项目提案。', region: '欧美', lang: '英文' },
  { name: 'Photoroom', url: 'https://www.photoroom.com', category: 'ai', desc: '电商图 AI 处理工具，一键抠图、换背景并生成商品主图。', region: '欧美', lang: '多语言' },
  { name: 'SeaArt', url: 'https://www.seaart.ai', category: 'ai', desc: '多模型 AI 绘画社区，支持文生图、图生图与风格模型训练。', region: '全球', lang: '多语言' },
  { name: 'Leonardo.AI', url: 'https://leonardo.ai', category: 'ai', desc: '面向游戏与概念设计的 AI 绘图平台，风格与细节控制能力强。', region: '欧美', lang: '英文' },
  { name: 'Replit', url: 'https://replit.com', category: 'ai', desc: '云端编程环境内置 AI 助手，可直接生成并部署完整应用。', region: '欧美', lang: '英文' },
  { name: 'HeyGen', url: 'https://www.heygen.com', category: 'ai', desc: 'AI 数字人视频平台，文本驱动口型并支持多语种翻译配音。', region: '欧美', lang: '多语言' },
  { name: 'DeepL', url: 'https://www.deepl.com', category: 'ai', desc: '以译文自然度著称的 AI 翻译工具，支持整篇文档与原网页翻译。', region: '欧美', lang: '多语言' },
  { name: 'Luma AI', url: 'https://lumalabs.ai', category: 'ai', desc: 'AI 视频与三维场景生成工具，可由照片重建可漫游的空间。', region: '欧美', lang: '英文' },
  { name: 'Synthesia', url: 'https://www.synthesia.io', category: 'ai', desc: '企业级 AI 数字人视频平台，常用于培训课件与产品讲解。', region: '欧美', lang: '多语言' },
  { name: 'Descript', url: 'https://www.descript.com', category: 'ai', desc: '以文本编辑音视频的 AI 工具，改字幕即改片并支持 AI 配音。', region: '欧美', lang: '英文' },
  { name: 'Otter.ai', url: 'https://otter.ai', category: 'ai', desc: '会议实时转写与纪要助手，自动区分发言人并提炼待办事项。', region: '欧美', lang: '英文' },
  { name: 'Groq', url: 'https://groq.com', category: 'ai', desc: '自研推理芯片平台，以极低延迟运行开源大模型与云端 API。', region: '欧美', lang: '英文' },
  { name: 'Google AI Studio', url: 'https://aistudio.google.com', category: 'ai', desc: 'Google 大模型实验平台，可免费调用 Gemini 并生成应用原型。', region: '全球', lang: '多语言' },
  { name: 'Meta AI', url: 'https://www.meta.ai', category: 'ai', desc: 'Meta 出品的 AI 助手，覆盖聊天问答、图像创作与跨平台服务。', region: '全球', lang: '多语言' },
  { name: 'Civitai', url: 'https://civitai.com', category: 'ai', desc: '开源模型与提示词共享社区，聚合大量可下载的绘画风格模型。', region: '全球', lang: '英文' },
  { name: 'Stability AI', url: 'https://stability.ai', category: 'ai', desc: 'Stable Diffusion 系列模型的开发公司，提供图像与音频生成能力。', region: '欧美', lang: '英文' },
  { name: 'Ideogram', url: 'https://ideogram.ai', category: 'ai', desc: '擅长图片内文字渲染的 AI 生图工具，做海报与封面很实用。', region: '欧美', lang: '英文' },
  { name: 'Pika', url: 'https://pika.art', category: 'ai', desc: 'AI 短视频生成工具，支持文生视频、图生视频与创意特效编辑。', region: '欧美', lang: '英文' },
  { name: 'PixVerse', url: 'https://pixverse.ai', category: 'ai', desc: '多模态 AI 视频生成平台，图生视频与角色一致性表现突出。', region: '全球', lang: '多语言' },
  { name: 'OpusClip', url: 'https://www.opus.pro', category: 'ai', desc: '把长视频自动剪成短视频的 AI 工具，自媒体高频使用。', region: '欧美', lang: '多语言' },
  { name: 'InVideo', url: 'https://invideo.io', category: 'ai', desc: '文本生成营销视频的 AI 平台，内置大量模板与版权素材库。', region: '全球', lang: '多语言' },
  { name: '腾讯元宝', url: 'https://yuanbao.tencent.com', category: 'ai', desc: '腾讯 AI 助手，可总结公众号文章并深度联动微信生态内容。', region: '中国', lang: '中文' },
  { name: '夸克', url: 'https://www.quark.cn', category: 'ai', desc: '以 AI 搜索与文档处理见长的工具入口，学生与办公人群常用。', region: '中国', lang: '中文' },
  { name: '即梦 AI', url: 'https://jimeng.jianying.com', category: 'ai', desc: '字节旗下 AI 创作平台，生图与图生视频的中文文字渲染出色。', region: '中国', lang: '中文' },
  { name: '可灵 AI', url: 'https://klingai.kuaishou.com', category: 'ai', desc: '快手旗下 AI 视频生成工具，长视频与人物动作稳定性突出。', region: '中国', lang: '中文' },
  { name: '海螺 AI', url: 'https://hailuoai.com', category: 'ai', desc: 'MiniMax 出品的 AI 助手，语音合成自然度与创意写作见长。', region: '中国', lang: '中文' },
  { name: '秘塔 AI 搜索', url: 'https://metaso.cn', category: 'ai', desc: '无广告结构化 AI 搜索，结果带引用来源，适合调研与写稿。', region: '中国', lang: '中文' },
  { name: '纳米 AI 搜索', url: 'https://www.n.cn', category: 'ai', desc: '多模型聚合的 AI 搜索入口，支持深度研究与一键生成报告。', region: '中国', lang: '中文' },
  { name: '天工 AI', url: 'https://www.tiangong.cn', category: 'ai', desc: '昆仑万维推出的 AI 助手，覆盖搜索、写作、音乐与图像生成。', region: '中国', lang: '中文' },
  { name: 'Vidu', url: 'https://www.vidu.cn', category: 'ai', desc: '生数科技推出的 AI 视频生成工具，多镜头一致性表现优秀。', region: '中国', lang: '中文' },
  { name: '扣子 Coze', url: 'https://www.coze.cn', category: 'ai', desc: '零代码搭建 AI 机器人与工作流的平台，可发布到多个渠道。', region: '中国', lang: '中文' },
  { name: '剪映', url: 'https://www.jianying.com', category: 'ai', desc: '国民级视频剪辑工具，AI 字幕、一键成片与数字人功能齐全。', region: '中国', lang: '中文' },
  { name: '百度文心', url: 'https://wenxin.baidu.com', category: 'ai', desc: '百度文心大模型官方入口，提供对话、写作与多模态生成能力。', region: '中国', lang: '中文' },
  { name: 'WPS AI', url: 'https://ai.wps.cn', category: 'ai', desc: 'WPS 办公套件内置 AI，支持文档起草、表格分析与演示生成。', region: '中国', lang: '中文' },

  // ── 百科与词条 ──
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', category: 'reference', desc: '全球最大的免费多语言百科全书，采用开放协作与知识共享许可。', region: '全球', lang: '多语言' },
  { name: '百度百科', url: 'https://baike.baidu.com', category: 'reference', desc: '中文互联网最大的百科词条平台，覆盖人物、地名与影视资料。', region: '中国', lang: '中文' },
  { name: 'Britannica', url: 'https://www.britannica.com', category: 'reference', desc: '历史悠久的英文权威百科，学术性与词条撰写质量极高。', region: '欧美', lang: '英文' },
  { name: 'WolframAlpha', url: 'https://www.wolframalpha.com', category: 'reference', desc: '计算知识引擎，可解答数学、物理与统计等结构化问题。', region: '全球', lang: '英文' },
  { name: 'Merriam-Webster', url: 'https://www.merriam-webster.com', category: 'reference', desc: '美国主流英语词典，提供释义、音标、例句与词源信息。', region: '欧美', lang: '英文' },
  { name: 'Cambridge Dictionary', url: 'https://dictionary.cambridge.org', category: 'reference', desc: '剑桥大学出版社的英语词典，含英美音标与双语例句库。', region: '欧美', lang: '英文' },
  { name: '有道词典', url: 'https://dict.youdao.com', category: 'reference', desc: '网易旗下中英词典工具，提供翻译、例句与口语发音功能。', region: '中国', lang: '中文' },
  { name: '金山词霸', url: 'https://www.iciba.com', category: 'reference', desc: '中文老牌词典与翻译平台，桌面客户端与网页服务并重。', region: '中国', lang: '中文' },
  { name: 'コトバンク', url: 'https://kotobank.jp', category: 'reference', desc: '日本大型词典与百科聚合站，收录日语辞书与成语典故。', region: '日本', lang: '日文' },
  { name: 'Weblio', url: 'https://weblio.jp', category: 'reference', desc: '日本常用检索引擎，内置多部辞书并支持中文与英文查询。', region: '日本', lang: '日文' },
  { name: 'CiNii', url: 'https://cir.nii.ac.jp', category: 'reference', desc: '日本国立情报学研究所的学术搜索平台，检索论文与研究资料。', region: '日本', lang: '日文' },
  { name: '国立国会図書館', url: 'https://www.ndl.go.jp', category: 'reference', desc: '日本国立国会图书馆官网，可检索馆藏目录与数字资料。', region: '日本', lang: '日文' },
  { name: '나무위키', url: 'https://namu.wiki', category: 'reference', desc: '韩国最流行的开放式百科，用户编辑内容覆盖互联网各类梗与资料。', region: '韩国', lang: '韩文' },
  { name: '지식iN', url: 'https://kin.naver.com', category: 'reference', desc: 'Naver 旗下的韩文问答社区，用户互答生活与专业问题。', region: '韩国', lang: '韩文' },
  { name: 'Daum 사전', url: 'https://dict.daum.net', category: 'reference', desc: 'Daum 提供的韩语词典与中英韩三语互查工具。', region: '韩国', lang: '韩文' },
  { name: 'RISS', url: 'https://www.riss.kr', category: 'reference', desc: '韩国教育学术院运营的论文数据库，检索硕博论文与期刊文献。', region: '韩国', lang: '韩文' },
  { name: '中国知网', url: 'https://www.cnki.net', category: 'reference', desc: '中国最大的学术期刊与学位论文数据库，高校科研检索首选。', region: '中国', lang: '中文' },
  { name: 'Google Scholar', url: 'https://scholar.google.com', category: 'reference', desc: '谷歌学术搜索平台，免费检索全球范围内的学术论文文献。', region: '全球', lang: '多语言' },

  // ── 开发者与技术 ──
  { name: 'GitHub', url: 'https://github.com', category: 'devtools', desc: '全球最大代码托管平台，承载开源项目协作与软件包分发。', region: '全球', lang: '英文' },
  { name: 'GitLab', url: 'https://gitlab.com', category: 'devtools', desc: '覆盖 DevOps 全流程的代码平台，支持自建与公有云仓库托管。', region: '全球', lang: '英文' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com', category: 'devtools', desc: '全球开发者技术问答社区，编程问题解答与职位机会集聚。', region: '全球', lang: '英文' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com', category: 'devtools', desc: 'Y Combinator 运营的科技新闻聚合社区，创业与技术圈口碑极好。', region: '欧美', lang: '英文' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', category: 'devtools', desc: 'Mozilla 维护的前端开发文档，Web 标准与 API 参考的行业基准。', region: '全球', lang: '英文' },
  { name: 'npm', url: 'https://www.npmjs.com', category: 'devtools', desc: 'JavaScript 最大包管理仓库，海量前端与 Node 依赖可直接获取。', region: '全球', lang: '英文' },
  { name: 'PyPI', url: 'https://pypi.org', category: 'devtools', desc: 'Python 官方软件包索引，是安装第三方 Python 库的标准来源。', region: '全球', lang: '英文' },
  { name: 'Docker Hub', url: 'https://hub.docker.com', category: 'devtools', desc: '容器镜像托管仓库，开发者分发 Docker 应用的标准平台。', region: '全球', lang: '英文' },
  { name: 'Cloudflare', url: 'https://www.cloudflare.com', category: 'devtools', desc: '全球 CDN 与云安全服务商，提供加速、DDoS 防护与边缘计算。', region: '全球', lang: '英文' },
  { name: 'Vercel', url: 'https://vercel.com', category: 'devtools', desc: '前端云部署平台，对 Next.js 框架的预览与托管支持完善。', region: '欧美', lang: '英文' },
  { name: 'DigitalOcean', url: 'https://www.digitalocean.com', category: 'devtools', desc: '面向开发者的云服务器厂商，VPS 与托管数据库易于上手。', region: '欧美', lang: '英文' },
  { name: 'Namecheap', url: 'https://www.namecheap.com', category: 'devtools', desc: '域名注册与 DNS 托管服务商，价格透明且支持多币种支付。', region: '全球', lang: '英文' },
  { name: 'CSDN', url: 'https://www.csdn.net', category: 'devtools', desc: '中国头部开发者社区，博客、问答与下载资源规模庞大。', region: '中国', lang: '中文' },
  { name: '掘金', url: 'https://juejin.cn', category: 'devtools', desc: '字节跳动运营的前端技术社区，文章质量与讨论氛围较好。', region: '中国', lang: '中文' },
  { name: 'V2EX', url: 'https://www.v2ex.com', category: 'devtools', desc: '中文创意工作者社区，技术和职场话题讨论质量较高。', region: '中国', lang: '中文' },
  { name: '阿里云', url: 'https://www.aliyun.com', category: 'devtools', desc: '中国头部云计算服务商，提供服务器、存储与人工智能服务。', region: '中国', lang: '中文' },
  { name: '腾讯云', url: 'https://cloud.tencent.com', category: 'devtools', desc: '腾讯旗下云服务品牌，覆盖计算、数据库、CDN 与安全产品。', region: '中国', lang: '中文' },
  { name: 'Qiita', url: 'https://qiita.com', category: 'devtools', desc: '日本程序员技术分享社区，文章以实战经验与代码示例为主。', region: '日本', lang: '日文' },
  { name: 'Zenn', url: 'https://zenn.dev', category: 'devtools', desc: '日本工程师技术写作平台，支持 Markdown 与互动评论。', region: '日本', lang: '日文' },
  { name: 'velog', url: 'https://velog.io', category: 'devtools', desc: '韩国开发者写作与知识分享社区，界面简洁使用门槛低。', region: '韩国', lang: '韩文' },

  // ── 电商与购物 ──
  { name: 'Amazon', url: 'https://www.amazon.com', category: 'shopping', desc: '全球最大综合电商平台，Prime 会员与第三方卖家生态完善。', region: '全球', lang: '多语言' },
  { name: 'eBay', url: 'https://www.ebay.com', category: 'shopping', desc: '历史最悠久的 C2C 在线拍卖平台，二手与收藏品类突出。', region: '全球', lang: '英文' },
  { name: 'Walmart', url: 'https://www.walmart.com', category: 'shopping', desc: '美国零售巨头官网，提供线上下单、门店自提及第三方卖家服务。', region: '欧美', lang: '英文' },
  { name: 'Etsy', url: 'https://www.etsy.com', category: 'shopping', desc: '手工艺品与独立设计商品交易平台，卖家以小众创作者为主。', region: '欧美', lang: '英文' },
  { name: 'AliExpress', url: 'https://www.aliexpress.com', category: 'shopping', desc: '阿里旗下跨境电商平台，以低价小批量商品与全球直邮见长。', region: '全球', lang: '多语言' },
  { name: '1688', url: 'https://www.1688.com', category: 'shopping', desc: '阿里国内批发平台，工厂直供货源覆盖全品类制造行业。', region: '中国', lang: '中文' },
  { name: '淘宝', url: 'https://www.taobao.com', category: 'shopping', desc: '中国最大 C2C 电商平台，店小铺与直播带货生态成熟。', region: '中国', lang: '中文' },
  { name: '京东', url: 'https://www.jd.com', category: 'shopping', desc: '中国自营零售电商，3C 家电与自营物流配送是核心优势。', region: '中国', lang: '中文' },
  { name: 'Temu', url: 'https://www.temu.com', category: 'shopping', desc: '拼多多旗下跨境电商平台，以极致低价与全托管模式扩张。', region: '全球', lang: '多语言' },
  { name: 'SHEIN', url: 'https://www.shein.com', category: 'shopping', desc: '跨境快时尚电商品牌网站，上新速度快且主打高性价比服饰。', region: '全球', lang: '多语言' },
  { name: '楽天市場', url: 'https://www.rakuten.co.jp', category: 'shopping', desc: '日本大型综合电商，积分体系与本地生活服务深度结合。', region: '日本', lang: '日文' },
  { name: 'Mercari', url: 'https://jp.mercari.com', category: 'shopping', desc: '日本规模最大的个人闲置交易平台，个人买卖流转极为活跃。', region: '日本', lang: '日文' },
  { name: 'ZOZOTOWN', url: 'https://zozo.jp', category: 'shopping', desc: '日本时尚电商网站，服饰尺码齐全并支持多品牌集合购买。', region: '日本', lang: '日文' },
  { name: 'UNIQLO', url: 'https://www.uniqlo.com', category: 'shopping', desc: '优衣库官方电商渠道，基础款服饰与联名系列销售稳定。', region: '日本', lang: '多语言' },
  { name: 'Coupang', url: 'https://www.coupang.com', category: 'shopping', desc: '韩国最大电商平台，火箭配送履约体验构筑核心竞争壁垒。', region: '韩国', lang: '韩文' },
  { name: 'Gmarket', url: 'https://www.gmarket.co.kr', category: 'shopping', desc: '韩国老牌综合购物门户，海外买家入驻门槛相对友好。', region: '韩国', lang: '韩文' },
  { name: '11번가', url: 'https://www.11st.co.kr', category: 'shopping', desc: '韩国本土老牌综合商城，商品品类齐全并常有大促活动。', region: '韩国', lang: '韩文' },
  { name: 'SSG.com', url: 'https://www.ssg.com', category: 'shopping', desc: '新世界集团旗下高端百货电商，主打精品与进口商品。', region: '韩国', lang: '韩文' },
  { name: 'Tokopedia', url: 'https://www.tokopedia.com', category: 'shopping', desc: '印尼本土最大电商平台，本地商户与小卖家生态极为密集。', region: '东南亚', lang: '多语言' },
  { name: 'Shopee', url: 'https://www.shopee.com', category: 'shopping', desc: '东南亚市占率最高的电商平台，覆盖六国并延伸至拉美市场。', region: '东南亚', lang: '多语言' },
  { name: 'Lazada', url: 'https://www.lazada.com', category: 'shopping', desc: '阿里旗下东南亚电商，侧重品牌化与中高客单价商品销售。', region: '东南亚', lang: '多语言' },
  { name: 'Bukalapak', url: 'https://www.bukalapak.com', category: 'shopping', desc: '印尼本土上市电商，早期主打下沉市场与本地小店数字化。', region: '东南亚', lang: '多语言' },
  { name: 'Blibli', url: 'https://www.blibli.com', category: 'shopping', desc: '印尼中高端定位电商平台，强调品牌正品与品质购物体验。', region: '东南亚', lang: '多语言' },
  { name: 'Carousell', url: 'https://www.carousell.com', category: 'shopping', desc: '起于新加坡的 C2C 二手闲置平台，覆盖东南亚与台湾等市场。', region: '东南亚', lang: '英文' },

  // ── 本地生活与黄页 ──
  { name: 'Yelp', url: 'https://www.yelp.com', category: 'local-life', desc: '美国本地商户点评与黄页网站，餐厅酒吧评价覆盖密度极高。', region: '欧美', lang: '英文' },
  { name: '大众点评', url: 'https://www.dianping.com', category: 'local-life', desc: '中国本地生活服务平台，餐饮到店消费与优惠团购用户众多。', region: '中国', lang: '中文' },
  { name: '美团', url: 'https://www.meituan.com', category: 'local-life', desc: '中国头部本地生活平台，餐饮外卖、酒店住宿与到店业务齐全。', region: '中国', lang: '中文' },
  { name: '百度地图', url: 'https://map.baidu.com', category: 'local-life', desc: '中国地图与 POI 查询平台，覆盖商户检索、导航与街景服务。', region: '中国', lang: '中文' },
  { name: '高德地图', url: 'https://www.amap.com', category: 'local-life', desc: '国内领先的地图导航与位置服务网站，实时路况数据精确。', region: '中国', lang: '中文' },
  { name: '腾讯地图', url: 'https://map.qq.com', category: 'local-life', desc: '腾讯旗下地图服务，覆盖导航、地点检索与街景影像功能。', region: '中国', lang: '中文' },
  { name: 'Google Maps', url: 'https://maps.google.com', category: 'local-life', desc: '全球通用地图导航服务，商户信息与街景覆盖最广。', region: '全球', lang: '多语言' },
  { name: 'Tripadvisor', url: 'https://www.tripadvisor.com', category: 'local-life', desc: '全球旅行点评平台，酒店餐厅评价与景点排行参考价值高。', region: '全球', lang: '多语言' },
  { name: 'Yellow Pages', url: 'https://www.yellowpages.com', category: 'local-life', desc: '美国经典电话黄页网站，按行业分类检索本地服务商信息。', region: '欧美', lang: '英文' },
  { name: 'OpenTable', url: 'https://www.opentable.com', category: 'local-life', desc: '全球餐厅在线订位平台，欧美高端餐厅预订覆盖率突出。', region: '欧美', lang: '英文' },
  { name: '食べログ', url: 'https://tabelog.com', category: 'local-life', desc: '日本最大餐厅点评与检索网站，靠用户评价形成高可信排名。', region: '日本', lang: '日文' },
  { name: 'ぐるなび', url: 'https://www.gnavi.co.jp', category: 'local-life', desc: '日本美食餐馆信息检索平台，店铺资料详尽并提供订位服务。', region: '日本', lang: '多语言' },
  { name: 'ホットペッパーグルメ', url: 'https://www.hotpepper.jp', category: 'local-life', desc: 'Recruit 旗下日本餐厅点评与优惠券平台，折扣券使用便捷。', region: '日本', lang: '日文' },
  { name: 'SUUMO', url: 'https://suumo.jp', category: 'local-life', desc: 'Recruit 集团旗下日本最大房产信息平台，租房买房房源齐全。', region: '日本', lang: '日文' },
  { name: "LIFULL HOME'S", url: 'https://www.homes.co.jp', category: 'local-life', desc: '日本知名房产中介信息平台，房源细节与周边数据十分详尽。', region: '日本', lang: '日文' },
  { name: 'at home', url: 'https://www.athome.co.jp', category: 'local-life', desc: '日本老牌房产平台，地方城市与独家中介房源占比更高。', region: '日本', lang: '日文' },
  { name: '식신', url: 'https://www.siksinhot.com', category: 'local-life', desc: '韩国美食点评与餐厅预约平台，提供优惠券等本地化权益。', region: '韩国', lang: '韩文' },
  { name: '다이닝코드', url: 'https://www.diningcode.com', category: 'local-life', desc: '韩国餐厅推荐平台，通过大数据过滤广告评价并客观排序。', region: '韩国', lang: '韩文' },
  { name: '망고플레이트', url: 'https://www.mangoplate.com', category: 'local-life', desc: '韩国本土美食社区，用户评价与照片质量高且本地化明显。', region: '韩国', lang: '韩文' },
  { name: '직방', url: 'https://www.zigbang.com', category: 'local-life', desc: '韩国领先房产中介平台，租房房源覆盖广并配套找房工具。', region: '韩国', lang: '韩文' },
  { name: '다방', url: 'https://www.dabangapp.com', category: 'local-life', desc: '韩国互联网房产中介，支持在线签约与多种租房保障方案。', region: '韩国', lang: '韩文' },
  { name: 'iProperty', url: 'https://www.iproperty.com', category: 'local-life', desc: '东南亚主流房产门户，覆盖马来西亚、泰国等市场的租房买房。', region: '东南亚', lang: '英文' },
  { name: 'Zomato', url: 'https://www.zomato.com', category: 'local-life', desc: '源自印度的餐厅发现与点评平台，已拓展至全球多个城市。', region: '其他', lang: '英文' },

  // ── 招聘与求职 ──
  { name: 'LinkedIn', url: 'https://www.linkedin.com', category: 'jobs', desc: '全球最大职业社交平台，兼具人脉经营与招聘求职双重功能。', region: '全球', lang: '多语言' },
  { name: 'Indeed', url: 'https://www.indeed.com', category: 'jobs', desc: '全球访问量领先的招聘搜索平台，聚合各渠道职位并支持匿名投递。', region: '全球', lang: '多语言' },
  { name: 'Glassdoor', url: 'https://www.glassdoor.com', category: 'jobs', desc: '职位信息与雇主口碑社区，面试题与薪酬数据是核心特色。', region: '欧美', lang: '英文' },
  { name: 'BOSS直聘', url: 'https://www.zhipin.com', category: 'jobs', desc: '中国头部在线招聘平台，主打直接沟通与岗位实时推荐。', region: '中国', lang: '中文' },
  { name: '拉勾招聘', url: 'https://www.lagou.com', category: 'jobs', desc: '中国互联网行业垂直招聘平台，职位集中于技术与产品岗。', region: '中国', lang: '中文' },
  { name: '智联招聘', url: 'https://www.zhaopin.com', category: 'jobs', desc: '中国综合招聘服务平台，国企央企与传统行业岗位覆盖充分。', region: '中国', lang: '中文' },
  { name: '前程无忧', url: 'https://www.51job.com', category: 'jobs', desc: '中国老牌招聘网站，外资与制造业企业招聘需求较为集中。', region: '中国', lang: '中文' },
  { name: '猎聘', url: 'https://www.liepin.com', category: 'jobs', desc: '中国中高端人才招聘平台，猎头顾问与金融职位服务较突出。', region: '中国', lang: '中文' },
  { name: 'リクナビ', url: 'https://job.rikunabi.com', category: 'jobs', desc: '日本最大规模的综合招聘平台，新卒与社会人求职首选入口。', region: '日本', lang: '日文' },
  { name: 'マイナビ', url: 'https://www.mynavi.jp', category: 'jobs', desc: '日本大型招聘媒体集团，职场与就活服务覆盖年轻用户群体。', region: '日本', lang: '日文' },
  { name: 'doda', url: 'https://doda.jp', category: 'jobs', desc: '日本主要跳槽服务平台，转职攻略与职业辅导内容丰富。', region: '日本', lang: '日文' },
  { name: 'タウンワーク', url: 'https://townwork.net', category: 'jobs', desc: '日本覆盖全国的兼职与派遣招聘信息平台，岗位更新极为频繁。', region: '日本', lang: '日文' },
  { name: 'バイトル', url: 'https://www.baitoru.com', category: 'jobs', desc: '日本学生与年轻人兼职招聘平台，时薪标签与视频展示直观。', region: '日本', lang: '日文' },
  { name: 'Wantedly', url: 'https://www.wantedly.com', category: 'jobs', desc: '日本互联网创业公司招聘平台，重视文化匹配与员工自荐。', region: '日本', lang: '日文' },
  { name: 'ハローワーク', url: 'https://www.hellowork.go.jp', category: 'jobs', desc: '日本厚生劳动省公共职业安定所官网，提供免费就业与培训信息。', region: '日本', lang: '日文' },
  { name: '잡코리아', url: 'https://www.jobkorea.co.kr', category: 'jobs', desc: '韩国最大招聘平台，企业点评与求职社区内容形成闭环。', region: '韩国', lang: '韩文' },
  { name: '사람인', url: 'https://www.saramin.co.kr', category: 'jobs', desc: '韩国综合招聘网站，职位数量庞大并提供职场咨询与测评。', region: '韩国', lang: '韩文' },
  { name: '원티드', url: 'https://www.wanted.co.kr', category: 'jobs', desc: '韩国互联网与初创企业招聘平台，岗位时效性与文化推荐突出。', region: '韩国', lang: '韩文' },
  { name: '캐치', url: 'https://www.catch.co.kr', category: 'jobs', desc: '韩国职场社区与招聘平台，通过匿名社区吸引大量年轻用户。', region: '韩国', lang: '韩文' },
  { name: 'JobStreet', url: 'https://www.jobstreet.com', category: 'jobs', desc: '东南亚主流招聘网站，覆盖马来西亚、越南与菲律宾市场。', region: '东南亚', lang: '英文' },

  // ── 金融与证券 ──
  { name: 'Bloomberg', url: 'https://www.bloomberg.com', category: 'finance', desc: '全球顶级财经媒体与数据终端，行情终端和深度报道壁垒高。', region: '全球', lang: '英文' },
  { name: 'CNBC', url: 'https://www.cnbc.com', category: 'finance', desc: '美国财经电视网媒体，提供实时行情与市场解读短视频内容。', region: '欧美', lang: '英文' },
  { name: 'Yahoo! Finance', url: 'https://finance.yahoo.com', category: 'finance', desc: '雅虎旗下财经门户，提供行情报价、财报数据与市场资讯。', region: '全球', lang: '英文' },
  { name: 'Investing.com', url: 'https://www.investing.com', category: 'finance', desc: '全球多资产行情分析平台，外汇、加密与股票数据覆盖广。', region: '全球', lang: '多语言' },
  { name: 'TradingView', url: 'https://www.tradingview.com', category: 'finance', desc: '专业图表与社交交易平台，技术分析工具在零售端极受欢迎。', region: '全球', lang: '多语言' },
  { name: 'Coinbase', url: 'https://www.coinbase.com', category: 'finance', desc: '美国合规数字资产交易平台，机构托管业务占据重要份额。', region: '欧美', lang: '英文' },
  { name: 'Binance', url: 'https://www.binance.com', category: 'finance', desc: '全球交易量最大的加密货币交易所，覆盖现货与衍生品交易。', region: '全球', lang: '多语言' },
  { name: '东方财富网', url: 'https://www.eastmoney.com', category: 'finance', desc: '中国主流财经门户，行情数据、基金与社区讨论覆盖完整。', region: '中国', lang: '中文' },
  { name: '同花顺', url: 'https://www.10jqka.com.cn', category: 'finance', desc: '中国证券行情软件与财经门户，移动端用户数量庞大。', region: '中国', lang: '中文' },
  { name: '雪球', url: 'https://xueqiu.com', category: 'finance', desc: '中文投资社区平台，用户讨论与组合策略分享氛围浓厚。', region: '中国', lang: '中文' },
  { name: '新浪财经', url: 'https://finance.sina.com.cn', category: 'finance', desc: '新浪旗下财经频道，实时行情与上市公司报道更新及时。', region: '中国', lang: '中文' },
  { name: 'KABUTAN', url: 'https://kabutan.jp', category: 'finance', desc: '日本股票行情与个股分析网站，自选股检索使用体验成熟。', region: '日本', lang: '日文' },
  { name: '네이버 금융', url: 'https://finance.naver.com', category: 'finance', desc: 'Naver 旗下韩语财经门户，提供实时行情与上市公司资料查询。', region: '韩国', lang: '韩文' },
  { name: '한국투자증권', url: 'https://www.koreainvestment.com', category: 'finance', desc: '韩国大型综合证券公司官网，提供开户、行情与研究报告服务。', region: '韩国', lang: '韩文' },
  { name: '삼성증권', url: 'https://www.samsungsecurities.com', category: 'finance', desc: '三星集团旗下韩国头部券商，移动交易应用使用体验成熟。', region: '韩国', lang: '韩文' },
  { name: '미래에셋증권', url: 'https://www.miraeasset.com', category: 'finance', desc: '韩国代表性综合券商，全球业务与海外市场产品线较完整。', region: '韩国', lang: '韩文' },
  { name: 'eBEST투자증권', url: 'https://www.ebestinvest.co.kr', category: 'finance', desc: '韩国互联网券商，以移动交易与投资社区服务见长。', region: '韩国', lang: '韩文' },

  // ── 旅游与出行 ──
  { name: 'Booking.com', url: 'https://www.booking.com', category: 'travel', desc: '全球最大住宿预订平台，酒店与公寓房源数量覆盖极广。', region: '全球', lang: '多语言' },
  { name: 'Expedia', url: 'https://www.expedia.com', category: 'travel', desc: '美国大型在线旅游代理，机酒打包套餐与积分体系成熟。', region: '全球', lang: '多语言' },
  { name: 'Airbnb', url: 'https://www.airbnb.com', category: 'travel', desc: '全球短租民宿共享平台，房东房源与体验类预订规模庞大。', region: '全球', lang: '多语言' },
  { name: 'Trip.com', url: 'https://www.trip.com', category: 'travel', desc: '携程集团国际版在线旅行社，全球机票酒店可直接预订。', region: '全球', lang: '多语言' },
  { name: '携程', url: 'https://www.ctrip.com', category: 'travel', desc: '中国头部在线旅游平台，机票酒店火车票预订与攻略一体化。', region: '中国', lang: '中文' },
  { name: '去哪儿', url: 'https://www.qunar.com', category: 'travel', desc: '中国比价型旅游搜索平台，机票与酒店价格聚合能力突出。', region: '中国', lang: '中文' },
  { name: '同程旅行', url: 'https://www.ly.com', category: 'travel', desc: '中国在线旅游平台，票务预订与下沉市场用户覆盖较好。', region: '中国', lang: '中文' },
  { name: '马蜂窝', url: 'https://www.mafengwo.cn', category: 'travel', desc: '中文旅行内容社区，景点攻略与用户游记内容极为丰富。', region: '中国', lang: '中文' },
  { name: '穷游网', url: 'https://www.qyer.com', category: 'travel', desc: '中文出境游社区与交易平台，境外自由行内容积累深厚。', region: '中国', lang: '中文' },
  { name: 'Skyscanner', url: 'https://www.skyscanner.net', category: 'travel', desc: '全球机票元搜索平台，可跨航司比价并追踪价格变动。', region: '全球', lang: '多语言' },
  { name: 'Agoda', url: 'https://www.agoda.com', category: 'travel', desc: '东南亚起家的酒店预订平台，在泰国越南等市场占有率极高。', region: '东南亚', lang: '多语言' },
  { name: 'Klook', url: 'https://www.klook.com', category: 'travel', desc: '亚洲目的地玩乐预订平台，门票与一日游等本地体验齐全。', region: '东南亚', lang: '多语言' },
  { name: 'KKday', url: 'https://www.kkday.com', category: 'travel', desc: '亚洲旅游体验预订平台，交通票券与特色活动选择丰富。', region: '东南亚', lang: '多语言' },
  { name: 'Traveloka', url: 'https://www.traveloka.com', category: 'travel', desc: '东南亚本土超级旅游平台，酒店交通与景点门票统一预订。', region: '东南亚', lang: '多语言' },
  { name: 'じゃらん観光', url: 'https://www.jalan.net', category: 'travel', desc: 'Recruit 旗下日本旅游与酒店预订平台，住宿信息收录详尽。', region: '日本', lang: '日文' },
  { name: '楽天トラベル', url: 'https://travel.rakuten.co.jp', category: 'travel', desc: '乐天旗下日本旅行预订网站，积分与酒店套餐方案丰富。', region: '日本', lang: '日文' },
  { name: 'NAVITIME', url: 'https://www.navitime.co.jp', category: 'travel', desc: '日本综合路线规划平台，铁路换乘与旅游行程一体化设计。', region: '日本', lang: '日文' },
  { name: 'Japan Guide', url: 'https://www.japan-guide.com', category: 'travel', desc: '英文权威日本旅游指南网站，签证交通与景点实用信息丰富。', region: '日本', lang: '英文' },
  { name: '야놀자', url: 'https://www.yanolja.com', category: 'travel', desc: '韩国本土主流 OTA，酒店预订与门票餐饮套餐均有覆盖。', region: '韩国', lang: '韩文' },
  { name: 'Amazing Thailand', url: 'https://www.amazingthailand.com', category: 'travel', desc: '泰国旅游局官方网站，景点攻略与签证信息权威发布。', region: '东南亚', lang: '英文' },
  { name: 'Visit Korea', url: 'https://english.visitkorea.or.kr', category: 'travel', desc: '韩国观光公社英文官网，提供旅游线路与文化活动资讯。', region: '韩国', lang: '英文' },

  // ── 设计与效率工具 ──
  { name: 'Canva', url: 'https://www.canva.com', category: 'tools', desc: '全球化在线设计工具，模板生态与协作功能让非专业创作者上手。', region: '全球', lang: '多语言' },
  { name: 'Figma', url: 'https://www.figma.com', category: 'tools', desc: '浏览器端界面设计协作工具，UI 设计行业团队使用率极高。', region: '全球', lang: '英文' },
  { name: 'Dribbble', url: 'https://dribbble.com', category: 'tools', desc: '设计师作品集分享社区，接单平台与创作趋势参考价值高。', region: '欧美', lang: '英文' },
  { name: 'Behance', url: 'https://www.behance.net', category: 'tools', desc: 'Adobe 旗下创意作品展示平台，视觉设计与品牌案例质量较高。', region: '全球', lang: '多语言' },
  { name: 'Unsplash', url: 'https://unsplash.com', category: 'tools', desc: '免费高清图片素材库，摄影师免费发布且商用授权宽松。', region: '全球', lang: '英文' },
  { name: 'Pexels', url: 'https://www.pexels.com', category: 'tools', desc: '免费图片与视频素材平台，内容数量庞大且无需注册可用。', region: '全球', lang: '多语言' },
  { name: 'Pixabay', url: 'https://pixabay.com', category: 'tools', desc: '免费图片音乐与视频素材站，剪贴画与音效资源收录丰富。', region: '全球', lang: '多语言' },
  { name: 'Freepik', url: 'https://www.freepik.com', category: 'tools', desc: '矢量图库与设计资源站，插画模板与照片素材订阅制供应。', region: '欧美', lang: '英文' },
  { name: '站酷', url: 'https://www.zcool.com.cn', category: 'tools', desc: '中国设计师社区平台，作品展示、招聘与创意营销业务齐全。', region: '中国', lang: '中文' },
  { name: '花瓣网', url: 'https://huaban.com', category: 'tools', desc: '中文视觉灵感收藏平台，瀑布流图片发现体验贴近移动端。', region: '中国', lang: '中文' },
  { name: '稿定设计', url: 'https://www.gaoding.com', category: 'tools', desc: '中国在线设计工具站，提供海报、电商与短视频模板素材。', region: '中国', lang: '中文' },
  { name: 'Notion', url: 'https://www.notion.so', category: 'tools', desc: '模块化笔记与知识管理工具，文档数据库一体化协作广泛使用。', region: '全球', lang: '多语言' },
  { name: 'Trello', url: 'https://trello.com', category: 'tools', desc: '看板式任务管理工具，项目进度可视化适合中小团队协作。', region: '全球', lang: '多语言' },
  { name: 'Slack', url: 'https://slack.com', category: 'tools', desc: '企业级即时通讯协作平台，频道式沟通与第三方应用集成完善。', region: '全球', lang: '多语言' },
  { name: 'Zoom', url: 'https://zoom.us', category: 'tools', desc: '主流在线视频会议工具，远程办公与线上教学场景广泛使用。', region: '全球', lang: '多语言' },
  { name: 'WeTransfer', url: 'https://wetransfer.com', category: 'tools', desc: '大文件在线传输与云存储服务，无需注册即可发送共享链接。', region: '欧美', lang: '多语言' },
  { name: 'TinyPNG', url: 'https://tinypng.com', category: 'tools', desc: '经典图片无损压缩工具，显著降低网页与邮件附件体积。', region: '全球', lang: '英文' },
  { name: 'remove.bg', url: 'https://www.remove.bg', category: 'tools', desc: 'AI 自动抠图工具，一键分离人物主体并生成透明背景图。', region: '全球', lang: '多语言' },
  { name: 'Google Workspace', url: 'https://workspace.google.com', category: 'tools', desc: '谷歌企业办公套件，包含邮箱、文档、云盘与视频会议。', region: '全球', lang: '多语言' },

  // ── 教育与学习 ──
  { name: 'Coursera', url: 'https://www.coursera.org', category: 'education', desc: '全球最大在线学习平台，与顶尖大学合作提供学分课程与证书。', region: '全球', lang: '多语言' },
  { name: 'edX', url: 'https://www.edx.org', category: 'education', desc: '哈佛与微软联合创办的公开课平台，学位课程与专业证书齐全。', region: '全球', lang: '英文' },
  { name: 'Udemy', url: 'https://www.udemy.com', category: 'education', desc: '以职业技能实战为核心的在线课程市场，编程与设计类目丰富。', region: '全球', lang: '多语言' },
  { name: 'Khan Academy', url: 'https://www.khanacademy.org', category: 'education', desc: '非营利免费教育资源平台，涵盖数理化与基础学科视频课程。', region: '全球', lang: '多语言' },
  { name: 'Codecademy', url: 'https://www.codecademy.com', category: 'education', desc: '编程入门互动学习平台，通过浏览器直接运行代码练习。', region: '全球', lang: '英文' },
  { name: 'Duolingo', url: 'https://www.duolingo.com', category: 'education', desc: '游戏化语言学习平台，多语种课程免费且社群互动性强。', region: '全球', lang: '多语言' },
  { name: 'Quizlet', url: 'https://quizlet.com', category: 'education', desc: '学习卡片与记忆卡片工具，学科术语与备考资料整理方便。', region: '全球', lang: '多语言' },
  { name: 'Quora', url: 'https://www.quora.com', category: 'education', desc: '英文知识问答社区，由各领域从业者长期输出专业回答。', region: '全球', lang: '英文' },
  { name: 'Brainly', url: 'https://brainly.com', category: 'education', desc: '学生作业求助平台，提供多语言解答与学习社区讨论。', region: '全球', lang: '多语言' },
  { name: 'Chegg', url: 'https://www.chegg.com', category: 'education', desc: '作业辅导与教材答案订阅平台，参考解答库覆盖高校课程。', region: '欧美', lang: '英文' },
  { name: '中国大学MOOC', url: 'https://www.icourse163.org', category: 'education', desc: '网易与高校共建的中文慕课平台，学位课程免费旁听。', region: '中国', lang: '中文' },
  { name: '学堂在线', url: 'https://www.xuetangx.com', category: 'education', desc: '清华大学发起的中文慕课平台，课程数量与学科覆盖广泛。', region: '中国', lang: '中文' },
  { name: '网易公开课', url: 'https://open.163.com', category: 'education', desc: '网易旗下公开课平台，社会与人文类讲座课程资源丰富。', region: '中国', lang: '中文' },
  { name: '新东方', url: 'https://www.xdf.cn', category: 'education', desc: '中国头部教育培训品牌，涵盖出国考试与职业技能辅导课程。', region: '中国', lang: '中文' },
  { name: '得到', url: 'https://www.dedao.cn', category: 'education', desc: '中文知识付费学习平台，音频课程与电子出版内容并重。', region: '中国', lang: '中文' },
  { name: 'manabi', url: 'https://manabi.jp', category: 'education', desc: '日本语言学习与商务英语在线课程平台，按水平分级授课。', region: '日本', lang: '日文' },

  // ── 健康与生活方式 ──
  { name: 'Healthline', url: 'https://www.healthline.com', category: 'lifestyle', desc: '美国健康资讯平台，医学科普内容与医疗资源索引权威可信。', region: '欧美', lang: '英文' },
  { name: 'Mayo Clinic', url: 'https://www.mayoclinic.org', category: 'lifestyle', desc: '美国顶级医疗机构官网，提供疾病科普与临床研究资料。', region: '欧美', lang: '英文' },
  { name: 'WebMD', url: 'https://www.webmd.com', category: 'lifestyle', desc: '美国医疗健康资讯平台，疾病百科与在线问诊服务较完善。', region: '欧美', lang: '英文' },
  { name: '丁香园', url: 'https://www.dxy.cn', category: 'lifestyle', desc: '中文医疗专业社区，医生讨论与临床知识检索门槛较高。', region: '中国', lang: '中文' },
  { name: '39健康网', url: 'https://www.39.net', category: 'lifestyle', desc: '中文综合健康资讯平台，疾病库与用药指南覆盖全面。', region: '中国', lang: '中文' },
  { name: 'Keep', url: 'https://www.gotokeep.com', category: 'lifestyle', desc: '中国运动健身与课程学习应用，训练计划与内容社区兼具。', region: '中国', lang: '中文' },
  { name: '日経Health', url: 'https://www.nikkeihp.co.jp', category: 'lifestyle', desc: '日经旗下健康媒体，医学知识与营养运动管理信息垂直。', region: '日本', lang: '日文' },
  { name: 'Lifehacker', url: 'https://lifehacker.com', category: 'lifestyle', desc: '生活技巧媒体网站，效率提升与消费决策类文章产出稳定。', region: '欧美', lang: '英文' },
  { name: '少数派', url: 'https://sspai.com', category: 'lifestyle', desc: '中文数字生活方式媒体，效率工具与方法论内容见长。', region: '中国', lang: '中文' },
  { name: '什么值得买', url: 'https://www.smzdm.com', category: 'lifestyle', desc: '中文优惠导购社区，海量优惠信息与真实用户晒单集中。', region: '中国', lang: '中文' },
  { name: '価格.com', url: 'https://kakaku.com', category: 'lifestyle', desc: '日本大型商品比价网站，数码家电价格数据被广泛参考。', region: '日本', lang: '日文' },
  { name: 'Vice', url: 'https://www.vice.com', category: 'lifestyle', desc: '青年文化类媒体，关注亚文化、边缘议题与生活方式报道。', region: '欧美', lang: '英文' },
  { name: 'BuzzFeed', url: 'https://www.buzzfeed.com', category: 'lifestyle', desc: '以轻量化网络内容起家的媒体，趣味清单与生活资讯传播广。', region: '欧美', lang: '英文' },
  { name: 'Vogue', url: 'https://www.vogue.com', category: 'lifestyle', desc: '全球最具影响力的时尚杂志官网，秀场与美妆潮流前沿。', region: '欧美', lang: '英文' },
  { name: '香港01', url: 'https://www.hk01.com', category: 'lifestyle', desc: '中国香港数字媒体平台，新闻生活与财经深度内容更新迅速。', region: '中国', lang: '中文' },

  // ── 机械制造 ──
  { name: 'Caterpillar', url: 'https://www.cat.com', category: 'machinery', desc: '全球工程机械与矿山设备龙头，挖掘机装载机与柴油动力全系列覆盖。', region: '欧美', lang: '英文' },
  { name: '小松 Komatsu', url: 'https://www.komatsu.com', category: 'machinery', desc: '日本工程机械巨头，全球销量第二，智能施工与无人矿山技术领先。', region: '日本', lang: '英文' },
  { name: '约翰迪尔 John Deere', url: 'https://www.deere.com', category: 'machinery', desc: '全球最大农业机械制造商，拖拉机收割机与土方设备产品线庞大。', region: '欧美', lang: '英文' },
  { name: '利勃海尔 Liebherr', url: 'https://www.liebherr.com', category: 'machinery', desc: '德国家族重工，起重机挖掘机与混凝土机械领域的技术标杆。', region: '欧美', lang: '英文' },
  { name: '徐工集团 XCMG', url: 'https://www.xcmg.com', category: 'machinery', desc: '中国工程机械龙头，汽车起重机全球第一，装载机压路机全线布局。', region: '中国', lang: '中文' },
  { name: '三一重工 SANY', url: 'https://www.sany.com.cn', category: 'machinery', desc: '挖掘机销量中国第一，混凝土机械长臂架泵车全球市场占有率高。', region: '中国', lang: '中文' },
  { name: '中联重科 Zoomlion', url: 'https://www.zoomlion.com', category: 'machinery', desc: '起重机械与混凝土机械全球头部企业，农业机械与高空作业平台并进。', region: '中国', lang: '中文' },
  { name: '柳工 LiuGong', url: 'https://www.liugong.com', category: 'machinery', desc: '中国装载机销量领跑者，挖掘机叉车与矿卡销往一百七十多个国家。', region: '中国', lang: '英文' },
  { name: '潍柴动力 Weichai', url: 'https://www.weichaipower.com', category: 'machinery', desc: '中国大型柴油发动机龙头，重卡动力总成与液压农机业务体系完整。', region: '中国', lang: '中文' },
  { name: '中国中车 CRRC', url: 'https://www.crrcgc.cc', category: 'machinery', desc: '轨道交通装备全球第一，高铁动车组机车车辆核心制造商。', region: '中国', lang: '中文' },
  { name: '中集集团 CIMC', url: 'https://www.cimc.com', category: 'machinery', desc: '全球集装箱制造绝对龙头，道路运输车辆与海工装备业务领先。', region: '中国', lang: '多语言' },
  { name: '振华重工 ZPMC', url: 'https://www.zpmc.com', category: 'machinery', desc: '全球港口起重机市占率约七成，集装箱岸桥机械远销各大港口。', region: '中国', lang: '中文' },
  { name: '日立建机 Hitachi CM', url: 'https://www.hitachicm.com', category: 'machinery', desc: '日立旗下建机企业，液压挖掘机技术深厚，矿山设备全球畅销。', region: '日本', lang: '英文' },
  { name: '沃尔沃建筑设备 Volvo CE', url: 'https://www.volvoce.com', category: 'machinery', desc: '瑞典沃尔沃集团成员，轮式装载机与铰接式卡车全球领先。', region: '欧美', lang: '多语言' },
  { name: 'JCB', url: 'https://www.jcb.com', category: 'machinery', desc: '英国工程机械名企，挖掘装载机与伸缩臂叉装车全球知名。', region: '欧美', lang: '英文' },
  { name: '斗山 Doosan', url: 'https://www.doosan.com', category: 'machinery', desc: '韩国百年重工集团，旗下 DEVELON 建机与山猫紧凑设备全球运营。', region: '韩国', lang: '英文' },
  { name: '现代建设装备 Hyundai CE', url: 'https://www.hyundaiconstructionequipment.com', category: 'machinery', desc: '现代汽车集团旗下建机公司，挖掘机轮式装载机销往全球市场。', region: '韩国', lang: '英文' },
  { name: '博世 Bosch', url: 'https://www.bosch.com', category: 'machinery', desc: '全球最大技术与服务企业之一，电动工具与工业技术板块实力雄厚。', region: '欧美', lang: '多语言' },
  { name: '西门子 Siemens', url: 'https://www.siemens.com', category: 'machinery', desc: '德国工业巨头，工业自动化、数字化工厂与电气化领域全球领导者。', region: '欧美', lang: '多语言' },
  { name: 'ABB', url: 'https://www.abb.com', category: 'machinery', desc: '瑞士电气与自动化巨头，工业机器人与电力传动技术全球领先。', region: '欧美', lang: '多语言' },
  { name: '三菱重工 MHI', url: 'https://www.mhi.com', category: 'machinery', desc: '日本最大综合重工，能源船舶航空与产业机械业务全线覆盖。', region: '日本', lang: '英文' },
  { name: '发那科 FANUC', url: 'https://www.fanuc.com', category: 'machinery', desc: '全球最大数控系统与工业机器人厂商，机床自动化核心供应商。', region: '日本', lang: '多语言' },
  { name: '安川电机 Yaskawa', url: 'https://www.yaskawa.co.jp', category: 'machinery', desc: '日本伺服电机与机器人巨头，运动控制与变频器技术全球领先。', region: '日本', lang: '日文' },
  { name: '库卡 KUKA', url: 'https://www.kuka.com', category: 'machinery', desc: '机器人四大家族之一，现属美的集团，机器人与自动化方案知名。', region: '欧美', lang: '多语言' },
  { name: '山崎马扎克 Mazak', url: 'https://www.mazak.com', category: 'machinery', desc: '全球最大机床制造商之一，复合加工中心与 MAZATROL 系统著称。', region: '日本', lang: '英文' },
  { name: 'DMG MORI', url: 'https://www.dmgmori.com', category: 'machinery', desc: '德日联合的顶级机床企业，五轴加工中心与车铣复合全球标杆。', region: '欧美', lang: '多语言' },
  { name: '通快 TRUMPF', url: 'https://www.trumpf.com', category: 'machinery', desc: '德国激光与机床巨头，激光切割与钣金加工技术全球领先。', region: '欧美', lang: '多语言' },
  { name: '久保田 Kubota', url: 'https://www.kubota.com', category: 'machinery', desc: '日本农机与发动机巨头，小型挖掘机与水田作业机械全球畅销。', region: '日本', lang: '英文' },
  { name: '洋马 Yanmar', url: 'https://www.yanmar.com', category: 'machinery', desc: '日本发动机与农机企业，小型柴油机与建机设备紧凑可靠著称。', region: '日本', lang: '英文' },
  { name: '斯凯孚 SKF', url: 'https://www.skf.com', category: 'machinery', desc: '全球最大轴承制造商，密封润滑系统与状态监测技术领导者。', region: '欧美', lang: '多语言' },
  { name: '舍弗勒 Schaeffler', url: 'https://www.schaeffler.com', category: 'machinery', desc: '德国轴承巨头，INA、FAG 与 LuK 品牌覆盖工业与汽车领域。', region: '欧美', lang: '多语言' },
  { name: '阿特拉斯·科普柯 Atlas Copco', url: 'https://www.atlascopco.com', category: 'machinery', desc: '瑞典工业集团，空压机与矿山凿岩设备市场份额全球第一。', region: '欧美', lang: '多语言' }
];

/** 为每个站点补齐派生字段：稳定唯一 ID、域名、favicon、品牌色 */
const usedIds = new Set();
window.SITE_DATA.forEach((site, i) => {
  // slug + 序号：避免 "360搜索"/"360导航"、"Daum"/"Daum 사전" 这类名称归一化后的碰撞
  let slug = site.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || !/^[a-z]/.test(slug)) slug = 's' + (slug || 'site');
  let id = slug + '-' + i;
  while (usedIds.has(id)) id = slug + '-' + i + '-' + (usedIds.size);
  usedIds.add(id);
  site.id = id;
  // 知名度基准排名：数组内顺序即调研时的知名度顺序，热度排序以此为基准
  site.rank = i;
  try {
    const u = new URL(site.url);
    site.domain = u.hostname.replace(/^www\./, '');
    site.favicon = 'https://www.google.com/s2/favicons?domain=' + site.domain + '&sz=128';
  } catch (e) {
    site.domain = site.url;
    site.favicon = '';
  }
  // 由域名稳定散列出品牌色（HSL → 柔和的 Apple 风配色）
  let h = 0;
  for (let k = 0; k < site.domain.length; k++) h = (h * 31 + site.domain.charCodeAt(k)) >>> 0;
  site.hue = h % 360;
  site.brand = 'hsl(' + site.hue + ', 62%, 62%)';
  site.brandSoft = 'hsl(' + site.hue + ', 68%, 96%)';
});