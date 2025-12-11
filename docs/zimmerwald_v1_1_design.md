## Zimmerwald v1.1 架构设计规范（Design Specification）

版本代号：**“International”**  
总体目标：将 MVP 升级为 **“国际共运情报仪表盘（Intelligence Dashboard）”**。  
核心理念：**唯物主义评分、双语情报、群众审计、可视化筛选**。

---

## 1. 数据库架构（Cloudflare D1）

v1.1 采用单库宽表策略：核心情报集中在 `articles` 表，群众审计数据集中在 `feedback` 表。

### 1.1 `articles` 表（情报核心）

> 存储经过 RSS 抓取 + LLM 分析后的新闻情报，包含双语内容、标签和唯物主义评分。

| 字段名        | 类型     | 说明                                                                 | 索引建议                                   |
| ------------- | -------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `id`          | INTEGER  | 主键，自增                                                           | PK                                         |
| `url`         | TEXT     | 原始链接（去重指纹）                                                 | UNIQUE (`idx_articles_url`)                |
| `source_id`   | TEXT     | 来源标识（如 `'wsws'`, `'red_herald'`）                              | -                                          |
| `published_at`| INTEGER  | 原文发布时间（Unix 时间戳，可为空）                                  | INDEX (`idx_articles_published_at`)        |
| `created_at`  | INTEGER  | 抓取入库时间（Unix 时间戳）                                         | -                                          |
| `title_en`    | TEXT     | 英文标题（通常为原文标题）                                           | -                                          |
| `title_zh`    | TEXT     | 中文标题（由 LLM 翻译/改写，直指阶级矛盾）                           | -                                          |
| `summary_en`  | TEXT     | 英文摘要（约 50 词，面向国际读者）                                   | -                                          |
| `summary_zh`  | TEXT     | 中文摘要（约 40–100 字，突出“谁在和谁斗争、围绕什么利益”）           | -                                          |
| `category`    | TEXT     | 枚举：`Labor` / `Politics` / `Conflict` / `Theory`                  | INDEX (`idx_articles_category_published`)  |
| `tags`        | TEXT     | JSON 字符串：`[{"en":"Strike","zh":"罢工"}, ...]`                    | 逻辑层解析；可按需增加全文索引             |
| `score`       | INTEGER  | 0–100，唯物主义重要性评分                                            | INDEX (`idx_articles_score`)               |
| `ai_reasoning`| TEXT     | AI 给出该评分的简短理由（用于调试与防幻觉，也可未来对外展示）        | -                                          |

**索引策略（v1.1 已在 `schema_v1_1.sql` 中实现）：**

- `idx_articles_url`：`UNIQUE (url)` —— 保证同一文章只入库一次。
- `idx_articles_published_at`：`(published_at DESC)` —— 时间轴查询。
- `idx_articles_score_published`：`(score, published_at)` —— 对应首页默认“高分+最新”视图。
- `idx_articles_category_published`：`(category, published_at)` —— 分类筛选。
- `idx_articles_score`：`(score)` —— 高分筛选。

> 对应需求中的：
> - `idx_default_view: (score DESC, published_at DESC)`  
> - `idx_filter: (category, score)`  
> 实际实现采用 SQLite 兼容写法，效果等价。

### 1.2 `feedback` 表（群众审计）

> 记录用户对 AI 评分的主观判断，为未来 RLHF / 统计分析提供基础数据。

| 字段名       | 类型     | 说明                                                                 |
| ------------ | -------- | -------------------------------------------------------------------- |
| `id`         | INTEGER  | 主键，自增                                                           |
| `article_id` | INTEGER  | 逻辑外键，指向 `articles.id`                                        |
| `vote_type`  | TEXT     | 枚举：`too_high` / `accurate` / `too_low`                            |
| `user_hash`  | TEXT     | 基于 IP + User-Agent 的指纹哈希，用于防刷而不过度收集隐私           |
| `created_at` | INTEGER  | 投票时间（Unix 时间戳）                                             |

**索引策略：**

- `idx_feedback_article`: `(article_id)` —— 按文章聚合统计反馈。
- `idx_feedback_article_user`: `(article_id, user_hash)` —— 防止同一用户在同一文章重复刷票。
- `idx_feedback_created_at`: `(created_at DESC)` —— 按时间排序统计。

---

## 2. 后端逻辑（Worker & AI）

### 2.1 上下文感知循环（The Context Loop）

每次调用 LLM 之前，Worker 需要：

1. **Pre-fetch**：从 D1 查询过去 7 天的 `articles.tags`（非 `NULL`）。
2. **Aggregate**：在 Worker 内部解析 JSON 数组，统计标签频次，按出现频率排序取 Top 30（中英对照）。
3. **Inject**：将 Top 30 标签序列化为 JSON 字符串，替换 System Prompt 中的 `{{EXISTING_TAGS_PLACEHOLDER}}`。

目标：让 LLM **优先复用已有标签**，只在必要时创造新标签，从而形成自增强的“标签记忆”。

### 2.2 System Prompt（唯物主义总编辑）

人格设定：**冷酷的唯物主义总编辑（Materialist Editor in Chief）**。

