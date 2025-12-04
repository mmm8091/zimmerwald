# Zimmerwald v1.1 "International"

国际共产主义运动情报仪表盘（Intelligence Dashboard）

## 📖 简介

Zimmerwald 是一个自动化的新闻聚合与分析平台，专注于国际共产主义运动相关的新闻报道。v1.1 "International" 版本将 MVP 升级为**情报仪表盘**，提供：

- 🤖 **唯物主义评分系统**：基于“物质力量”金字塔的 0–100 分评分
- 🌍 **双语情报**：中英文标题与摘要，面向国际读者
- 🏷️ **上下文感知标签**：LLM 优先复用热门标签，形成自增强记忆
- 👥 **群众审计机制**：用户可对 AI 评分进行投票反馈
- 📊 **可视化筛选**：直方图、标签云、分类筛选，快速定位高价值情报

> **命名来源**：以 1915 年齐默尔瓦尔德会议命名，纪念国际共产主义运动的团结传统。

## ✨ 核心功能

### v1.1 "International" 新特性

- 🎯 **情报仪表盘**：直方图滑块、标签云、分类筛选，快速定位高价值新闻
- 🌍 **双语支持**：中英文标题与摘要，一键切换语言（CN/EN）
- 🏷️ **上下文感知标签**：LLM 自动复用最近 7 天的 Top 30 热门标签，形成标签记忆
- 👥 **群众审计**：用户可对 AI 评分投票（偏高/合理/偏低），为模型优化提供数据
- 📊 **唯物主义评分**：基于“物质力量”金字塔的严格评分系统（0–100）

### 基础功能

- 📰 **多源聚合**：自动抓取 20+ 个国际左翼新闻源的 RSS 订阅
- 🤖 **智能分析**：使用 DeepSeek / OpenRouter 等 LLM 模型进行新闻分析
- 📊 **自动分类**：Labor / Politics / Conflict / Theory 四类分类
- 🗄️ **数据存储**：Cloudflare D1（SQLite）持久化存储
- 🌐 **全球访问**：基于 Cloudflare Workers 的边缘计算
- ⏰ **定时更新**：每小时自动抓取和分析最新新闻

## 🚀 快速开始

### 前置要求

- Node.js 18+ 
- npm 或 yarn
- Cloudflare 账户
- LLM API 密钥（DeepSeek、OpenRouter 等）

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/yourusername/zimmerwald.git
cd zimmerwald
```

2. **安装依赖**

```bash
npm install
```

3. **创建 D1 数据库**

```bash
npm run db:create
```

将输出的数据库 ID 复制到 `wrangler.toml` 中的 `database_id` 字段。

4. **初始化数据库**

```bash
# 本地开发
npm run db:local

# 生产环境
npm run db:migrate
```

5. **配置环境变量**

使用 Cloudflare Secrets 设置：

```bash
wrangler secret put AI_API_KEY
wrangler secret put AI_API_BASE
wrangler secret put AI_MODEL_NAME
wrangler secret put AI_API_TYPE  # 可选，默认为 'openai'
```

或创建 `.dev.vars` 文件（用于本地开发）：

```env
AI_API_KEY=your-api-key
AI_API_BASE=https://api.deepseek.com
AI_MODEL_NAME=deepseek-reasoner
AI_API_TYPE=openai
```

6. **本地开发**

```bash
npm run dev
```

访问 `http://localhost:8787` 查看结果。

7. **部署到生产环境**

```bash
npm run deploy
```

## 📚 配置说明

### RSS 源配置

编辑 `src/config/rss-sources.ts` 来添加、删除或启用/禁用 RSS 源。

### 调度器配置

编辑 `src/config/scheduler.ts` 来调整：
- 每次运行处理的源数量
- 每个源处理的文章数量
- 延迟时间（避免 API 限流）

### LLM 配置

编辑 `src/config/llm.ts` 来调整：
- Token 限制
- 温度参数
- 系统提示词

## 🌐 API 端点

### 生产端点

- `GET /` - 前端 Intelligence Dashboard（纯前端渲染）
- `GET /api/news` - 获取新闻列表（JSON）
  - Query 参数：
    - `min_score`（可选，默认 75）：最低评分过滤
    - `category`（可选）：`Labor` / `Politics` / `Conflict` / `Theory`
    - `tag`（可选）：标签模糊匹配（中英文）
    - `limit`（可选，默认 30）：返回条数
- `POST /api/feedback` - 群众审计投票
  - Body: `{ "article_id": 123, "vote_type": "too_high"|"accurate"|"too_low" }`

