// Zimmerwald v1.2 数据库服务层 (Drizzle ORM)
// 封装所有数据库操作，使用 Drizzle 查询构建器

import { drizzle } from 'drizzle-orm/d1';
import { and, gte, like, sql, desc, eq, or, isNotNull } from 'drizzle-orm';
import { articles, feedback, type Article, type NewArticle, type NewFeedback } from '../db/schema';
import type { LLMTag } from './types';

/**
 * 初始化 Drizzle 数据库实例
 */
export function getDb(db: D1Database) {
  return drizzle(db);
}

/**
 * 从最近 7 天的文章中提取热门标签 (Top 30)
 * Context Loop: 用于注入到 AI Prompt
 */
export async function getTopTags(db: D1Database, days: number = 7, limit: number = 30): Promise<LLMTag[]> {
  const d = getDb(db);
  const now = Date.now();
  const daysAgo = now - days * 24 * 60 * 60 * 1000;

  // 查询最近 N 天的文章
  const recentArticles = await d
    .select({ tags: articles.tags })
    .from(articles)
    .where(and(gte(articles.createdAt, daysAgo), sql`${articles.tags} IS NOT NULL`))
    .all();

  // 统计标签频次
  const freq = new Map<string, { en: string; zh: string; count: number }>();

  for (const row of recentArticles) {
    if (!row.tags) continue;
    try {
      const parsed = JSON.parse(row.tags) as Array<{ en?: string; zh?: string }>;
      if (!Array.isArray(parsed)) continue;

      for (const t of parsed) {
        const en = (t.en || '').trim();
        const zh = (t.zh || '').trim();
        if (!en && !zh) continue;

        const key = `${en}|||${zh}`;
        const existing = freq.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          freq.set(key, { en, zh, count: 1 });
        }
      }
    } catch {
      // 忽略解析错误
      continue;
    }
  }

  // 按频次排序，取前 N 个
  return Array.from(freq.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => ({ en: t.en, zh: t.zh }));
}

/**
 * 检查 URL 是否已存在
 */
export async function urlExists(db: D1Database, url: string): Promise<boolean> {
  const d = getDb(db);
  const result = await d.select({ id: articles.id }).from(articles).where(eq(articles.url, url)).limit(1).get();
  return !!result;
}

/**
 * 保存文章到数据库
 */
export async function saveArticle(db: D1Database, article: NewArticle): Promise<void> {
  const d = getDb(db);
  await d.insert(articles).values(article);
}

/**
 * 查询新闻列表（支持筛选）
 */
export async function getNews(
  db: D1Database,
  options: {
    minScore?: number;
    tag?: string;
    category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
    limit?: number;
  }
): Promise<Article[]> {
  const d = getDb(db);
  const conditions = [];

  if (typeof options.minScore === 'number') {
    // 处理 null score：如果 minScore > 0，只显示有评分的文章；如果 minScore = 0，显示所有文章（包括 null）
    if (options.minScore > 0) {
      conditions.push(and(isNotNull(articles.score), gte(articles.score, options.minScore)));
    }
    // 如果 minScore = 0，不添加条件，显示所有文章
  }

  if (options.category) {
    conditions.push(eq(articles.category, options.category));
  }

  if (options.tag && options.tag.trim().length > 0) {
    // 模糊匹配标签 JSON
    conditions.push(like(articles.tags, `%${options.tag.trim()}%`));
  }

  const query = d
    .select()
    .from(articles)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(articles.score), desc(articles.publishedAt), desc(articles.createdAt))
    .limit(options.limit ?? 30);

  return await query.all();
}

/**
 * 添加反馈投票
 */
export async function upsertFeedback(db: D1Database, feedbackData: NewFeedback): Promise<void> {
  const d = getDb(db);

  // 检查是否已存在
  const existing = await d
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.articleId, feedbackData.articleId), eq(feedback.userHash, feedbackData.userHash)))
    .limit(1)
    .get();

  if (existing) {
    // 更新现有记录
    await d
      .update(feedback)
      .set({ voteType: feedbackData.voteType, createdAt: feedbackData.createdAt })
      .where(eq(feedback.id, existing.id));
  } else {
    // 插入新记录
    await d.insert(feedback).values(feedbackData);
  }
}

/**
 * 检查文章是否存在
 */
export async function articleExists(db: D1Database, articleId: number): Promise<boolean> {
  const d = getDb(db);
  const result = await d.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1).get();
  return !!result;
}

/**
 * 生成简易哈希（用于 user_hash）
 */
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

