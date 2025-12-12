# Zimmerwald v1.5 "Foundation" 架构设计规范

**版本**: v1.5.0  
**日期**: 2025-12-12  
**代号**: "Foundation"（基础重构）  
**核心目标**: 前端现代化重构 + 每日简报功能完整实现

---

## 📋 版本概述

v1.5 是前端架构的**基础重构版本**，核心任务：

1. **前端现代化**：从 Vue 3 CDN Options API 迁移到 Vite + Composition API + Pinia
2. **UI 视觉升级**：深色主题、侧边栏导航、现代化卡片布局
3. **每日简报功能**：完整实现后端生成逻辑和前端展示
4. **性能优化**：引入状态管理、数据缓存、防抖优化

---

## 🎨 UI 设计规范（基于参考图）

### 设计主题：深色情报中心

**色彩系统**：
- **背景色**：`zinc-900` (#18181b) - 主背景
- **侧边栏**：`zinc-900` + `zinc-800` 边框
- **卡片背景**：`zinc-900` / `zinc-800`
- **文字**：`zinc-100` (主文字) / `zinc-400` (次要文字)
- **强调色**：
  - **历史级 (90-100)**：`rose-600` (#e11d48) - 红色边框
  - **战略级 (80-89)**：`amber-500` (#f59e0b) - 橙色边框
  - **战术级 (60-79)**：`yellow-500` (#eab308) - 黄色边框
  - **噪音 (<60)**：`zinc-500` (#71717a) - 灰色

**布局结构**：
```
┌─────────────────────────────────────────┐
│  Top Briefing Bar (24-Hour Summary)    │
├──────┬──────────────────────────────────┤
│      │  FILTERS          │  FEED        │
│      │  ┌──────────────┐ │  ┌─────────┐ │
│ Side │  │ Histogram    │ │  │ Card 1  │ │
│ bar  │  │ + Slider     │ │  │ Card 2  │ │
│      │  └──────────────┘ │  │ Card 3  │ │
│      │  ┌──────────────┐ │  └─────────┘ │
│      │  │ Geo Filters  │ │              │
│      │  └──────────────┘ │              │
└──────┴──────────────────────────────────┘
```

---

## 🏗️ 技术栈

### 前端核心
- **框架**: Vue 3.4+ (Composition API + `<script setup>`)
- **构建工具**: Vite 5.0+
- **状态管理**: Pinia 2.1+ (Setup Stores)
- **路由**: Vue Router 4 (SPA 路由)
- **数据获取**: `@tanstack/vue-query` v5 (服务端状态、缓存、自动重试)
- **样式**: Tailwind CSS 3.4+ (`darkMode: 'class'`)
- **图标**: Lucide Vue Next
- **图表**: 轻量级方案（CSS Flex 或 Chart.js）

### 后端（Worker）
- **框架**: Hono (保持不变)
- **数据库**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM (保持不变)

---

## 📁 项目结构

```
zimmerwald/
├── frontend/                    # 新前端项目（Vite）
│   ├── src/
│   │   ├── api/                 # API 客户端
│   │   │   ├── client.ts        # Fetch 封装（BaseURL、Interceptors）
│   │   │   ├── articles.ts      # GET /api/news
│   │   │   ├── sources.ts       # GET /api/sources/stats
│   │   │   └── briefings.ts     # GET /api/daily-briefings
│   │   ├── components/
│   │   │   ├── ui/              # 基础 UI 组件（Button, Card, Badge, Slider）
│   │   │   ├── layout/
│   │   │   │   ├── AppSidebar.vue      # 左侧导航栏
│   │   │   │   └── TopBriefing.vue     # 顶部简报条
│   │   │   ├── filters/
│   │   │   │   ├── ScoreHistogram.vue  # 分数直方图 + 滑块
│   │   │   │   └── GeoFilter.vue       # 地理标签筛选（复选框）
│   │   │   └── feed/
│   │   │       ├── ArticleCard.vue     # 情报卡片（三种边框样式）
│   │   │       └── AIReasoningModal.vue # 五因子详情弹窗
│   │   ├── stores/
│   │   │   ├── useFilterStore.ts       # 筛选器状态（分数范围、地理、平台）
│   │   │   └── useUIStore.ts           # UI 状态（侧边栏展开、语言）
│   │   ├── views/
│   │   │   ├── Dashboard.vue           # 主页（过滤器 + 情报流）
│   │   │   ├── Sources.vue             # 信源健康页
│   │   │   ├── Briefings.vue           # 每日简报历史页
│   │   │   └── About.vue                # 关于页
│   │   ├── composables/
│   │   │   └── useDebounce.ts          # 防抖工具（用于滑块）
│   │   ├── types/
│   │   │   ├── api.d.ts                # API 响应类型
│   │   │   └── models.d.ts             # 实体类型（Article, Source, Briefing）
│   │   ├── App.vue
│   │   └── main.ts
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── src/                          # 后端代码（保持不变）
│   ├── services/
│   │   └── briefings.ts         # 新增：每日简报生成逻辑
│   └── ...
├── worker.ts                     # Worker 入口（新增简报生成 Cron）
└── wrangler.toml
```

---

## 🔧 核心功能设计

### 1. 每日简报功能（Daily Briefings）

#### 1.1 后端生成逻辑

**Cron 调度**：每天 UTC 0:00 执行（`0 0 * * *`）

**生成流程**：
1. **数据收集**：查询过去 24 小时的所有文章（`created_at >= 24h ago`）
2. **统计分析**：
   - 总分析数：`COUNT(*)`
   - 高价值数：`COUNT(*) WHERE score >= 80`
   - 关键词提取：从标签中提取 Top 10 地理标签
   - DEFCON 等级：根据高价值文章比例计算（1-5）
3. **AI 生成摘要**：
   - 调用 LLM，输入：Top 20 高分文章（score >= 70）的标题和摘要
   - 生成：中文摘要（`content_zh`）和英文摘要（`content_en`）
   - 格式：Markdown，包含关键事件、趋势分析、战略判断
4. **存储**：写入 `daily_briefings` 表

**API 端点**：
```typescript
// GET /api/daily-briefings
// 查询参数：?date=2025-12-12 (可选，默认最新)
// 返回：{ date, content_zh, content_en, defcon_level, key_article_ids, stats: {...} }

// GET /api/daily-briefings/latest
// 返回最新一期的简报
```

#### 1.2 前端展示

**TopBriefing.vue 组件**：
- 显示最新简报的摘要（24 小时统计）
- 格式：`"24-HOUR BRIEFING: 1,240 REPORTS ANALYZED. 18 STRATEGIC (80+) IDENTIFIED."`
- 点击跳转到 `Briefings.vue` 查看完整内容

**Briefings.vue 页面**：
- 列表展示历史简报（按日期倒序）
- 每项显示：日期、DEFCON 等级、摘要预览、关键数据
- 详情页：完整 Markdown 渲染、关联文章列表

---

### 2. 前端重构要点

#### 2.1 状态管理（Pinia）

**useFilterStore.ts**：
```typescript
export const useFilterStore = defineStore('filter', () => {
  const scoreRange = ref<[number, number]>([60, 100])
  const selectedGeo = ref<string[]>([]) // 地理标签数组
  const selectedPlatform = ref<string | null>(null)
  const selectedCategory = ref<string | null>(null)
  
  // 计算 API 查询参数
  const queryParams = computed(() => ({
    min_score: scoreRange.value[0],
    max_score: scoreRange.value[1],
    geo: selectedGeo.value.join(','),
    platform: selectedPlatform.value,
    category: selectedCategory.value,
  }))
  
  return { scoreRange, selectedGeo, selectedPlatform, selectedCategory, queryParams }
})
```

#### 2.2 数据获取（Vue Query）

**articles.ts**：
```typescript
export function useArticles() {
  const filterStore = useFilterStore()
  
  return useQuery({
    queryKey: ['articles', filterStore.queryParams],
    queryFn: () => fetchArticles(filterStore.queryParams),
    staleTime: 30000, // 30 秒内不重新请求
  })
}
```

#### 2.3 组件设计

**ArticleCard.vue**：
- Props: `article: Article`
- 根据 `article.score` 动态设置边框颜色：
  - `score >= 90`: `border-l-4 border-l-rose-600`
  - `score >= 80`: `border-l-4 border-l-amber-500`
  - `score >= 60`: `border-l-2 border-l-yellow-500`
  - 其他: `border-zinc-800`
- 显示：标题、摘要、标签、平台图标、分数徽章
- 点击"唯物主义研判"按钮：打开 `AIReasoningModal` 显示五因子详情

**ScoreHistogram.vue**：
- 使用 CSS Flex 绘制直方图（11 个柱子，0-100 分）
- 覆盖 `Slider` 组件（双向滑块）
- 高亮选中范围内的柱子
- 防抖更新（300ms）避免频繁请求

---

### 3. 后端 API 扩展

#### 3.1 新增 API

```typescript
// GET /api/daily-briefings
app.get('/api/daily-briefings', async (c) => {
  const date = c.req.query('date') // 可选，格式：YYYY-MM-DD
  const briefing = await getDailyBriefing(c.env.DB, date)
  return c.json(briefing)
})

// GET /api/daily-briefings/latest
app.get('/api/daily-briefings/latest', async (c) => {
  const briefing = await getLatestBriefing(c.env.DB)
  return c.json(briefing)
})

// GET /api/stats/histogram
// 返回分数分布直方图数据（用于 ScoreHistogram 组件）
app.get('/api/stats/histogram', async (c) => {
  const dateRange = c.req.query('date_range') // 可选，默认最近 30 天
  const histogram = await getScoreHistogram(c.env.DB, dateRange)
  return c.json(histogram)
})
```

#### 3.2 新增服务函数

**src/services/briefings.ts**：
```typescript
export async function generateDailyBriefing(db: D1Database): Promise<void> {
  // 1. 收集过去 24 小时数据
  // 2. 统计分析
  // 3. 调用 AI 生成摘要
  // 4. 写入数据库
}

export async function getDailyBriefing(db: D1Database, date?: string): Promise<DailyBriefing | null> {
  // 查询指定日期的简报
}

export async function getLatestBriefing(db: D1Database): Promise<DailyBriefing | null> {
  // 查询最新简报
}
```

---

## 📊 数据模型

### Article（前端类型）
```typescript
export interface Article {
  id: number
  title_zh: string
  title_en: string
  summary_zh?: string
  summary_en?: string
  score: number | null
  category: 'Labor' | 'Politics' | 'Conflict' | 'Theory' | null
  tags: Array<{ en: string; zh: string; type?: 'geo' | 'entity' | 'action' }>
  source_id: string
  source_name: string
  platform: 'News' | 'Twitter' | 'Telegram'
  published_at: number | null
  created_at: number
  url: string
  ai_reasoning?: string // Markdown 格式的五因子分析
}
```

### DailyBriefing（前端类型）
```typescript
export interface DailyBriefing {
  date: string // YYYY-MM-DD
  content_zh: string // Markdown
  content_en?: string // Markdown
  defcon_level: number // 1-5
  key_article_ids: number[] // 关联的高价值文章 ID
  stats: {
    total_analyzed: number
    high_value_count: number // score >= 80
    strategic_count: number // score >= 80
    top_keywords: Array<{ en: string; zh: string; count: number }>
  }
}
```

---

## 🚀 实施计划

### Phase 1: 后端每日简报功能（2-3 天）
- [ ] 实现 `src/services/briefings.ts` 生成逻辑
- [ ] 添加 Cron 任务（UTC 0:00）
- [ ] 实现 API 端点 `/api/daily-briefings`
- [ ] 测试生成流程

### Phase 2: 前端项目初始化（1-2 天）
- [ ] 创建 Vite + Vue 3 项目
- [ ] 配置 Tailwind CSS（深色模式）
- [ ] 安装依赖（Pinia, Vue Router, Vue Query）
- [ ] 配置路由和布局

### Phase 3: 核心组件开发（3-4 天）
- [ ] `AppSidebar.vue` - 侧边栏导航
- [ ] `TopBriefing.vue` - 顶部简报条
- [ ] `ScoreHistogram.vue` - 直方图筛选器
- [ ] `ArticleCard.vue` - 情报卡片
- [ ] `AIReasoningModal.vue` - 五因子详情弹窗

### Phase 4: 页面开发（2-3 天）
- [ ] `Dashboard.vue` - 主页（过滤器 + 情报流）
- [ ] `Sources.vue` - 信源健康页（复用现有逻辑）
- [ ] `Briefings.vue` - 每日简报历史页
- [ ] `About.vue` - 关于页

### Phase 5: 集成与优化（2-3 天）
- [ ] API 集成（Vue Query）
- [ ] 状态管理完善
- [ ] 响应式布局优化
- [ ] 性能优化（防抖、缓存）
- [ ] 深色模式全面检查

### Phase 6: 部署（1 天）
- [ ] 构建前端项目
- [ ] 配置 Cloudflare Pages（或静态资源托管）
- [ ] Worker 路由配置（API 代理）
- [ ] 测试部署

---

## 🔄 迁移策略

### 前端迁移
1. **并行开发**：新前端项目独立开发，不影响现有 Worker
2. **API 兼容**：确保新前端调用现有 API 端点（`/api/news`, `/api/sources/stats`）
3. **渐进替换**：新前端完成后，更新 `worker.ts` 的 `generateHTML()` 返回新前端入口

### 部署方案
- **方案 A**：Cloudflare Pages 托管前端，Worker 仅提供 API
- **方案 B**：前端构建后作为静态资源嵌入 Worker（保持单 Worker 部署）

---

## 📝 注意事项

1. **保持 API 兼容**：现有 API 端点保持不变，仅新增 `/api/daily-briefings` 相关端点
2. **数据库迁移**：`daily_briefings` 表已在 v1.4 创建，无需额外迁移
3. **AI 调用成本**：每日简报生成需要调用 LLM，注意 Token 消耗
4. **时区处理**：Cron 使用 UTC，前端显示需转换为用户时区
5. **性能考虑**：Vue Query 缓存策略、防抖优化、虚拟滚动（如文章列表过长）

---

## 🎯 成功标准

- [ ] 每日简报自动生成并存储
- [ ] 前端深色主题 UI 完整实现
- [ ] 所有核心功能（筛选、展示、简报）正常工作
- [ ] 性能指标：首屏加载 < 2s，交互响应 < 100ms
- [ ] 响应式布局支持移动端
- [ ] 代码质量：TypeScript 严格模式，无 linter 错误

---

**文档版本**: v1.5.0  
**最后更新**: 2025-12-12
