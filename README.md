# Zimmerwald v1.0

国际共产主义运动新闻聚合与分析平台

## 📖 简介

Zimmerwald 是一个自动化的新闻聚合平台，专注于国际共产主义运动相关的新闻报道。平台会自动抓取多个左翼新闻源的 RSS 订阅，使用 AI 进行智能分析和分类，为读者提供高质量的新闻摘要和重要性评分。

## ✨ 核心功能

- 📰 **多源聚合**：自动抓取 13+ 个国际左翼新闻源的 RSS 订阅
- 🤖 **智能分析**：使用 DeepSeek 等 LLM 模型进行新闻分析，生成中文摘要
- 📊 **分类评分**：自动将新闻分类（Labor, Politics, Conflict, Theory）并给出重要性评分（0-100）
- 🗄️ **数据存储**：使用 Cloudflare D1 数据库持久化存储
- 🌐 **全球访问**：基于 Cloudflare Workers 的边缘计算，确保全球快速访问
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

- `GET /` - 前端页面（新闻列表）
- `GET /api/news?limit=30` - 获取新闻列表（JSON 格式）
- `GET /test/fetch?limit=50` - 手动触发新闻抓取
- `GET /test/llm` - 测试 LLM API 调用
- `GET /test/rss?url=...` - 测试 RSS 源
- `GET /test/all-rss` - 批量测试所有 RSS 源

## 🗄️ 数据库 Schema

```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  score INTEGER,
  published_at INTEGER,
  created_at INTEGER NOT NULL
);
```

## 🔧 技术栈

- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **AI Service**: DeepSeek / OpenRouter / 其他 OpenAI 兼容 API
- **Frontend**: HTML/JS + TailwindCSS
- **RSS Parser**: fast-xml-parser

## 📝 项目结构

```
zimmerwald/
├── src/
│   └── config/          # 配置文件
│       ├── rss-sources.ts
│       ├── scheduler.ts
│       ├── llm.ts
│       └── app.ts
├── worker.ts            # Worker 主入口
├── schema.sql           # 数据库 Schema
├── wrangler.toml        # Cloudflare Workers 配置
├── package.json
└── tsconfig.json
```

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

**Zimmerwald** - 以 1915 年齐默尔瓦尔德会议命名，纪念国际共产主义运动的团结传统。