- 输入：
  - 新闻标题（通常为英文原文）
  - 新闻摘要/正文片段（从 RSS 描述/正文提取）
  - `Existing Tags List`（由 Context Loop 动态注入）
- 处理：
  - 首先尝试从 `Existing Tags List` 中复用标签；
  - 依据“具有物质力量的事件”金字塔标准，对新闻进行 0–100 打分；
  - 生成双语标题：`title_en` / `title_zh`；
  - 生成双语摘要：`summary_en` / `summary_zh`；
  - 给出一句话 `ai_reasoning` 解释评分依据。
- 输出：**严格 JSON 格式**（已在 `LLM_CONFIG.systemPrompt` 中定义）：

```json
{
  "title_zh": "中文标题（直指阶级矛盾）",
  "title_en": "English Title",
  "summary_zh": "中文摘要（突出谁在和谁斗争，围绕什么利益，40-100字）",
  "summary_en": "English Summary (Max 50 words)",
  "category": "Labor|Politics|Conflict|Theory",
  "tags": [{"en": "String", "zh": "String"}],
  "score": 0,
  "ai_reasoning": "简短的一句话理由。格式：'涉及[具体物质后果]，属于[等级]范畴'。"
}
```

---

## 3. API 接口设计

### 3.1 `GET /api/news`

- **Query 参数**
  - `min_score`（可选，默认 75）：只返回评分 ≥ `min_score` 的文章。
  - `tag`（可选，模糊匹配）：在 `tags` JSON 中按中英文任意一侧模糊匹配。
  - `category`（可选）：`Labor` / `Politics` / `Conflict` / `Theory`。
  - `limit`（可选，默认 30，上限如 200）：返回条数限制。
- **返回数据**
  - 直接暴露宽表字段（或映射到前端视图模型），至少包含：
    - `id`, `url`, `source_id`, `source_name`
    - `title_en`, `title_zh`, `summary_en`, `summary_zh`
    - `category`, `tags`, `score`, `published_at`, `created_at`

### 3.2 `POST /api/feedback`

- **请求体（JSON）**

```json
{
  "article_id": 123,
  "vote_type": "too_high" // or "accurate" / "too_low"
}
```

- **后端逻辑**
  1. 基于请求 IP + User-Agent 计算 `user_hash`（简单哈希即可，避免存储原始信息）。
  2. 检查同一 `article_id + user_hash` 是否已存在记录，可选择：
     - 拒绝重复投票；或
     - 覆盖旧记录为最新一次投票。
  3. 写入 `feedback` 表，记录 `created_at` 时间戳。

- **返回**
  - `{ success: true }` 或 `{ success: false, message: "..." }`。

---

## 4. 前端交互（Intelligence Dashboard）

### 4.1 全局状态

- **Language Toggle**：顶部语言开关 `[CN / EN]`。
  - 使用简单的前端状态（JS 全局变量或轻量状态管理）。
  - 通过切换 CSS Class（如 `.lang-cn` / `.lang-en`）显示/隐藏对应语言块，不强制刷新整页。
- **Default Filter**：初始加载默认 `min_score = 75`，只展示“干货级”新闻。

### 4.2 核心组件

- **直方图滑块（Histogram Slider）**
  - 列表上方展示当前结果集中 `score` 的分布柱状图（0–100 分）。
  - 拖动滑块动态调整 `min_score`，前端实时过滤当前数据，或重新请求 `/api/news`。

- **热门话题雷达（Trending Radar / Tag Cloud）**
  - 前端在当前列表数据上再次聚合 `tags`，统计 Top N 标签。
  - 以标签云/雷达形式展示，字号或颜色表示频次。
  - 点击标签即在前端状态中设置 `tag` 过滤，并刷新列表。

- **群众审计（Crowd Audit）**
  - 鼠标悬停在分数上方时，浮出三个按钮：
    - `▼`：认为分数偏高（`vote_type = "too_high"`）
    - `OK`：认为分数合理（`vote_type = "accurate"`）
    - `▲`：认为分数偏低（`vote_type = "too_low"`）
  - 点击即向 `POST /api/feedback` 发送请求，成功后给出轻量提示（toast）。

---

## 5. 开发规划（Phases）

- **Phase 1：数据库重构（Schema Migration）**
  - 设计并落地 `schema_v1_1.sql`（`articles` + `feedback` + 索引）。
  - 将 D1 实际迁移到新结构（包含 `DROP TABLE IF EXISTS`）。

- **Phase 2：后端逻辑升级（Worker Brain）**
  - 使用新宽表结构重写 Worker 类型与持久化逻辑。
  - 实现 **Context Loop**（Top 30 Tags 注入 Prompt）。
  - 升级 `System Prompt` 为“唯物主义总编辑”人格，支持双语输出与打分解释。
  - 扩展 `GET /api/news` 支持多维过滤参数。
  - 新增 `POST /api/feedback` 写入群众审计数据。

