# Zimmerwald v1.3 "The Tentacles" 架构设计规范

## 0. 版本目标
- 接入 RSSHub（Twitter/Telegram），清洗多源数据，统一格式。
- 前端支持信源筛选（News / Twitter / Telegram）。
- 数据层新增 platform 维度，首批接入 20 个左翼测试节点。
- 保持“少样板、易被 AI 理解”的 v1.2 原则：标准化、模块化、类型安全。

---

## 1. 平台与信源 (Target List)
首批 20 个 RSSHub 目标（可按需增减），用于稳定性与清洗测试。

### 1.1 Twitter (10)
- @UAW
- @Teamsters
- @StrikeMapUS
- @LaborNotes
- @MorePerfectUS
- @Public_Citizen
- @DemSocialists
- @Jacobin
- @RnaudBertrand
- @PeoplesParty

### 1.2 Telegram (10)
- @durov
- @geopolitics_live
- @BellumActaNews
- @intelslava
- @PalestineResist
- @redstreamnet
- @TheIslanderNews
- @disclosetv
- @MedvedevRussiaE
- @shuinc

---

## 2. 数据层设计

### 2.1 Schema 变更
表：`articles`
- 新增字段：`platform TEXT NOT NULL DEFAULT 'News'`  
  枚举：`'News' | 'Twitter' | 'Telegram'`
- 索引：`CREATE INDEX idx_articles_platform ON articles(platform);`

迁移文件：`migration_v1_3.sql`
```sql
-- 1) 增加平台字段
ALTER TABLE articles ADD COLUMN platform TEXT DEFAULT 'RSS';
-- 2) 索引
CREATE INDEX idx_articles_platform ON articles(platform);
-- 3) 可选：历史数据归类
UPDATE articles SET platform = 'News' WHERE platform = 'RSS';
```

Schema 文件：`src/db/schema.ts`
- 为 `articles` 增加 `platform` 字段（默认 `'News'`），并在索引配置中包含 `platform` 索引。

### 2.2 数据映射
API `/api/news` 返回结构新增 `platform` 字段，前端依赖。

---

## 3. 配置与源管理

### 3.1 应用配置

文件：`src/config/app.ts`
- 新增 `rssHubBase` 配置项：
  ```ts
  export interface AppConfig {
    // ... 其他配置
    rssHubBase: string; // RSSHub 实例地址（自托管，建议走 HTTPS/Tunnel，必须由环境变量 RSSHUB_BASE 提供）
  }
  
  export const APP_CONFIG: AppConfig = {
    // ...
    rssHubBase: process.env.RSSHUB_BASE!, // 必填，无默认值
  };
  ```

### 3.2 RSS 源配置

文件：`src/config/rss-sources.ts`
- 新增类型：
  ```ts
  export type PlatformType = 'News' | 'Twitter' | 'Telegram';
  export interface RSSSource {
    id: string;
    name: string;
    url: string;
    platform: PlatformType;
    enabled: boolean;
    isRssHub?: boolean; // 标记是否为 RSSHub 源
  }
  ```
- RSSHub 基址：从 `APP_CONFIG.rssHubBase` 获取（集中配置管理）
- 列表中为 Top 20 目标补充 `platform`、`isRssHub`，Twitter 路径示例 `/twitter/user/UAW`，Telegram 路径示例 `/telegram/channel/durov`

### 3.3 RSSHub 部署选项

RSSHub 可以通过以下方式部署：
1. **Cloudflare Tunnel（推荐）**：参考 `docs/cloudflare-tunnel-setup.md`
2. **已有公网 HTTPS**：直接使用自托管 RSSHub 域名

修改 `src/config/app.ts` 中的 `rssHubBase` 即可切换不同的 RSSHub 实例。

---

## 4. 后端逻辑 (Hono)

### 4.1 `/api/news`
- 支持 query：`platform=Twitter|Telegram|News`（可选）。
- 查询层：Drizzle `where` 增加 `platform` 条件。
- 返回结果包含 `platform`。

### 4.2 RSS 抓取与清洗
文件：`src/services/rss.ts`
- 新增 `sanitizeContent(html, platform)`：
  - 去除 `Powered by RSSHub`。
  - `<br>` → `\n`。
  - 如含 `<img|video>`，在尾部追加 `[Contains Media]` 提示。
  - 去除所有 HTML 标签（保留文本）。
  - `html-entities` 解码。
- 针对 `Twitter`/`Telegram` 默认走清洗逻辑；News 保持原样。
- 需要引入 `html-entities` 轻量库（若未安装则新增依赖）。

### 4.3 调度器
- `handleScheduled` 中为每篇文章写入 `platform`（来自 `RSSSource.platform`）。
- 确保重复检测仍基于 `url` 唯一约束。

---

## 5. 前端 (Vue 3 Options API)

文件：`src/frontend/html.ts`
- 状态：新增 `filter.platform`，默认 `'All'`。
- UI：Filter Bar 增加平台筛选（All / News / Twitter / Telegram）。
- API 调用：请求 `/api/news?platform=...`。
- 展示差异：
  - News：保持现有卡片。
  - Twitter / Telegram：可隐藏标题，直接显示摘要/内容，标记平台徽章；若包含 `[Contains Media]`，显示小提示。
- Histogram / Tag Cloud：沿用现有逻辑，不区分平台，但过滤后的列表应反映平台筛选结果。

---

## 6. 安全与健壮性
- RSSHub 内容清洗时剔除潜在脚本/标签，默认全量 strip。
- 对 `platform` 参数做白名单校验，非法值忽略或返回 400。
- 并发插入冲突日志保持一次性提示。

---

## 7. 依赖与配置
- 新增依赖（如需要）：`html-entities`。
- `package.json` scripts 无需变动。
- `wrangler.toml` 无需改入口；Cron 仍 10 分钟。

---

## 8. 测试清单
1) `/api/news` 无 `platform` 参数：返回混合列表（默认全平台或默认 News，按实现确定）。  
2) `/api/news?platform=Twitter`：仅返回 Twitter 数据。  
3) 清洗测试：包含 `<br>`、图片/视频标签、`Powered by RSSHub` 尾巴的推文，返回纯文本并追加 `[Contains Media]`。  
4) 前端平台切换：All/News/Twitter/Telegram 切换列表与标签云、直方图同步更新。  
5) 迁移前后的数据兼容：旧数据默认 `platform = 'News'`。  
6) 并发插入：仍以 URL 唯一约束防重。  

---

## 9. 里程碑
- M1：数据库迁移与配置（platform 字段、索引、RSS 源表补全）。
- M2：后端清洗与 API 平台筛选。
- M3：前端平台筛选与展示优化。
- M4：稳定性验证（20 源跑通，观察 Cron 日志与 RSSHub 可用性）。


