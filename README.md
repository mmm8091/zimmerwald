# Zimmerwald v1.4 "Historical Materialism"

国际共运情报仪表盘：抓取 News/Twitter/Telegram（RSSHub）并用 LLM 分析打分，前端 Vue3 单页展示；信源改为数据库动态管理，新增 Source Health 面板。v1.4 引入"历史唯物主义五因子评分法"，优化并发处理性能。

## ✨ 主要特性
- 多平台抓取：RSS & RSSHub（News / Twitter / Telegram），源存储在 D1 数据库，可动态开关
- 内容清洗：按平台差异化清洗，News 仅去 HTML 标签并解码实体
- LLM 分析：DeepSeek 主模型；遇到内容风险自动切换 OpenRouter Claude Sonnet 4.5 兜底
- 历史唯物主义评分：五因子评分法（阶级广度、系统冲击、创新性、信源分析、士气团结）
- 信源健康：`/api/sources/stats` + 前端 Source Health 面板（状态、30天产量、平均分、战略值）
- 前端筛选：平台、分类、标签、分数，Twitter/Telegram 紧凑样式，中英文界面
- 性能优化：AI 分析并发处理（可配置并发数），提升抓取效率
- 环境配置：RSSHUB_BASE、AI Key 全部走环境变量（无硬编码）

## 🚀 快速开始
1) 安装依赖  
```
npm install
```

2) 本地环境变量  
复制 `.dev.vars.example` 为 `.dev.vars`，填入真实值（文件已 .gitignore）：  
```
AI_API_KEY=...
AI_API_BASE=https://api.deepseek.com
AI_API_TYPE=openai
AI_MODEL_NAME=deepseek-reasoner
RSSHUB_BASE=https://rsshub.yourdomain.com   # 必填，HTTPS
FALLBACK_API_KEY=...                        # OpenRouter Key
FALLBACK_API_BASE=https://openrouter.ai/api/v1
FALLBACK_MODEL_NAME=anthropic/claude-sonnet-4.5
```

3) 数据库初始化与种子  
```
# 创建/迁移（如需）
npx wrangler d1 create zimmerwald-db   # 若尚未创建
# 运行 v1.4 schema（已提供脚本）
npx wrangler d1 execute zimmerwald-db --file=./scripts/migration_v1_4.sql --remote
# 写入初始源（需 RSSHUB_BASE）
RSSHUB_BASE=https://rsshub.yourdomain.com npm run db:seed
```

4) 本地开发  
```
npm run dev
```
访问 http://localhost:8787

## ☁️ 部署（Cloudflare Workers）
- 升级 wrangler：`npm i -D wrangler@4`
- 所有环境变量放 **Secrets**（包括 RSSHUB_BASE）：  
```
npx wrangler secret put AI_API_KEY
npx wrangler secret put AI_API_BASE
npx wrangler secret put AI_MODEL_NAME
npx wrangler secret put AI_API_TYPE
npx wrangler secret put RSSHUB_BASE
npx wrangler secret put FALLBACK_API_KEY
npx wrangler secret put FALLBACK_API_BASE
npx wrangler secret put FALLBACK_MODEL_NAME
```
- 部署：`npx wrangler deploy`

## 🗂️ 关键文件
- `worker.ts`：Hono 路由 & Cron 任务（按平台限流 + 并发处理），ES Module 形式
- `src/services/rss.ts`：抓取/解析/清洗 RSS，RSSHub 请求头调整
- `src/services/ai.ts`：LLM 调用与 fallback（DeepSeek + Claude Sonnet 4.5）
- `src/services/db.ts`：D1 原生 API + Drizzle ORM 混合使用，sources 统计查询
- `src/core/sources.ts`：源 id/名称映射工具
- `src/frontend/html.ts`：Vue3 单页前端（平台筛选 + Source Health 面板，中英文界面）
- `src/config/rss-sources.ts`：历史模板（用于 seeds），运行时已改为 DB 驱动
- `src/config/scheduler.ts`：调度器配置（平台限流、并发数、延迟等）
- `src/config/prompts.ts`：历史唯物主义五因子评分 Prompt
- `wrangler.toml`：Worker 配置（不再包含明文 Vars）

## 🔒 环境变量说明
- `AI_API_KEY` / `AI_API_BASE` / `AI_MODEL_NAME` / `AI_API_TYPE`：主模型
- `RSSHUB_BASE`：你的 RSSHub HTTPS 域名（Tunnel/反代均可），必填
- `FALLBACK_API_KEY` / `FALLBACK_API_BASE` / `FALLBACK_MODEL_NAME`：备用模型（OpenRouter Claude）

## 🧭 运行时行为要点
- 定时任务按平台轮询，`maxSourcesPerPlatform`、`maxArticlesPerSource`、`maxTotalArticles`、`aiAnalysisConcurrency` 可在 `src/config/scheduler.ts` 调整
- AI 分析并发处理：默认并发数 30，可在 `src/config/scheduler.ts` 的 `aiAnalysisConcurrency` 调整
- 403 场景：RSSHub 请求会带 Origin/Referer 为 RSSHub 域名；建议使用 HTTPS 反代或 Cloudflare Tunnel
- 反馈机制已移除：无 feedback API、无前端投票、无 feedback 表

## 📄 许可证
MIT License

