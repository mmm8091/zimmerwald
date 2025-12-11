# Zimmerwald v1.2 架构设计规范 (The Refactor Edition)

**版本代号**: v1.2 "Less is More" (大重构)
**核心目标**: 通过引入现代化的轻量级框架 (Hono, Drizzle, Vue3)，大幅减少样板代码 (Boilerplate)，降低代码复杂度，使其能被 AI 在有限的上下文窗口内完全理解和维护。

---

## 1. 技术栈变革 (The New Stack)

| 模块 | v1.1 (旧) | **v1.2 (新)** | 选型理由 |
| :--- | :--- | :--- | :--- |
| **Web 框架** | 原生 `fetch` + 手写路由 | **Hono** | Cloudflare Workers 的事实标准。提供标准的路由 API，自动处理 Request/Response/CORS，代码量减少 30%。 |
| **数据库** | 原生 SQL 字符串 | **Drizzle ORM** | 类型安全，无运行时开销。AI 写 TS 对象定义比拼接 SQL 字符串准确率高得多。 |
| **AI 调用** | 手写 `fetch` 请求 | **OpenAI SDK** | 标准化接口，自动处理流式传输、错误重试和类型定义。兼容 DeepSeek/Grok。 |
| **前端** | 原生 DOM 操作 | **Vue 3 (CDN)** | 数据驱动视图。强制使用 **Options API** 风格，降低逻辑复杂度，代码更直观。 |
| **验证** | 手写 `if` 判断 | (保持手写) | 暂不引入 Zod，保持依赖最简化，简单参数直接在 Hono 路由中校验。 |

---

## 2. 目录结构 (Directory Structure)

重构后的项目结构应清晰分离关注点，方便 AI 索引：

```text
src/
├── db/
│   └── schema.ts          # Drizzle 数据库定义 (Single Source of Truth)
├── services/
│   └── ai.ts              # OpenAI SDK 封装与 Prompt 逻辑
├── config/
│   └── prompts.ts         # 静态的 System Prompt 文本
├── worker.ts              # Hono App 入口 & Cron 调度入口
└── index.html             # Vue 3 前端单页 (Single File)
```

---

## 3. 数据库设计 (Drizzle Schema)

不再维护 `schema.sql`，所有表结构定义在 `src/db/schema.ts` 中。

### 3.1 `articles` 表 (情报核心)
* **定义**:
    ```typescript
    import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

    export const articles = sqliteTable('articles', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      url: text('url').unique().notNull(),
      sourceId: text('source_id').notNull(),
      
      // 双语内容 (LLM 生成)
      titleEn: text('title_en').notNull(),
      titleZh: text('title_zh').notNull(),
      summaryEn: text('summary_en'),
      summaryZh: text('summary_zh'),
      
      // 元数据
      category: text('category'), // Labor, Politics, Conflict, Theory
      tags: text('tags'),         // JSON String: [{"en":"Strike","zh":"罢工"}]
      score: integer('score'),
      aiReasoning: text('ai_reasoning'),
      
      // 时间戳
      publishedAt: integer('published_at').notNull(),
      createdAt: integer('created_at').notNull(),
    });
    ```
* **索引**: 需在 Drizzle 配置中针对 `score`, `category`, `publishedAt` 创建索引。

### 3.2 `feedback` 表 (群众审计)
* **定义**:
    ```typescript
    export const feedback = sqliteTable('feedback', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      articleId: integer('article_id').references(() => articles.id),
      voteType: text('vote_type').notNull(), // 'too_high', 'accurate', 'too_low'
      userHash: text('user_hash').notNull(),
      createdAt: integer('created_at').notNull(),
    });
    ```

---

## 4. 后端逻辑规范 (Backend)

