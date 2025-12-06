# Zimmerwald v1.2 "Less is More"

国际共产主义运动情报仪表盘（Intelligence Dashboard）

## 📖 简介

Zimmerwald 是一个自动化的新闻聚合与分析平台，专注于国际共产主义运动相关的新闻报道。v1.2 "Less is More" 版本进行了**大重构**，通过引入现代化的轻量级框架（Hono、Drizzle ORM、Vue 3），大幅减少样板代码，提高 AI 可维护性。

- 🤖 **唯物主义评分系统**：基于"物质力量"金字塔的 0–100 分评分
- 🌍 **双语情报**：中英文标题与摘要，面向国际读者
- 🏷️ **上下文感知标签**：LLM 优先复用热门标签，形成自增强记忆
- 👥 **群众审计机制**：用户可对 AI 评分进行投票反馈
- 📊 **可视化筛选**：直方图、标签云、分类筛选，快速定位高价值情报

> **命名来源**：以 1915 年齐默尔瓦尔德会议命名，纪念国际共产主义运动的团结传统。

## ✨ 核心功能

### v1.2 "Less is More" 新特性

- 🎯 **技术栈现代化**：使用 Hono、Drizzle ORM、OpenAI SDK、Vue 3 等成熟框架
- 📉 **代码精简**：大幅减少样板代码，提高 AI 可维护性
- 🎨 **Vue 3 前端**：使用 Options API 实现响应式界面
- 🔄 **类型安全**：Drizzle ORM 提供完整的类型推断
- 🚀 **标准化架构**：遵循业界标准模式，降低维护成本

### 基础功能

- 📰 **多源聚合**：自动抓取 20+ 个国际左翼新闻源的 RSS 订阅
- 🤖 **智能分析**：使用 DeepSeek / OpenRouter 等 LLM 模型进行新闻分析
- 📊 **自动分类**：Labor / Politics / Conflict / Theory 四类分类
- 🗄️ **数据存储**：Cloudflare D1（SQLite）持久化存储
- 🌐 **全球访问**：基于 Cloudflare Workers 的边缘计算
- ⏰ **定时更新**：每 10 分钟自动抓取和分析最新新闻

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
# 使用 SQL 迁移文件（推荐）
npx wrangler d1 execute zimmerwald-db --remote --file=./migration_v1_2.sql

# 或使用 Drizzle Kit（如果配置正确）
npm run db:migrate
```

5. **配置环境变量**

使用 Cloudflare Secrets 设置：

```bash
npx wrangler secret put AI_API_KEY
npx wrangler secret put AI_API_BASE
npx wrangler secret put AI_MODEL_NAME
npx wrangler secret put AI_API_TYPE  # 可选，默认为 'openai'
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

### AI Prompt 配置

编辑 `src/config/prompts.ts` 来调整 System Prompt 和 LLM 配置。

## 🌐 API 端点

### 生产端点

- `GET /` - 前端 Intelligence Dashboard（Vue 3 单页应用）
- `GET /api/news` - 获取新闻列表（JSON）
  - Query 参数：
    - `min_score`（可选，默认 0）：最低评分过滤
    - `category`（可选）：`Labor` / `Politics` / `Conflict` / `Theory`
    - `tag`（可选）：标签模糊匹配（中英文）
    - `limit`（可选，默认 30）：返回条数
- `POST /api/feedback` - 群众审计投票
  - Body: `{ "article_id": 123, "vote_type": "too_high"|"accurate"|"too_low" }`

## 🗄️ 数据库 Schema (v1.2)

### `articles` 表（情报核心）

