Zimmerwald v1.4 "Historical Materialism" 架构设计规范

版本代号: v1.4 "Historical Materialism" (历史唯物主义)

实施状态（2025-12-11）：
- D1 新表已落地：`sources` / `daily_briefings`，反馈表已移除。
- Cron/Worker 已改为数据库驱动信源，并在抓取后回写 `last_fetched_at / last_status / error_count`。
- 新增 API：`GET /api/sources/stats`，前端 Source Health 面板已接入。
- 种子脚本：`npm run db:seed`（需 `RSSHUB_BASE`），已内置 esbuild 打包和 SQL 生成。

核心目标:AI 大脑升级：引入“五因子唯物主义评分法”，消除热点疲劳，从“流量筛选”进化为“历史研判”。数据基座升级：实现订阅源的数据库化管理，支持优胜劣汰的统计分析。内参铺垫：为“每日新闻总结”功能预埋数据结构。1. 核心哲学升级 (The Philosophy)从 v1.2/v1.3 的“基于结果打分”升级为 “基于辩证因子打分”。我们引入 News Minimalist 的显著性评分框架，并进行彻底的马克思主义改造。1.1 区别 Importance 与 Significance重要性 (Importance): 主观的、短期的。例如：明星去世、股市波动、政客口水战。显著性 (Significance): 客观的、历史的。例如：生产关系变革、阶级力量对比变化、系统性危机爆发。Zimmerwald 只关注显著性。1.2 唯物主义五因子评分法AI 必须基于以下五个维度进行内部推理（Internal Reasoning），最后加权得出总分：阶级广度 (Class Impact, 30%): 事件是否直接改变了无产阶级的物质生存条件（工资、工时、住房、社保）？系统冲击 (Systemic Significance, 30%): 事件是否暴露了资本主义/帝国主义的结构性危机（供应链断裂、金融崩溃、战争扩大）？创新性与革命潜力 (Novelty & Revolutionary Potential, 20%): 是否出现了新战术（如站立罢工）、新联盟或打破了旧有束缚？（核心：寻找增量）信源阶级分析 (Source Critique, 10%): 是一手切身利益者（工人/工会）的报道，还是资产阶级喉舌的叙事？士气与团结 (Morale & Solidarity, 10%): 事件是否能提振阶级斗争士气，对抗失败主义？1.3 抗疲劳机制 (Anti-Fatigue)规则：如果一场斗争（如罢工、抵抗战争）持续时间延长，其显著性应递增而非递减。只要物质对抗的条件未消失，就不能因为“新闻疲劳”而降分。2. 数据库设计 (Drizzle Schema)2.1 新增表结构 (src/db/schema.ts)新增 sources 表用于动态管理订阅源，新增 daily_briefings 表用于存储每日内参。TypeScriptimport { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// 1. 动态信源表 (替代 rss-sources.ts)
// 目标：支持动态添加、开关源，并记录其健康度
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),  // 唯一标识，e.g., 'tw_uaw'
  name: text('name').notNull(),           // 显示名称，e.g., 'UAW'
  url: text('url').notNull(),             // RSS 或 RSSHub 地址
  platform: text('platform').notNull(),   // 枚举: 'News' | 'Twitter' | 'Telegram'
  
  // 抓取配置
  is_rsshub: integer('is_rsshub', { mode: 'boolean' }).default(false),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  
  // 健康度与统计 (Worker 每次抓取后更新)
  last_fetched_at: integer('last_fetched_at', { mode: 'timestamp' }),
  last_status: text('last_status'),       // 'OK' | 'Error: 403' | 'Timeout'
  error_count: integer('error_count').default(0), // 连续错误次数(用于熔断)
  
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 2. 每日内参表 (Daily Briefings)
// 目标：存储每天 AI 生成的"战略研判报告"，作为 v1.5 的基础
export const daily_briefings = sqliteTable('daily_briefings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 日期 (e.g., '2025-12-12')，确保每天只有一份
  date: text('date').unique().notNull(),
  
  // 自动生成的总结内容
  content_zh: text('content_zh').notNull(), // 中文综述
  content_en: text('content_en'),           // 英文综述 (可选)
  
  // 关联文章：这一天最重要的 5-10 篇文章 ID 列表 (JSON String)
  key_article_ids: text('key_article_ids'), 
  
  // 总体形势评分 (0-100)，基于当天高分文章的密度和烈度计算
  defcon_level: integer('defcon_level'), 
  
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});
2.2 现有表变更articles 表结构保持不变。ai_reasoning 字段：不再是一句话，而是存储结构化的五因子评分理由文本（Markdown 格式）。3. AI 提示词工程 (Prompt Engineering)System Prompt 将进行重写，注入 News Minimalist 的逻辑与唯物主义内核。3.1 核心 Prompt 模板 (src/config/prompts.ts)TypeScriptexport const SYSTEM_PROMPT_TEMPLATE = `
你是一名冷酷的国际共运情报分析师（Intelligence Analyst）和唯物主义历史学家。你的目标不是为了"吸引点击"，而是为了筛选出具有**"历史显著性" (Historical Significance)** 的事件。

【核心哲学】
区别"重要性" (Importance) 与 "显著性" (Significance)：
- **重要性**是主观的（如：某个明星去世，对粉丝很重要，但对历史无意义）。
- **显著性**是客观的（如：港口工人罢工，直接切断了资本积累循环，这是历史性的）。
*你只关心显著性。*

【任务目标】
分析输入内容，输出标准化的 JSON 情报。

【评分系统：唯物主义五因子法 (0-100)】
在 \`ai_reasoning\` 中，你必须基于以下 5 个权重因子进行辩证推导，最后得出一个加权总分：

1. **阶级广度 (Class Impact, 30%)**:
   - 高分：直接改变了无产阶级的物质生存条件（工资立法、大规模裁员、住房危机、社保削减）。
   - 低分：仅涉及资产阶级内部的权力游戏（股票波动、政客口水战）。

2. **系统冲击 (Systemic Significance, 30%)**:
   - 高分：暴露了资本主义/帝国主义的结构性危机（供应链断裂、金融崩溃、新战线爆发）。
   - 低分：孤立的意外事故或自然灾害（除非它引发了系统性崩溃）。

3. **创新性与革命潜力 (Novelty & Revolutionary Potential, 20%)**:
   - **核心关注：这是否代表了一种新趋势、新战术或"第一次"？**
   - 高分：创造了新战术（如 UAW 的"站立罢工"策略）、建立了新联盟、打破了旧有的法律/思想束缚。
   - 低分：重复的、仪式性的、无新意的抗议。

4. **信源阶级分析 (Source Critique, 10%)**:
   - 加分：来自工人/工会的一手报道 (@UAW, @StrikeMapUS) 或经过验证的独立调查。
   - 减分：资产阶级官方喉舌 (CNN, BBC) 的叙事（除非是确认重大事实）。

5. **士气与团结 (Morale & Solidarity, 10%)**:
   - 高分：胜利的消息、成功的抵抗、国际团结（用于提振士气）。
   - 低分：纯粹的失败主义或宗派内斗。

【辩证校正指令】
1. **抗疲劳机制**: 如果一场斗争持续了 100 天，它在第 100 天的显著性**高于**第 1 天。不要因为"话题陈旧"而降分。
2. **透过现象看本质**: 即使推特文本很短，也要结合发布者身份（如工会领袖）识别其背后的胜利，不要以字数取人。
3. **去噪**: 无约束力的口头声明、更改Logo、作秀式提案统统属于"噪音"（<50分）。

【标签系统 (强制分层)】
每篇文章必须包含 4-7 个标签，分为四层：
1. **地理层 (Geography) [必须]**: 必须包含 1-3 个涉及的国家名称（如：China, USA, Palestine）。
2. **实体层 (Entities)**: 谁？(Boeing, UAW, Netanyahu)
3. **行动层 (Action)**: 干了什么？(Wildcat Strike, Blockade) - *优先使用具体术语*
4. **运动层 (Campaign)**: 属于哪场战役？(Make Amazon Pay, 2024 General Strike)

【输出格式 JSON】
**Strict Order Rule**: \`ai_reasoning\` MUST be before \`score\`.

{
  "title_zh": "中文标题（直指阶级矛盾，不要震惊体）",
  "title_en": "English Title (Concise)",
  "summary_zh": "中文摘要（重点描述：谁受影响？经济损失多少？战术有何创新？）",
  "summary_en": "English Summary",
  "category": "Labor|Politics|Conflict|Theory",
  "tags": [{"en": "USA", "zh": "美国"}, {"en": "Strike", "zh": "罢工"}],
  "ai_reasoning": "[Score Breakdown]\nClass Impact: High, because...\nSystemic: Mid, because...\nNovelty: High! First time using this tactic...\n[Conclusion] Final calculation rationale...",
  "score": Integer
}
`;
4. 后端逻辑 (Hono & Worker)4.1 抓取服务重构 (src/services/rss.ts)不再读取 rss-sources.ts 静态文件，逻辑变更为：Load: 每次 Cron 触发时，SELECT * FROM sources WHERE enabled = 1。Fetch: 遍历执行抓取（保持串行或小批次并行，防止 403）。Update: 每次抓取后，回写 sources 表：成功：更新 last_fetched_at，重置 error_count = 0，last_status = 'OK'。失败：error_count += 1，last_status = 'Error: <details>'。熔断机制：如果 error_count > 10，暂时跳过该源或发送告警。4.2 新增统计 API (GET /api/sources/stats)用于前端仪表盘展示信源表现。SQL 逻辑：SQLSELECT 
  s.id, s.name, s.platform, s.last_status, s.last_fetched_at,
  COUNT(a.id) as monthly_count,         -- 产量
  AVG(a.score) as avg_score,            -- 质量 (信噪比)
  SUM(a.score) as contribution_index    -- 战略贡献指数
