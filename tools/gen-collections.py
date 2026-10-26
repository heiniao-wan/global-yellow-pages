#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-collections.py — 主题合辑页生成器（编辑精选 + 静态 HTML）

合辑页是什么：围绕一个具体任务（出海做产品、做短视频、找工作……），
把 381 个站点里相关的十几个串成一条有叙事的动线，每站配一段
「为什么在这个合辑里」的编辑点评。与分类页的区别：分类页按行业切，
合辑页按任务切，且带原创导语与点评——这正是 AdSense 审核与 SEO
都吃的内容深度。

为什么静态 HTML：首页是 JS 渲染、爬虫看不见；分类页 cat/*.html 已
验证静态页能被正常收录。合辑页同理，构建期生成纯 HTML，零 JS 依赖。

产出：
  guides.html            合辑索引页（所有合辑的目录）
  guides/<slug>.html     每个合辑一页

数据：本文件内的 COLLECTIONS，按域名引用 data.js 的站点（域名即
hostname 去 www，与 app.js 的 site.domain 一致）；站点名/简介/分类
从 data.js 取，点评在这里写。

由 tools/gen-seo.py 在每次生成 SEO 基建时调用（幂等，可反复跑）。
"""

import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "assets", "js", "data.js")
GUIDES_DIR = os.path.join(ROOT, "guides")
BASE = "https://ypage.ccwu.cc"

# ══════════════════════════ 合辑内容（编辑精选） ══════════════════════════

COLLECTIONS = [
    {
        "slug": "indie-hacker",
        "title": "独立开发者出海工具箱",
        "kicker": "从写下第一行代码，到收到第一笔美元",
        "intro": "一个人做产品出海，中间隔着建站、开发、设计、文案、合规好几道坎。"
                 "这份合辑把这条动线上的关键站点串成一条线：代码放哪里、部署去哪里、"
                 "图片从哪来、文案怎么翻。每一个都有免费额度，零预算就能起步；"
                 "等产品开始赚钱，再考虑升级付费计划。顺序也基本是按开发流程排的——"
                 "照着走一遍，比零散收藏一堆教程管用。",
        "sections": [
            {"title": "写代码", "note": "代码放对地方，协作和版本管理才有地基",
             "items": [
                 {"d": "github.com", "why": "代码托管与开源协作的门票。独立开发者的技术信用攒在这里，Star 数就是硬通货，也是后续所有 CI 和部署的地基。"},
                 {"d": "cursor.com", "why": "AI 原生编辑器，一个人干一个前端团队的活。对独立开发者来说，省下的不只是时间，是请不起人的成本。"},
                 {"d": "copilot.github.com", "why": "补全与问答两用的编程副驾，和 GitHub 账户体系打通，私有仓库里也能用。"},
             ]},
            {"title": "部署与基础设施", "note": "前端上 Vercel，域名和 DNS 交给 Cloudflare，其余先租最便宜的 VPS",
             "items": [
                 {"d": "vercel.com", "why": "前端部署的事实标准，Git 推上去就自动构建上线，免费额度对早期项目完全够用。"},
                 {"d": "cloudflare.com", "why": "DNS、CDN、SSL 到 Workers 一条龙。出海产品的第一道门面就该挂在这里，抗打且免费档不含糊。"},
                 {"d": "namecheap.com", "why": "域名注册商里价格和口碑平衡得最好的一家，隐私保护默认送，续费不玩套路。"},
                 {"d": "digitalocean.com", "why": "VPS 起点：文档是全行业最好的，按月付、随时删。等流量起来了再迁也不迟。"},
                 {"d": "npmjs.com", "why": "前端生态的包仓库。找轮子先来这里，发布自己的包也是在这里完成第一次「上线」。"},
             ]},
            {"title": "设计与素材", "note": "不请设计师，也能让产品不像草台班子",
             "items": [
                 {"d": "figma.com", "why": "界面设计的事实标准，免费档够个人用。它的社区模板还能直接扒来做原型。"},
                 {"d": "canva.com", "why": "不会 PS 也能出图：落地页配图、社交媒体横幅、简单的图标排版，模板套一套就有模有样。"},
                 {"d": "pexels.com", "why": "免费可商用的图库视频，出海产品再也不用担心版权律师函。质量比大多数付费图库还高。"},
                 {"d": "unsplash.com", "why": "另一个免费图库，偏摄影质感。产品官网的 hero 背景图很多就出自这里。"},
             ]},
            {"title": "效率与文案", "note": "最后两公里：把东西写清楚，把资料管起来",
             "items": [
                 {"d": "notion.so", "why": "一个人的指挥部：需求文档、发布清单、用户反馈全塞进去。出海项目的「办公室」。"},
                 {"d": "deepl.com", "why": "产品文案英翻中的默认选项，也能反向用。做多语言落地页时，它的语气比机翻自然一个档。"},
             ]},
        ],
    },
    {
        "slug": "ai-content",
        "title": "AI 内容创作流水线",
        "kicker": "从选题脚本到成片发布，一条线走完",
        "intro": "做自媒体的都知道，瓶颈从来不是「不会剪」，是每条内容都要重新想选题、"
                 "写脚本、找素材、配音轨。这份合辑按创作顺序排：先用对话模型理出脚本，"
                 "再生成配图和视频，最后配音、剪辑、压时长。每个环节只挑一个主力工具——"
                 "工具堆得越多，流程越跑不起来。",
        "sections": [
            {"title": "脚本与选题", "note": "先把「说什么」想清楚，后面全是执行",
             "items": [
                 {"d": "chatgpt.com", "why": "选题 brainstorming 和脚本初稿的主力。给它一个人设和语气要求，产出直接能用。"},
                 {"d": "claude.ai", "why": "长文本之王。把参考资料整篇丢给它做摘要和结构，是脚本阶段最省力的一环。"},
                 {"d": "perplexity.ai", "why": "带引用的 AI 搜索。追热点时用它核实事实，答案后面挂着来源，不怕翻车。"},
             ]},
            {"title": "图片与版式", "note": "封面决定点击率，这一环值得花最多预算",
             "items": [
                 {"d": "midjourney.com", "why": "图像生成的审美天花板。做封面和氛围图，出图质感仍是第一梯队。"},
                 {"d": "seaart.ai", "why": "国产图像生成平台，模型库全、中文提示词友好，适合快速出中式风格的配图。"},
                 {"d": "photoroom.com", "why": "商品图和人物抠图的捷径，去背景、换场景都是一步，电商内容必备。"},
                 {"d": "gamma.app", "why": "把脚本直接变成演示文稿。做知识类视频的分镜，或者图文内容的版式，都快过手工排版。"},
             ]},
            {"title": "视频生成", "note": "不想露脸，也能日更视频",
             "items": [
                 {"d": "heygen.com", "why": "数字人视频的头牌。一段文案进去，一个不倦怠的主播出炉，口型还对得上。"},
                 {"d": "synthesia.io", "why": "企业级数字人方案，多语言配音和品牌模板更全，适合做系列课而非单条爆款。"},
                 {"d": "runwayml.com", "why": "视频生成与编辑的先锋，文生视频、图生视频、抹除杂物都在行，创意向的首选。"},
                 {"d": "capcut.com", "why": "剪映的国际版，自动字幕和模板库是日更的底气。最终成片八成在这完成。"},
                 {"d": "opus.pro", "why": "长视频改短片的专业户：自动找高光片段、裁成竖版、加字幕，一条长内容拆十条分发。"},
             ]},
            {"title": "配音与音乐", "note": "声音是第二张脸",
             "items": [
                 {"d": "elevenlabs.io", "why": "AI 配音里最像人的一个，语气和停顿自然，还能克隆自己的声音做多语言版本。"},
                 {"d": "suno.com", "why": "背景音乐生成。描述一下「轻快、科技感、无人声」，几十秒出几条可用的轨道。"},
             ]},
            {"title": "音频整理", "note": "播客和访谈内容的幕后工序",
             "items": [
                 {"d": "descript.com", "why": "把音频转成文字来剪：删字就是删音轨。做访谈和口播内容，效率是传统剪辑的数倍。"},
             ]},
        ],
    },
    {
        "slug": "mech-engineer",
        "title": "机械工程师每日工具箱",
        "kicker": "选型、样本、行业动态，一条检索动线",
        "intro": "机械工程师的日常，大半时间花在「找资料」上：这个轴承的额定载荷多少、"
                 "这家主机的液压系统什么参数、行业里又出了什么新机型。这份合辑按动线排："
                 "标准件先去品牌商官网拿一手样本，主机厂看产品线，数控与电气查技术平台，"
                 "最后用学术源追前沿。都是官网直链，没有二手资料站的转手误差。",
        "sections": [
            {"title": "轴承与传动", "note": "选型计算的数据源头，永远以厂商样本为准",
             "items": [
                 {"d": "skf.com", "why": "轴承行业的标准制定者之一。选型计算器、寿命理论和样本 PDF 都是行业教科书级别的存在。"},
                 {"d": "schaeffler.com", "why": "FAG/INA 的母公司，滚子轴承和直线传动样本查得最顺手，CAD 模型可直接下载。"},
             ]},
            {"title": "主机与工程机械", "note": "看产品线和技术参数，直接去制造商官网",
             "items": [
                 {"d": "cat.com", "why": "工程机械的全球标杆，产品线覆盖和工况应用资料最全，矿山和土方方案的参考源头。"},
                 {"d": "komatsu.com", "why": "小松官网，日系工程机械的技术文档以详细著称，液压和电控说明值得细读。"},
                 {"d": "deere.com", "why": "约翰迪尔，农机与工程机械双线。其动力总成和液压集成方案常被同业参考。"},
                 {"d": "xcmg.com", "why": "徐工，国产工程机械龙头。大吨位和新能源机型的产品动态以这里最快。"},
                 {"d": "sany.com.cn", "why": "三一重工，挖机和起重机产品线齐全，官网的工况视频比样本直观。"},
                 {"d": "zoomlion.com", "why": "中联重科，起重机与混凝土机械的国内主力，海外市场动态也更新及时。"},
             ]},
            {"title": "数控与机器人", "note": "自动化产线的核心装备",
             "items": [
                 {"d": "fanuc.com", "why": "数控系统的代名词。发那科官网的规格书和编程手册是产线集成的必备资料。"},
                 {"d": "kuka.com", "why": "库卡，机器人四大家族之一，汽车产线集成方案和负载参数查这里。"},
                 {"d": "mazak.com", "why": "山崎马扎克，复合加工机的强项，机床样本与选项配置表非常规范。"},
                 {"d": "dmgmori.com", "why": "德日合并的机床巨头，高精度加工中心和自动化单元的技术白皮书有深度。"},
                 {"d": "trumpf.com", "why": "通快，激光切割的全球领导者。钣金工艺与激光器参数的一手来源。"},
             ]},
            {"title": "电气与自动化", "note": "控制层的大脑和神经",
             "items": [
                 {"d": "bosch.com", "why": "博世，传感与控制元件的巨头，力士乐液压与驱动技术也归在官网技术板块。"},
                 {"d": "siemens.com", "why": "西门子，自动化全栈方案。PLC 与驱动选型从官网的 Industry 板块进。"},
                 {"d": "abb.com", "why": "ABB，电气与机器人双强，电机和变频器的样本与认证文档查得顺。"},
             ]},
            {"title": "计算与学术", "note": "手算验证与前沿追踪",
             "items": [
                 {"d": "wolframalpha.com", "why": "工程计算的验算神器。单位换算、方程求解、材料参数核对，输入自然语言就行。"},
                 {"d": "scholar.google.com", "why": "学术前沿入口。机构设计、仿真方法的新论文，按关键词订阅最省力。"},
             ]},
        ],
    },
    {
        "slug": "job-hunt",
        "title": "求职跳槽情报站",
        "kicker": "找工作不从投简历开始，从研究公司开始",
        "intro": "多数人找工作的顺序错了：先海投简历，再被动等待。高效的动线是反过来的——"
                 "先在招聘平台看机会分布，摸清哪些公司在扩、哪些岗位在招；再去 Glassdoor "
                 "这类站研究公司真实评价和薪资区间；最后针对少数几家定制投递。这份合辑按"
                 "中、日、韩三个市场分组，跨境求职的照着对应分组走。",
        "sections": [
            {"title": "机会发现", "note": "先看市场全貌，再决定往哪投",
             "items": [
                 {"d": "linkedin.com", "why": "全球职场社交的主场。外企和跨境岗位的第一信息源，Recruiter 主动联系的入口。"},
                 {"d": "indeed.com", "why": "北美与欧洲岗位聚合最强的一个，按薪资和公司评分筛选很顺手。"},
                 {"d": "glassdoor.com", "why": "投简历前必看：面试经验、员工评价、薪资区间都在这里。研究公司的情报站。"},
                 {"d": "zhipin.com", "why": "BOSS 直聘，国内互联网与制造业岗位密度高，直接和用人方聊是特色。"},
                 {"d": "lagou.com", "why": "拉勾招聘，互联网产品与技术岗位的垂直站，公司详情页信息规范。"},
                 {"d": "liepin.com", "why": "猎聘，中高端岗位和猎头渠道多，适合有年限的工程师看机会。"},
             ]},
            {"title": "日本市场", "note": "日系企业的招聘动线和国内很不一样",
             "items": [
                 {"d": "job.rikunabi.com", "why": "理系（理工科）学生的主战场，制造业和技术岗信息最全，应届生必看。"},
                 {"d": "mynavi.jp", "why": "日本最大招聘平台之一，企业说明会和实习情报更新快，适岗匹配做得细。"},
                 {"d": "doda.jp", "why": "有经验者的转职站，年薪区间公开透明，顾问对接是主要服务方式。"},
                 {"d": "wantedly.com", "why": "「先聊价值观再谈职位」的创新型招聘平台，初创和 IT 公司聚集。"},
             ]},
            {"title": "韩国市场", "note": "韩企招聘高度平台化",
             "items": [
                 {"d": "jobkorea.co.kr", "why": "韩国老牌招聘门户，大企业和制造业岗位覆盖广，简历模板本地化。"},
                 {"d": "saramin.co.kr", "why": "사람인，韩国使用量最大的招聘站，企业薪资情报和面试评价数据库是特色。"},
                 {"d": "wanted.co.kr", "why": "원티드，主打「职位描述透明化」的成长型平台，IT 与初创岗位为主。"},
             ]},
        ],
    },
    {
        "slug": "deep-research",
        "title": "一个人做深度研究",
        "kicker": "从检索、验证到沉淀，完整的工具链",
        "intro": "深度研究的难点不在找资料，在交叉验证和信息沉淀。这份合辑按流程排："
                 "先用 AI 搜索快速建立全貌，再回到权威源和学术库核对关键事实，最后把"
                 "多语言资料用翻译工具打通、丢进笔记本结构化。顺序上先广后精、先英后中——"
                 "反过来的话，很容易在二手资料里打转。",
        "sections": [
            {"title": "检索入口", "note": "先花十分钟建立全貌，再决定深挖哪里",
             "items": [
                 {"d": "perplexity.ai", "why": "带引用的 AI 搜索，每个结论都挂着来源链接。建立主题全貌最快的方式。"},
                 {"d": "kimi.com", "why": "长文档处理见长，丢几十页 PDF 进去做摘要和问答不慌，中文资料尤其稳。"},
                 {"d": "metaso.cn", "why": "秘塔 AI 搜索，中文场景下的学术模式好用，自动聚合中英文文献源。"},
                 {"d": "notebooklm.google.com", "why": "Google 的笔记本式研究工具，把多个资料源变成可问答的知识库，引用直接定位到原文。"},
             ]},
            {"title": "权威源核对", "note": "AI 给的答案，回来核对一遍再信",
             "items": [
                 {"d": "wikipedia.org", "why": "多语言维基，建立基础概念框架的第一站。词条底部的参考文献常是好线索。"},
                 {"d": "britannica.com", "why": "大英百科，编辑审校制的权威性在需要引用时比维基更站得住。"},
                 {"d": "wolframalpha.com", "why": "数据和计算类事实的终极核对者，工程和科学问题直接给结构化答案。"},
             ]},
            {"title": "论文与学术库", "note": "前沿结论只认论文，按市场分别检索",
             "items": [
                 {"d": "scholar.google.com", "why": "全球学术检索入口，跟踪一个领域就看「被引用」和「相关文章」两条线。"},
                 {"d": "cnki.net", "why": "中国知网，中文期刊和学位论文的权威库，国内研究现状查这里最全。"},
                 {"d": "riss.kr", "why": "韩国学术数据库，KCI 收录的论文检索，研究韩国技术与产业动向用。"},
                 {"d": "cir.nii.ac.jp", "why": "CiNii，日本论文检索枢纽，覆盖日语学术期刊与国会图书馆藏书。"},
                 {"d": "ndl.go.jp", "why": "日本国立国会图书馆，绝版资料和博士论文的线下备份，线上可检索馆藏。"},
             ]},
            {"title": "翻译与沉淀", "note": "最后一步：多语言资料变自己的知识",
             "items": [
                 {"d": "deepl.com", "why": "论文和长文翻译的默认选项，术语一致性比一般机翻好一个档，读外文文献的主力。"},
                 {"d": "notion.so", "why": "研究的终点是结构化沉淀。把结论、引用、待验证问题分库管理，下一篇研究直接复用。"},
             ]},
        ],
    },
]


# ══════════════════════════ 页面骨架 ══════════════════════════

CSS = """
*{box-sizing:border-box}
body{margin:0;font:15px/1.75 -apple-system,"Microsoft YaHei UI",sans-serif;color:#1d1d1f;background:#fff}
.wrap{max-width:860px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:25px;margin:0 0 6px}
.kicker{color:#0071e3;font-size:14px;font-weight:600;margin:0 0 10px}
.intro{color:#3a3a3c;font-size:14.5px;line-height:1.9;margin:14px 0 0}
.meta{color:#8e8e93;font-size:12.5px;margin:6px 0 0}
.back{display:inline-block;margin:14px 8px 8px 0;padding:8px 16px;border-radius:999px;background:#0071e3;color:#fff;text-decoration:none;font-size:14px}
.back.ghost{background:#f5f5f7;color:#1d1d1f}
.gnav{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.88);-webkit-backdrop-filter:saturate(180%) blur(14px);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid #e5e5ea}
.gnav-in{max-width:860px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.gnav-home{color:#0071e3;font-size:14.5px;font-weight:650;text-decoration:none;white-space:nowrap}
.gnav-home:hover{text-decoration:underline}
.gnav-links{display:flex;gap:18px}
.gnav-links a{color:#6e6e73;font-size:13.5px;text-decoration:none;white-space:nowrap}
.gnav-links a:hover{color:#1d1d1f}
h2{font-size:18px;margin:34px 0 4px;font-weight:650;letter-spacing:.01em}
.sec-note{color:#8e8e93;font-size:13px;margin:0 0 6px}
ol.items{list-style:none;padding:0;margin:10px 0 0;counter-reset:item}
ol.items li{counter-increment:item;padding:13px 0 15px;border-bottom:1px solid #f2f2f7;display:flex;gap:13px}
ol.items li:before{content:counter(item);flex:0 0 24px;height:24px;border-radius:50%;background:#e8f1ff;color:#0071e3;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px}
.it-main{flex:1;min-width:0}
.it-shot{flex:0 0 128px;width:128px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #ececf0;background:#f5f5f7;margin-top:2px}
@media (max-width:640px){.it-shot{display:none}}
a.site{font-weight:650;color:#0071e3;text-decoration:none;font-size:15px}
a.site:hover{text-decoration:underline}
.why{color:#2c2c2e;margin:4px 0 0;font-size:14px;line-height:1.8}
.desc{color:#6e6e73;font-size:13px;margin:3px 0 0}
.tags{font-size:11.5px;color:#8e8e93;margin:5px 0 0}
.tags span{background:#f5f5f7;border-radius:4px;padding:1px 7px;margin-right:5px}
.guide-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:20px 0 0}
.gcard{display:block;border:1px solid #e5e5ea;border-radius:14px;padding:16px 18px;text-decoration:none;color:inherit;transition:box-shadow .18s ease,border-color .18s ease}
.gcard:hover{border-color:#0071e3;box-shadow:0 4px 18px rgba(0,113,227,.10)}
.gcard h3{margin:0 0 4px;font-size:15.5px;color:#1d1d1f}
.gcard .gk{color:#0071e3;font-size:12.5px;font-weight:600;margin:0 0 8px}
.gcard p{color:#6e6e73;font-size:13px;margin:0;line-height:1.7}
.gcard .gn{color:#8e8e93;font-size:12px;margin:8px 0 0}
.related{margin-top:44px;padding-top:18px;border-top:1px solid #e5e5ea}
.related h2{font-size:15px;margin:0 0 10px}
footer{margin-top:44px;padding-top:16px;border-top:1px solid #e5e5ea;color:#8e8e93;font-size:13px}
@media (prefers-color-scheme:dark){body{background:#1c1c1e;color:#f5f5f7}.it-shot{border-color:#3a3a3c;background:#2c2c2e}.desc,.meta,.tags,.gn{color:#98989d}.why{color:#d5d5d8}ol.items li{border-color:#2c2c2e}ol.items li:before{background:#0a2540;color:#6cb3ff}.tags span{background:#2c2c2e}.gcard{border-color:#3a3a3c}.gcard:hover{border-color:#6cb3ff}.gcard h3{color:#f5f5f7}.back.ghost{background:#2c2c2e;color:#f5f5f7}footer{border-color:#3a3a3c}.related{border-color:#3a3a3c}.gnav{background:rgba(28,28,30,.88);border-color:#3a3a3c}.gnav-links a{color:#98989d}.gnav-links a:hover{color:#f5f5f7}}
"""


def load_sites():
    """data.js 是 JS 字面量，用 Node 求值后吐 JSON"""
    script = (
        "const fs=require('fs');global.window={};"
        "eval(fs.readFileSync('%s','utf8'));"
        "console.log(JSON.stringify(window.SITE_DATA));" % DATA_FILE.replace("\\", "/")
    )
    import json
    r = subprocess.run(["node", "-e", script], capture_output=True, timeout=60)
    if r.returncode != 0:
        print("[失败] Node 解析 data.js：%s" % r.stderr.decode("utf-8", "ignore")[:200])
        return {}
    import json as j
    out = {}
    for s in j.loads(r.stdout.decode("utf-8", "ignore")):
        dom = s["url"].split("//")[-1].split("/")[0].lower()
        if dom.startswith("www."):
            dom = dom[4:]
        out[dom] = s
    return out


def esc(s):
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def page_shell(title, description, canonical, body, extra_head=""):
    # 顶部置顶导航：全站统一入口，避免访客（尤其从搜索直接落到子页）找不到回主站的路
    nav = ('<nav class="gnav"><div class="gnav-in">'
           '<a class="gnav-home" href="%s/">← 全球黄页</a>'
           '<span class="gnav-links"><a href="%s/guides.html">主题合辑</a>'
           '<a href="%s/sites.html">全站索引</a></span>'
           '</div></nav>' % (BASE, BASE, BASE))
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title>
<meta name="description" content="%s">
<link rel="canonical" href="%s">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="全球黄页">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:url" content="%s">
<meta property="og:image" content="%s/assets/img/og-cover.png">
<meta name="twitter:card" content="summary_large_image">
<style>%s</style>
%s
</head>
<body>
%s
<div class="wrap">
%s
<footer>全球黄页 · 主题合辑 · 收录均为各站点官方首页链接 · 与主站 %s 数据同步</footer>
</div>
</body>
</html>
""" % (esc(title), esc(description), canonical, esc(title), esc(description),
       canonical, BASE, CSS, extra_head, nav, body, BASE)


def count_sites(col, sites):
    return sum(1 for sec in col["sections"] for it in sec["items"]
               if it["d"] in sites)


def write_guides(base=BASE, sites=None):
    """生成 guides.html + guides/<slug>.html，返回 [(相对路径, 站点数)]

    sites 可以是域名→站点的字典（本模块 load_sites 的产物），
    也可以是 gen-seo.load_data() 返回的站点列表——两种都接。
    """
    if sites is None:
        sites = load_sites()
    elif isinstance(sites, list):
        keyed = {}
        for s in sites:
            dom = s["url"].split("//")[-1].split("/")[0].lower()
            if dom.startswith("www."):
                dom = dom[4:]
            keyed[dom] = s
        sites = keyed
    if not os.path.isdir(GUIDES_DIR):
        os.makedirs(GUIDES_DIR)
    written = []

    # ── 每个合辑一页 ──
    for col in COLLECTIONS:
        parts = []
        n = count_sites(col, sites)
        parts.append('<p class="kicker">%s</p>' % esc(col["kicker"]))
        parts.append('<h1>%s</h1>' % esc(col["title"]))
        parts.append('<p class="meta">合辑内含 %d 个站点 · 编辑精选 · 更新于 %s</p>'
                     % (n, "2026-10"))
        parts.append('<p class="intro">%s</p>' % esc(col["intro"]))
        parts.append('<a class="back" href="%s/guides.html">← 全部主题合辑</a>'
                     % base)
        parts.append('<a class="back ghost" href="%s/">回到主站看截图与投票</a>' % base)
        for sec in col["sections"]:
            parts.append("<h2>%s</h2>" % esc(sec["title"]))
            parts.append('<p class="sec-note">%s</p>' % esc(sec["note"]))
            parts.append('<ol class="items">')
            for it in sec["items"]:
                s = sites.get(it["d"])
                if not s:
                    print("  [警告] 合辑 %s 引用了不存在的域名：%s"
                          % (col["slug"], it["d"]))
                    continue
                tags = []
                cats_zh = {"search": "搜索", "portal": "门户", "social": "社交",
                           "news": "新闻", "media": "媒体", "ai": "AI",
                           "reference": "参考", "devtools": "开发", "shopping": "购物",
                           "jobs": "求职", "finance": "财经", "travel": "旅行",
                           "tools": "工具", "education": "教育", "lifestyle": "生活",
                           "machinery": "机械", "local-life": "本地生活"}
                tags.append(cats_zh.get(s["category"], s["category"]))
                # 站点首页截图：构建期预生成的静态图（assets/img/shots/），
                # 没有就留空——不引入运行时第三方请求
                shot = "%s/assets/img/shots/%s.webp" % (base, it["d"])
                shot_html = ('<img class="it-shot" src="%s" alt="%s 首页截图" '
                             'loading="lazy" onerror="this.remove()">' % (shot, esc(s["name"])))
                parts.append(
                    "<li><div class=\"it-main\">"
                    "<a class=\"site\" href=\"%s\" target=\"_blank\" rel=\"noopener\">%s</a>"
                    "<p class=\"why\">%s</p>"
                    "<p class=\"desc\">%s</p>"
                    "<p class=\"tags\"><span>%s</span><span>%s</span><span>%s</span></p>"
                    "</div>%s</li>"
                    % (esc(s["url"]), esc(s["name"]), esc(it["why"]),
                       esc(s["desc"]), esc(tags[0]), esc(s.get("region", "")),
                       esc(s.get("lang", "")), shot_html))
            parts.append("</ol>")
        # 相关合辑
        others = [c for c in COLLECTIONS if c["slug"] != col["slug"]][:3]
        if others:
            parts.append('<div class="related"><h2>换个场景，还有这些合辑</h2>')
            for c in others:
                parts.append('<p><a class="site" href="%s/guides/%s.html">%s</a>'
                             ' <span class="desc">—— %s</span></p>'
                             % (base, c["slug"], esc(c["title"]), esc(c["kicker"])))
            parts.append("</div>")

        title = "%s · %d 个站点 — 全球黄页主题合辑" % (col["title"], n)
        desc = col["intro"][:110]
        html = page_shell(title, desc, "%s/guides/%s.html" % (base, col["slug"]),
                          "\n".join(parts))
        rel = "guides/%s.html" % col["slug"]
        io.open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="\n").write(html)
        written.append((rel, n))

    # ── 合辑索引页 ──
    cards = []
    for col in COLLECTIONS:
        n = count_sites(col, sites)
        cards.append(
            '<a class="gcard" href="%s/guides/%s.html">'
            '<p class="gk">%s</p><h3>%s</h3><p>%s</p>'
            '<p class="gn">%d 个站点 · %d 个分组</p></a>'
            % (base, col["slug"], esc(col["kicker"]), esc(col["title"]),
               esc(col["intro"][:60] + "…"), n, len(col["sections"])))
    body = [
        '<p class="kicker">按任务选工具，而不是按分类</p>',
        "<h1>主题合辑</h1>",
        '<p class="meta">%d 个合辑 · 由编辑围绕具体任务精选</p>' % len(COLLECTIONS),
        '<p class="intro">分类页按行业切，合辑页按任务切：每份合辑是一条完整动线，'
        "从第一步到最后一步该用哪些站，逐站附编辑点评。</p>",
        '<a class="back ghost" href="%s/">回到主站</a>' % base,
        '<a class="back ghost" href="%s/sites.html">全站索引</a>' % base,
        '<div class="guide-cards">%s</div>' % "".join(cards),
    ]
    html = page_shell("主题合辑 · 按任务精选的网站动线 — 全球黄页",
                      "%d 份编辑精选合辑，覆盖独立开发、AI 创作、机械工程、求职与研究场景。"
                      % len(COLLECTIONS),
                      "%s/guides.html" % base, "\n".join(body))
    io.open(os.path.join(ROOT, "guides.html"), "w", encoding="utf-8", newline="\n").write(html)
    written.append(("guides.html", len(COLLECTIONS)))
    return written


GUIDES_START = "<!-- GUIDES-BLOCK:START (由 tools/gen-collections.py 生成，勿手改) -->"
GUIDES_END = "<!-- GUIDES-BLOCK:END -->"


def guides_block(base=BASE, sites=None):
    """首页「主题合辑」区块（静态 HTML，爬虫可读）

    sites 接受字典或列表（同 write_guides）。
    """
    if sites is None:
        sites = load_sites()
    elif isinstance(sites, list):
        keyed = {}
        for s in sites:
            dom = s["url"].split("//")[-1].split("/")[0].lower()
            if dom.startswith("www."):
                dom = dom[4:]
            keyed[dom] = s
        sites = keyed
    cards = []
    for col in COLLECTIONS:
        n = count_sites(col, sites)
        cards.append(
            '<a class="gc-card" href="%s/guides/%s.html">'
            '<p class="gc-k">%s</p><h3>%s</h3><p>%s</p>'
            '<p class="gc-n">%d 个站点 →</p></a>'
            % (base, col["slug"], esc(col["kicker"]), esc(col["title"]),
               esc(col["intro"][:52] + "…"), n))
    block = (
        GUIDES_START + "\n"
        '<section class="guides-sec" aria-label="主题合辑">'
        '<div class="wrap">'
        '<div class="section-head"><h2>主题合辑</h2>'
        '<span class="section-note">%d 份编辑精选 · 按任务串联的网站动线</span></div>'
        '<div class="gc-grid">%s</div>'
        '<p class="gc-more"><a href="%s/guides.html">查看全部合辑 →</a></p>'
        "</div></section>\n"
        + GUIDES_END
    )
    return block % (len(COLLECTIONS), "".join(cards), base)


GUIDES_CSS = """
.guides-sec{padding:52px 0 8px;background:var(--bg-alt,#fafafc)}
.gc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:16px}
.gc-card{display:block;background:var(--bg-elevated,#fff);border:1px solid var(--line,#e8e8ed);border-radius:14px;padding:16px 18px;text-decoration:none;color:inherit;transition:border-color .18s ease,box-shadow .18s ease}
.gc-card:hover{border-color:var(--accent,#0071e3);box-shadow:0 4px 18px rgba(0,113,227,.10)}
.gc-k{color:var(--accent,#0071e3);font-size:12.5px;font-weight:600;margin:0 0 6px}
.gc-card h3{font-size:15px;margin:0 0 6px}
.gc-card p{color:var(--text-3,#8e8e93);font-size:12.5px;margin:0;line-height:1.7}
.gc-n{color:var(--accent,#0071e3);font-weight:600;margin-top:8px !important}
.gc-more{margin:16px 0 0;font-size:14px}
.gc-more a{color:var(--accent,#0071e3);text-decoration:none;font-weight:600}
.gc-more a:hover{text-decoration:underline}
"""

if __name__ == "__main__":
    pages = write_guides()
    for rel, n in pages:
        print("  生成 %s（%d）" % (rel, n))