```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  summary_en TEXT,
  summary_zh TEXT,
  category TEXT,              -- Labor|Politics|Conflict|Theory
  tags TEXT,                  -- JSON: [{"en":"Strike","zh":"罢工"}]
  score INTEGER,              -- 0-100
  ai_reasoning TEXT,          -- AI 评分理由
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
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

完整 Schema 定义见 [`src/db/schema.ts`](./src/db/schema.ts)（使用 Drizzle ORM）

## 🔧 技术栈

### v1.2 技术栈

- **Web 框架**: [Hono](https://hono.dev/) - Cloudflare Workers 的事实标准
- **数据库 ORM**: [Drizzle ORM](https://orm.drizzle.team/) - 类型安全，无运行时开销
- **AI SDK**: [OpenAI SDK](https://github.com/openai/openai-node) - 标准化接口，自动处理流式传输
- **前端框架**: [Vue 3](https://vuejs.org/) (CDN) - Options API 风格
- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **RSS Parser**: fast-xml-parser

### 架构模式

- **服务层分离**：`services/` 目录封装所有业务逻辑
- **类型安全**：Drizzle ORM 提供完整的类型推断
- **标准化路由**：Hono 提供标准的路由 API
- **数据驱动视图**：Vue 3 实现响应式界面

## 📝 项目结构 (v1.2)

```
zimmerwald/
├── src/
│   ├── config/          # 配置文件
│   │   ├── app.ts       # 应用配置
│   │   ├── prompts.ts   # System Prompt 配置
│   │   ├── rss-sources.ts  # RSS 源列表
│   │   └── scheduler.ts # 调度器配置
│   ├── core/            # 核心工具
│   │   └── sources.ts   # 源标识工具
│   ├── db/              # 数据库定义
│   │   └── schema.ts   # Drizzle Schema（Single Source of Truth）
│   ├── frontend/        # 前端
│   │   └── html.ts      # Vue 3 单页应用
│   └── services/        # 服务层
│       ├── ai.ts        # AI 服务（OpenAI SDK）
│       ├── db.ts        # 数据库服务（Drizzle ORM）
│       ├── rss.ts       # RSS 服务
│       └── types.ts     # 类型定义
├── docs/
│   └── Zimmerwald v1.2 架构设计规范.md  # v1.2 架构设计文档
├── worker.ts            # Worker 主入口（Hono App）
├── drizzle.config.ts    # Drizzle Kit 配置
├── migration_v1_2.sql   # 数据库迁移 SQL
├── wrangler.toml        # Cloudflare Workers 配置
├── package.json
└── tsconfig.json
```

**架构说明：**

- `worker.ts`：Hono App 入口，处理路由和 Cron 调度
- `src/services/*`：服务层，封装所有业务逻辑
- `src/db/schema.ts`：数据库 Schema 定义（Single Source of Truth）
- `src/frontend/html.ts`：Vue 3 前端单页应用
- `src/config/*`：集中配置管理

详细架构设计见 [`docs/Zimmerwald v1.2 架构设计规范.md`](./docs/Zimmerwald%20v1.2%20架构设计规范.md)

## 🔄 从 v1.1 升级到 v1.2

v1.2 是一个**破坏性重构**，主要变化：

1. **技术栈升级**：Hono、Drizzle ORM、OpenAI SDK、Vue 3
2. **数据库迁移**：使用 Drizzle Schema 替代 SQL 文件
3. **代码精简**：删除大量样板代码，使用标准库
4. **数据重置**：建议清空数据库重新开始（字段命名风格变化）

升级步骤：

1. 备份现有数据（如需要）
2. 更新依赖：`npm install`
3. 运行数据库迁移：`npx wrangler d1 execute zimmerwald-db --remote --file=./migration_v1_2.sql`
4. 重新部署：`npm run deploy`

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与项目。

## 📄 许可证

MIT License

## 🙏 致谢

感谢所有为国际共产主义运动提供新闻的左翼媒体和组织。

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Hono 文档](https://hono.dev/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Vue 3 文档](https://vuejs.org/)
- [DeepSeek API](https://platform.deepseek.com/)
- [OpenRouter](https://openrouter.ai/)

---

## 📚 相关文档

- [v1.2 架构设计文档](./docs/Zimmerwald%20v1.2%20架构设计规范.md) - 完整的技术栈、架构、设计规范
- [贡献指南](./CONTRIBUTING.md) - 如何参与项目开发

---

**Zimmerwald v1.2 "Less is More"** - 以 1915 年齐默尔瓦尔德会议命名，纪念国际共产主义运动的团结传统。