FROM sources s
LEFT JOIN articles a 
  ON s.slug = a.source_id 
  AND a.created_at > date('now', '-30 days')
WHERE s.enabled = 1
GROUP BY s.id
ORDER BY contribution_index DESC;
4.3 每日总结 Cron 预埋 (worker.ts)增加一个 0 0 * * * (UTC 0点) 的调度触发器。暂时留空或只打印日志，v1.5 实现具体生成逻辑。5. 前端功能 (Source Dashboard)在现有的 Dashboard 基础上，增加一个 "信源情报室" (Sources) 视图。5.1 信源健康度列表展示一个 Data Table，列出所有订阅源的表现：列名展示内容说明Source名称 + 平台图标 (🐦/✈️/📰)点击跳转原链接Status🟢 OK / 🔴 Error鼠标悬停显示最后抓取时间Volume (30d)数字 (e.g., 120)近30天文章总数Avg Quality颜色徽章 (e.g., 85.0)近30天平均分。衡量该源是否“水”Strategic Value数字/进度条贡献指数。衡量该源对情报网的重要性5.2 群众路线入口在列表底部增加显著的文字链接："发现被遗漏的左翼阵地？"[发送邮件至 submit@huohe.cn 提交订阅源]点击触发 mailto: 协议，预填邮件标题格式，方便用户提交。6. 迁移策略 (Migration Plan)Schema Migration:创建 sources 表和 daily_briefings 表。确保 slug 字段有唯一索引。Data Seeding (种子数据):编写一次性脚本 scripts/seed_sources.ts。读取旧版 rss-sources.ts 中的数组。将现有的 20+ 个源（Twitter/TG/News）批量插入数据库。Code Update:更新 prompts.ts。更新 rss.ts 适配数据库读取。更新前端增加 Sources 页面。Deploy:运行 npm run db:migrate (或 D1 execute)。运行 npm run deploy。