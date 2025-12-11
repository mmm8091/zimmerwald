# 贡献指南

感谢你对 Zimmerwald 项目的关注！这份文档将帮助你了解项目结构、开发流程和贡献方式。

## 📋 目录

- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [提交 Pull Request](#提交-pull-request)
- [添加新功能](#添加新功能)

## 🛠️ 开发环境设置

1. **Fork 并克隆仓库**

```bash
git clone https://github.com/yourusername/zimmerwald.git
cd zimmerwald
```

2. **安装依赖**

```bash
npm install
```

3. **设置环境变量**

复制 `.dev.vars.example` 为 `.dev.vars` 并填入你的配置（文件已忽略，不会提交）：

```bash
cp .dev.vars.example .dev.vars
```

4. **启动开发服务器**

```bash
npm run dev
```

## 📁 项目结构 (v1.4)

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
│   ├── Zimmerwald v1.4 架构设计规范.md  # 架构设计文档（历史唯物主义评分）
│   ├── Zimmerwald v1.3 架构设计规范.md  # v1.3 架构文档（历史）
│   ├── Zimmerwald v1.2 架构设计规范.md  # v1.2 架构文档（历史）
│   └── Zimmerwald v1.1 架构设计规范.md  # v1.1 架构文档（历史）
├── scripts/
│   ├── migration_v1_4.sql   # v1.4 数据库迁移 SQL
│   └── seed_sources.ts       # 源种子数据生成脚本
├── worker.ts            # Worker 主入口（Hono App）
├── drizzle.config.ts    # Drizzle Kit 配置
├── wrangler.toml        # Cloudflare Workers 配置
├── package.json
└── tsconfig.json
```

### 关键文件说明

- **worker.ts**: Hono App 入口，处理路由和 Cron 调度
- **src/services/**: 服务层，封装所有业务逻辑（AI、数据库、RSS）
- **src/db/schema.ts**: 数据库 Schema 定义（Single Source of Truth，使用 Drizzle ORM）
- **src/frontend/html.ts**: Vue 3 前端单页应用（Options API）
- **src/config/**: 集中配置管理（应用配置、Prompt、RSS 源、调度器等）
  - **app.ts**: 应用通用配置
  - **rss-sources.ts**: 源模板，运行时通过 `buildRssSources(env.RSSHUB_BASE)` 构建
  - **scheduler.ts**: 调度器配置（平台限流、并发数 `aiAnalysisConcurrency`、延迟等）
  - **prompts.ts**: 历史唯物主义五因子评分 Prompt
- **wrangler.toml**: Worker 配置（不含明文 Vars）

## 📝 代码规范

### TypeScript 风格

- 使用 TypeScript 严格模式
- 使用 `async/await` 而非 Promise chains
- 函数和变量使用清晰的命名
- 添加必要的类型注释

### 注释规范

- 复杂逻辑需要中文注释说明
- 公共函数需要 JSDoc 注释
- 配置项需要说明用途和默认值

### 错误处理

- 使用 try-catch 处理异步错误
- 记录详细的错误日志
- 用户友好的错误消息

## 🔀 提交 Pull Request

1. **创建功能分支**

```bash
git checkout -b feature/your-feature-name
```

2. **进行更改**

- 遵循代码规范
- 添加必要的测试（如果适用）
- 更新相关文档

3. **提交更改**

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

提交信息格式：
- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 重构
- `chore:` 构建/工具变更

4. **推送并创建 PR**

```bash
git push origin feature/your-feature-name
```

在 GitHub 上创建 Pull Request，描述你的更改内容。

## ✨ 添加新功能

### 添加新的 RSS 源

编辑 `src/config/rss-sources.ts` 的 `SOURCE_TEMPLATES`，运行时通过 `buildRssSources(rssHubBase)` 生成完整 URL。`rssHubBase` 必须来自环境变量 `RSSHUB_BASE`（Secrets）。

### 修改调度器配置

编辑 `src/config/scheduler.ts` 来调整处理限制、延迟时间和 AI 分析并发数（`aiAnalysisConcurrency`，默认 30）。

### 调整 LLM 配置

编辑 `src/config/prompts.ts` 来修改 System Prompt 和 LLM 配置。

### 添加新的 API 端点

在 v1.3 中，使用 Hono 框架直接在 `worker.ts` 中定义路由：

```typescript
// worker.ts
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// 添加新路由
app.get('/api/your-endpoint', async (c) => {
  // 访问环境变量: c.env.DB, c.env.AI_API_KEY 等
  // 访问查询参数: c.req.query('param')
  // 返回 JSON: c.json({ success: true })
  // 返回错误: c.json({ error: 'message' }, 400)
  
  return c.json({ success: true });
});

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
```

复杂业务逻辑建议放到 `src/services/` 下的模块，再在路由中调用。

## 🐛 报告 Bug

在 GitHub Issues 中报告 bug，请包含：

1. 问题描述
2. 复现步骤
3. 预期行为
4. 实际行为
5. 环境信息（Node 版本、Cloudflare Workers 版本等）

## 💡 建议功能

在 GitHub Issues 中提出功能建议，描述：

1. 功能用途
2. 使用场景
3. 实现思路（可选）

## 📚 有用的命令

```bash
# 本地开发
npm run dev

# 部署到生产环境
npm run deploy

# 创建数据库（本地）
npm run db:local

# 创建数据库（生产）
npm run db:migrate

# 类型检查
npx tsc --noEmit
```

## 🤝 代码审查

所有 Pull Request 都需要经过代码审查。审查者会检查：

- 代码质量和规范
- 功能完整性
- 测试覆盖（如果适用）
- 文档更新

## 📞 获取帮助

- 查看现有 Issues 和 PR
- 在 Discussions 中提问
- 联系维护者

---

感谢你的贡献！🎉

