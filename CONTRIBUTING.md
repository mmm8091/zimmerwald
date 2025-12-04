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

复制 `.dev.vars.example` 为 `.dev.vars` 并填入你的配置：

```bash
cp .dev.vars.example .dev.vars
```

4. **创建本地数据库**

```bash
npm run db:local
```

5. **启动开发服务器**

```bash
npm run dev
```

## 📁 项目结构 (v1.1)

```
zimmerwald/
├── src/
│   ├── config/          # 配置文件
│   │   ├── rss-sources.ts    # RSS 源配置
│   │   ├── scheduler.ts      # 调度器配置
│   │   ├── llm.ts            # LLM API 配置
│   │   └── app.ts            # 应用通用配置
│   ├── core/            # 核心业务逻辑
│   │   ├── types.ts          # 类型定义
│   │   ├── db.ts             # D1 数据库操作
│   │   ├── rss.ts            # RSS 抓取与解析
│   │   ├── llm.ts            # LLM API 调用
│   │   ├── news.ts           # 新闻查询与映射
│   │   ├── sources.ts        # source_id ↔ source_name
│   │   └── utils.ts          # 工具函数
│   ├── api/              # API Handler
│   │   ├── news.ts           # GET /api/news
│   │   ├── feedback.ts       # POST /api/feedback
│   │   └── test.ts           # 测试端点
│   ├── frontend/         # 前端相关
│   │   └── html.ts           # HTML 页面生成
│   └── scheduler.ts      # 定时任务调度器
├── worker.ts            # Worker 主入口（路由分发，仅 67 行）
├── schema_v1_1.sql      # v1.1 数据库 Schema
├── wrangler.toml        # Cloudflare Workers 配置
├── package.json
└── tsconfig.json
```

### 关键文件说明

- **worker.ts**: 瘦路由层（67 行），只负责路径分发和 Worker 生命周期管理
- **src/core/**: 纯业务逻辑，不关心 HTTP 层
- **src/api/**: API Handler，负责参数解析和响应格式化
- **src/frontend/**: 前端 HTML 生成（包含内联 JavaScript）
- **src/scheduler.ts**: 定时任务调度器（RSS 抓取和文章分析）
- **src/config/**: 集中配置管理，避免硬编码
- **schema_v1_1.sql**: v1.1 数据库表结构定义

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

编辑 `src/config/rss-sources.ts`：

```typescript
export const RSS_SOURCES: RSSSource[] = [
  // ... 现有源
  { name: '新源名称', url: 'https://example.com/feed', enabled: true },
];
```

### 修改调度器配置

编辑 `src/config/scheduler.ts` 来调整处理限制和延迟时间。

### 调整 LLM 配置

编辑 `src/config/llm.ts` 来修改 prompt、温度参数等。

### 添加新的 API 端点

1. **创建 Handler 文件**（推荐）：在 `src/api/` 目录下创建新的 handler 文件

```typescript
// src/api/your-endpoint.ts
import type { Env } from '../core/types';

export async function handleYourEndpoint(request: Request, env: Env, url: URL): Promise<Response> {
  // 你的逻辑
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

2. **在 worker.ts 中注册路由**：

```typescript
import { handleYourEndpoint } from './src/api/your-endpoint';

// 在 fetch 函数中
if (url.pathname === '/api/your-endpoint') {
  return handleYourEndpoint(request, env, url);
}
```

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