- **Phase 3：前端重写（Dashboard UI）**
  - ✅ 实现双语切换（CN/EN 语言切换，前端状态管理）
  - ✅ 实现直方图滑块（评分分布可视化 + `min_score` 动态过滤）
  - ✅ 实现热门标签云（基于当前列表的 Top 20 标签聚合，点击筛选）
  - ✅ 实现分类筛选（Labor / Politics / Conflict / Theory 下拉选择）
  - ✅ 实现群众审计交互（投票按钮：▲ / OK / ▼，暂不展示聚合统计）
  - ⏳ 优化移动端体验与 TailwindCSS 视觉风格（待后续迭代）

---

## 6. 实现状态（Implementation Status）

### Phase 1：数据库重构 ✅ **已完成**

- ✅ `schema_v1_1.sql` 已创建并部署到 D1
- ✅ `articles` 表：双语字段（`title_en`/`title_zh`、`summary_en`/`summary_zh`）、JSON `tags`、`score`、`ai_reasoning`
- ✅ `feedback` 表：群众审计投票记录
- ✅ 所有索引策略已实现（URL 唯一、时间轴、评分排序、分类筛选）

### Phase 2：后端逻辑升级 ✅ **已完成**

- ✅ Worker 架构重构：`src/core/*`（types, db, rss, llm, news, sources）+ `src/api/*`（news, feedback）
- ✅ Context Loop：`buildExistingTagsPromptFragment` 从最近 7 天文章中提取 Top 30 标签，动态注入 Prompt
- ✅ System Prompt：已升级为“唯物主义总编辑”人格，要求双语输出 + 严格 JSON 格式
- ✅ `GET /api/news`：支持 `min_score`、`tag`、`category`、`limit` 多维过滤
- ✅ `POST /api/feedback`：群众审计投票接口，基于 IP+UA 的 `user_hash` 防刷
- ✅ RSS 抓取与调度：分批处理、去重、错误处理

### Phase 3：前端 Intelligence Dashboard ✅ **核心功能已完成**

- ✅ **纯前端渲染架构**：首页改为空壳 + JS 动态加载 `/api/news`
- ✅ **评分直方图 + 滑块**：0–100 分分布可视化，拖动滑块实时过滤（debounce 后重新请求 API）
- ✅ **分类筛选**：下拉框选择 `Labor`/`Politics`/`Conflict`/`Theory`，默认 `min_score=75`
- ✅ **标签云 + 标签筛选**：Top 20 标签可视化，点击自动填入并筛选
- ✅ **双语切换**：CN/EN 按钮，前端状态管理，不刷新页面
- ✅ **群众审计按钮**：每条新闻的 `▲`/`OK`/`▼` 投票入口（暂不展示统计）

**待优化项：**
- ⏳ 移动端响应式布局优化
- ⏳ 加载状态（loading spinner）与错误提示优化
- ⏳ 健康检查端点 `GET /health`

---

## 7. 架构概览（Architecture Overview）

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Intelligence Dashboard (HTML + TailwindCSS + JS)     │  │
│  │  - 直方图滑块 (min_score filter)                      │  │
│  │  - 标签云 (tag filter)                                │  │
│  │  - 分类筛选 (category filter)                         │  │
│  │  - 双语切换 (CN/EN)                                   │  │
│  │  - 群众审计投票 (POST /api/feedback)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (worker.ts)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/api/                                             │  │
│  │    - news.ts    → GET /api/news (多维过滤)            │  │
│  │    - feedback.ts → POST /api/feedback (投票)         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/core/                                            │  │
│  │    - db.ts      → D1 读写 (articles, feedback)       │  │
│  │    - llm.ts     → LLM API 调用 (Context Loop)         │  │
│  │    - rss.ts     → RSS 抓取与解析                      │  │
│  │    - news.ts    → 文章查询与映射                      │  │
│  │    - sources.ts → source_id ↔ source_name            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/config/                                          │  │
│  │    - rss-sources.ts → RSS 源配置                      │  │
│  │    - scheduler.ts   → 调度器配置                      │  │
│  │    - llm.ts         → LLM 配置 (Prompt, Temp, Tokens) │  │
│  │    - app.ts         → 应用配置                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare D1 (SQLite)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  articles 表                                          │  │
│  │    - 双语内容 (title_en/zh, summary_en/zh)           │  │
│  │    - 标签 JSON (tags)                                 │  │
│  │    - 评分与理由 (score, ai_reasoning)                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  feedback 表                                          │  │
│  │    - 群众审计投票 (article_id, vote_type, user_hash) │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  RSS Feeds (WSWS, Peoples Dispatch, Red Herald...)  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LLM API (DeepSeek / OpenRouter / Anthropic)        │  │
│  │    - Context Loop: Top 30 Tags → Prompt              │  │
│  │    - 输出: 双语标题/摘要 + 标签 + 评分 + 理由         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**数据流：**

1. **定时任务（Scheduled）**：
   - RSS 抓取 → LLM 分析（带 Context Loop） → D1 写入
2. **前端请求**：
   - 浏览器 → `GET /api/news?min_score=75&category=Labor` → D1 查询 → JSON 返回 → 前端渲染
3. **群众审计**：
   - 用户点击投票 → `POST /api/feedback` → D1 写入（防刷逻辑）


