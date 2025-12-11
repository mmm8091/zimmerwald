// Zimmerwald v1.4 数据库 Schema (Drizzle ORM)
// Single Source of Truth

import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';

/**
 * articles 表 - 情报核心
 */
export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').unique().notNull(),
    sourceId: text('source_id').notNull(),

    titleEn: text('title_en').notNull(),
    titleZh: text('title_zh').notNull(),
    summaryEn: text('summary_en'),
    summaryZh: text('summary_zh'),

    category: text('category'),
    tags: text('tags'),
    score: integer('score'),
    aiReasoning: text('ai_reasoning'),
    platform: text('platform').notNull().default('News'),

    publishedAt: integer('published_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    urlIdx: index('idx_articles_url').on(table.url),
    scoreIdx: index('idx_articles_score').on(table.score),
    publishedAtIdx: index('idx_articles_published_at').on(table.publishedAt),
    scorePublishedIdx: index('idx_articles_score_published').on(table.score, table.publishedAt),
    categoryPublishedIdx: index('idx_articles_category_published').on(table.category, table.publishedAt),
    platformIdx: index('idx_articles_platform').on(table.platform),
    platformScoreIdx: index('idx_articles_platform_score').on(table.platform, table.score),
  })
);

/**
 * sources 表 - 动态信源管理
 */
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(), // e.g., tw_uaw
  name: text('name').notNull(),
  url: text('url').notNull(),
  platform: text('platform').notNull(), // 'News' | 'Twitter' | 'Telegram'

  isRssHub: integer('is_rsshub', { mode: 'boolean' }).default(false),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),

  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }),
  lastStatus: text('last_status'), // e.g., 'OK' | 'Error: 403'
  errorCount: integer('error_count').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * daily_briefings 表 - 每日内参
 */
export const dailyBriefings = sqliteTable('daily_briefings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').unique().notNull(), // e.g., '2025-12-12'
  contentZh: text('content_zh').notNull(),
  contentEn: text('content_en'),
  keyArticleIds: text('key_article_ids'), // JSON string of article ids
  defconLevel: integer('defcon_level'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 导出类型
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type DailyBriefing = typeof dailyBriefings.$inferSelect;
export type NewDailyBriefing = typeof dailyBriefings.$inferInsert;

