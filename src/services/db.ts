// Zimmerwald v1.3 数据库服务层 (Drizzle ORM)
// 封装所有数据库操作，使用 Drizzle 查询构建器

import { drizzle } from 'drizzle-orm/d1';
import { and, gte, like, sql, desc, eq, isNotNull } from 'drizzle-orm';
import { articles, type Article, type NewArticle } from '../db/schema';
import type { LLMTag } from './types';

/**
 * 初始化 Drizzle 数据库实例
 */
export function getDb(db: D1Database) {
  return drizzle(db);
}

/**
 * 从最近 N 天的文章中提取热门标签 (Top 30)
 * 用于 LLM Prompt 的上下文注入
 */
export async function getTopTags(db: D1Database, days: number = 7, limit: number = 30): Promise<LLMTag[]> {
  const d = getDb(db);
  const now = Date.now();
  const daysAgo = now - days * 24 * 60 * 60 * 1000;

  const recentArticles = await d
    .select({ tags: articles.tags })
    .from(articles)
    .where(and(gte(articles.createdAt, daysAgo), sql`${articles.tags} IS NOT NULL`))
    .all();

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
      continue;
    }
  }

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
    platform?: 'News' | 'Twitter' | 'Telegram';
    limit?: number;
  }
): Promise<Article[]> {
  const d = getDb(db);
  const conditions = [];

  if (typeof options.minScore === 'number') {
    if (options.minScore > 0) {
      conditions.push(and(isNotNull(articles.score), gte(articles.score, options.minScore)));
    }
  }

  if (options.category) {
    conditions.push(eq(articles.category, options.category));
  }

  if (options.platform) {
    conditions.push(eq(articles.platform, options.platform));
  }

  if (options.tag && options.tag.trim().length > 0) {
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