### 4.1 Hono 应用 (`worker.ts`)
* **初始化**: 使用 `new Hono<{ Bindings: Env }>()` 获得完整的类型提示。
* **路由设计**:
    * `GET /`: 返回读取 `index.html` 的静态 HTML 响应。
    * `GET /api/news`:
        * 接收 Query: `min_score`, `tag` (模糊匹配), `limit`.
        * 操作: 使用 `db.select().from(articles).where(...)`。
        * 返回: `c.json(data)`.
    * `POST /api/feedback`:
        * 接收 JSON Body.
        * 操作: `db.insert(feedback).values(...)`.
* **Cron 调度**:
    * Hono 不直接接管 `scheduled` 事件。需在 `worker.ts` 底部显式导出：
        ```typescript
        export default {
          fetch: app.fetch,
          scheduled: async (event, env, ctx) => { 
             // 在这里调用 src/services/ai.ts 中的分析逻辑
          }
        }
        ```

### 4.2 AI 服务 (`services/ai.ts`)
* **SDK**: 初始化 `new OpenAI({ baseURL: env.AI_API_BASE ... })`.
* **逻辑流程**:
    1.  **Context Loop**: 调用 `db.select` 获取最近 7 天的高频 Tags。
    2.  **Prompt 构建**: 将 Tags 注入 `config/prompts.ts` 中的模板。
    3.  **调用**: `client.chat.completions.create`。
    4.  **解析**: 处理返回的 JSON 字符串，清洗 Markdown 标记。

---

## 5. 前端逻辑规范 (Frontend)

### 5.1 Vue 3 架构
为了避免构建步骤（无需 Webpack/Vite），直接在 `index.html` 中使用 ESM 模块导入 Vue。

```html
<script type="module">
  import { createApp } from '[https://unpkg.com/vue@3/dist/vue.esm-browser.js](https://unpkg.com/vue@3/dist/vue.esm-browser.js)'
  
  createApp({
    // 强制使用 Options API
    data() {
      return {
        articles: [],
        filter: { minScore: 75, lang: 'zh' }, // 默认只看高分
        loading: false
      }
    },
    computed: {
      // 动态计算直方图数据 (0-100分分布)
      histogram() { 
         // 基于 this.articles 计算
      },
      // 动态计算热门标签
      trendingTags() { 
         // 基于 this.articles 计算 Top 20
      }
    },
    methods: {
      async fetchNews() { 
        // fetch('/api/news'...)
      },
      toggleLang() { 
        this.filter.lang = this.filter.lang === 'zh' ? 'en' : 'zh';
      },
      submitVote(id, type) {
        // fetch('/api/feedback'...)
      }
    },
    mounted() {
      this.fetchNews();
    }
  }).mount('#app')
</script>
```

### 5.2 核心组件逻辑
* **双语切换**: 不再操作 DOM 类名。直接在模板中使用 `v-if` 或三元表达式：
    `<h3>{{ filter.lang === 'zh' ? article.titleZh : article.titleEn }}</h3>`
* **直方图滑块**:
    * 使用 Vue 的 `computed` 属性动态根据 `this.articles` 计算 0-100 分的分布数组。
    * 使用 CSS Flexbox 渲染柱状图背景。
    * `input type="range"` 双向绑定 `v-model="filter.minScore"`。

---

## 6. 迁移策略 (Migration Strategy)

由于这是一个技术栈的重大变更：

1.  **依赖安装**: 需要先运行 `npm install hono drizzle-orm drizzle-kit openai postgres` (postgres 仅作为 drizzle 依赖，实际运行时用 sqlite-proxy)。
2.  **数据重置**: 建议**清空数据库**。v1.2 的 Drizzle Schema 虽然逻辑上兼容 v1.1，但为了避免字段命名风格（驼峰 vs 下划线）的混淆，清空并让爬虫重新抓取是成本最低的方案。
3.  **部署检查**: 确保 `wrangler.toml` 中的入口文件配置正确。

---

### 📝 总结
v1.2 的核心是 **"Standardization" (标准化)**。通过使用 Hono 和 Vue，我们将此前大量手写的“胶水代码”替换为业界标准模式，这将显著提升 AI 编程助手生成代码的准确率和可用性。