// Zimmerwald v1.2 数据库 Schema (Drizzle ORM)
// Single Source of Truth - 不再维护独立的 SQL 文件

import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';

/**
 * articles 表 - 情报核心
 * 存储经过 RSS 抓取 + LLM 分析后的高价值新闻情报
 */
export const articles = sqliteTable(
  'articles',
  {
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
    tags: text('tags'), // JSON String: [{"en":"Strike","zh":"罢工"}]
    score: integer('score'),
    aiReasoning: text('ai_reasoning'),
    platform: text('platform').notNull().default('News'), // News, Twitter, Telegram

    // 时间戳
    publishedAt: integer('published_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    // URL 唯一索引：保证同一文章只入库一次
    urlIdx: index('idx_articles_url').on(table.url),
    // 评分索引：用于高分筛选和排序
    scoreIdx: index('idx_articles_score').on(table.score),
    // 发布时间索引：用于时间轴排序
    publishedAtIdx: index('idx_articles_published_at').on(table.publishedAt),
    // 评分+发布时间复合索引：默认视图排序优化
    scorePublishedIdx: index('idx_articles_score_published').on(table.score, table.publishedAt),
    // 分类+发布时间复合索引：分类筛选优化
    categoryPublishedIdx: index('idx_articles_category_published').on(
      table.category,
      table.publishedAt
    ),
    // 平台索引：用于平台筛选
    platformIdx: index('idx_articles_platform').on(table.platform),
    // 平台+评分复合索引：平台筛选+评分排序优化
    platformScoreIdx: index('idx_articles_platform_score').on(table.platform, table.score),
  })
);

/**
 * feedback 表 - 群众审计
 * 存储用户对 AI 评分的主观反馈
 */
export const feedback = sqliteTable(
  'feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    articleId: integer('article_id').notNull(), // 逻辑外键关联 articles.id
    voteType: text('vote_type').notNull(), // 'too_high', 'accurate', 'too_low'
    userHash: text('user_hash').notNull(), // 用户指纹（基于 IP + UA 的 Hash，用于防刷）
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    // 文章索引：快速查询某篇文章的所有反馈
    articleIdx: index('idx_feedback_article').on(table.articleId),
    // 文章+用户复合索引：快速去重/防刷
    articleUserIdx: index('idx_feedback_article_user').on(table.articleId, table.userHash),
    // 创建时间索引：用于时间范围查询
    createdAtIdx: index('idx_feedback_created_at').on(table.createdAt),
  })
);

// 导出类型（供 TypeScript 使用）
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