### 测试端点

- `GET /test/fetch?limit=50` - 手动触发新闻抓取（限制处理数量）
- `GET /test/llm` - 测试 LLM API 调用（返回详细响应）
- `GET /test/rss?url=...` - 测试单个 RSS 源
- `GET /test/all-rss` - 批量测试所有 RSS 源
- `GET /test/tags` - 查看当前热门标签池（验证 Context Loop）

## 🗄️ 数据库 Schema (v1.1)

### `articles` 表（情报核心）

```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  -- 双语内容
  title_en TEXT,
  title_zh TEXT,
  summary_en TEXT,
  summary_zh TEXT,
  -- 元数据
  category TEXT,              -- Labor|Politics|Conflict|Theory
  tags TEXT,                  -- JSON: [{"en":"Strike","zh":"罢工"}]
  score INTEGER,              -- 0-100
  ai_reasoning TEXT          -- AI 评分理由（内部调试用）
);
```

### `feedback` 表（群众审计）

```sql
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  vote_type TEXT NOT NULL,   -- too_high|accurate|too_low
  user_hash TEXT NOT NULL,    -- IP+UA 哈希指纹
  created_at INTEGER NOT NULL
);
```

完整 Schema 见 [`schema_v1_1.sql`](./schema_v1_1.sql)

## 🔧 技术栈

- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **AI Service**: DeepSeek / OpenRouter / Anthropic（OpenAI 兼容格式）
- **Frontend**: HTML + TailwindCSS + 原生 JS（无框架依赖）
- **RSS Parser**: fast-xml-parser
- **架构模式**: 模块化分层（core / api / config）

## 📝 项目结构 (v1.1)

```
zimmerwald/
├── src/
│   ├── config/          # 配置文件
│   │   ├── rss-sources.ts  # RSS 源列表
│   │   ├── scheduler.ts     # 调度器配置
│   │   ├── llm.ts          # LLM 配置（Prompt、温度、Token）
│   │   └── app.ts          # 应用配置
│   ├── core/            # 核心业务逻辑
│   │   ├── types.ts         # 类型定义
│   │   ├── db.ts            # D1 数据库操作
│   │   ├── rss.ts           # RSS 抓取与解析
│   │   ├── llm.ts           # LLM API 调用（含 Context Loop）
│   │   ├── news.ts          # 新闻查询与映射
│   │   ├── sources.ts      # source_id ↔ source_name 转换
│   │   └── utils.ts         # 工具函数
│   ├── api/              # API Handler
│   │   ├── news.ts          # GET /api/news 处理
│   │   ├── feedback.ts      # POST /api/feedback 处理
│   │   └── test.ts          # 测试端点处理
│   ├── frontend/         # 前端相关
│   │   └── html.ts          # HTML 页面生成
│   └── scheduler.ts      # 定时任务调度器
├── docs/
│   └── zimmerwald_v1_1_design.md  # v1.1 架构设计文档
├── worker.ts            # Worker 主入口（路由分发，仅 67 行）
├── schema_v1_1.sql      # v1.1 数据库 Schema
├── wrangler.toml        # Cloudflare Workers 配置
├── package.json
└── tsconfig.json
```

**架构说明：**

- `worker.ts`：瘦路由层（67 行），只负责路径分发和 Worker 生命周期管理
- `src/core/*`：纯业务逻辑，不关心 HTTP 层
- `src/api/*`：API Handler，负责参数解析和响应格式化
- `src/frontend/*`：前端 HTML 生成（包含内联 JavaScript）
- `src/scheduler.ts`：定时任务调度器（RSS 抓取和文章分析）
- `src/config/*`：集中配置管理，避免硬编码

详细架构设计见 [`docs/zimmerwald_v1_1_design.md`](./docs/zimmerwald_v1_1_design.md)

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与项目。

## 📄 许可证

MIT License

## 🙏 致谢

感谢所有为国际共产主义运动提供新闻的左翼媒体和组织。

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [DeepSeek API](https://platform.deepseek.com/)
- [OpenRouter](https://openrouter.ai/)

---

## 📚 相关文档

- [v1.1 架构设计文档](./docs/zimmerwald_v1_1_design.md) - 完整的数据库、API、前端设计规范
- [贡献指南](./CONTRIBUTING.md) - 如何参与项目开发

---

**Zimmerwald v1.1 "International"** - 以 1915 年齐默尔瓦尔德会议命名，纪念国际共产主义运动的团结传统。

