// Zimmerwald v1.3 数据库服务层 (Drizzle ORM)
// 封装所有数据库操作，使用 Drizzle 查询构建器

import { drizzle } from 'drizzle-orm/d1';
import { and, gte, like, sql, desc, eq, isNotNull, or } from 'drizzle-orm';
import { articles, sources, type Article, type NewArticle, type Source } from '../db/schema';
import type { LLMTag, PlatformType } from './types';

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
    tag?: string; // 兼容旧版本
    tags?: string[]; // 新版本：多个标签（OR 逻辑）
    category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
    platform?: 'News' | 'Twitter' | 'Telegram';
    limit?: number;
    since?: number;
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

  // 支持多标签筛选（OR 逻辑）
  if (options.tags && options.tags.length > 0) {
    // 使用 OR 逻辑：文章包含任意一个标签即可
    const tagConditions: any[] = [];
    for (const tag of options.tags) {
      if (!tag || !tag.trim()) continue;
      // 标签格式是 "en|zh"，需要匹配 JSON 中的 en 或 zh 字段
      const [en, zh] = tag.split('|');
      const enTrimmed = en?.trim();
      const zhTrimmed = zh?.trim();
      
      // 构建匹配条件：匹配 JSON 中的 en 或 zh
      if (enTrimmed && zhTrimmed) {
        // 同时匹配 en 和 zh（任一匹配即可）
        tagConditions.push(
          or(
            like(articles.tags, `%"en":"${enTrimmed}"%`),
            like(articles.tags, `%"zh":"${zhTrimmed}"%`),
            like(articles.tags, `%"en": "${enTrimmed}"%`),
            like(articles.tags, `%"zh": "${zhTrimmed}"%`)
          )
        );
      } else if (enTrimmed) {
        tagConditions.push(
          or(
            like(articles.tags, `%"en":"${enTrimmed}"%`),
            like(articles.tags, `%"en": "${enTrimmed}"%`)
          )
        );
      } else if (zhTrimmed) {
        tagConditions.push(
          or(
            like(articles.tags, `%"zh":"${zhTrimmed}"%`),
            like(articles.tags, `%"zh": "${zhTrimmed}"%`)
          )
        );
      } else {
        // 兜底：直接匹配字符串
        tagConditions.push(like(articles.tags, `%${tag.trim()}%`));
      }
    }
    
    if (tagConditions.length > 0) {
      // 多个标签之间是 OR 关系
      if (tagConditions.length === 1) {
        conditions.push(tagConditions[0]);
      } else {
        conditions.push(or(...tagConditions));
      }
    }
  } else if (options.tag && options.tag.trim().length > 0) {
    // 兼容旧版本：单个标签
    const [en, zh] = options.tag.split('|');
    const enTrimmed = en?.trim();
    const zhTrimmed = zh?.trim();
    if (enTrimmed && zhTrimmed) {
      conditions.push(or(
        like(articles.tags, `%"en":"${enTrimmed}"%`),
        like(articles.tags, `%"zh":"${zhTrimmed}"%`),
        like(articles.tags, `%"en": "${enTrimmed}"%`),
        like(articles.tags, `%"zh": "${zhTrimmed}"%`)
      ));
    } else if (enTrimmed) {
      conditions.push(or(
        like(articles.tags, `%"en":"${enTrimmed}"%`),
        like(articles.tags, `%"en": "${enTrimmed}"%`)
      ));
    } else if (zhTrimmed) {
      conditions.push(or(
        like(articles.tags, `%"zh":"${zhTrimmed}"%`),
        like(articles.tags, `%"zh": "${zhTrimmed}"%`)
      ));
    } else {
      conditions.push(like(articles.tags, `%${options.tag.trim()}%`));
    }
  }

  if (options.since) {
    conditions.push(gte(articles.createdAt, options.since));
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
 * 获取 sources 列表（可选过滤）
 */
export async function getSources(
  db: D1Database,
  options?: { enabledOnly?: boolean; platform?: PlatformType }
): Promise<Source[]> {
  const d = getDb(db);
  const conditions = [];

  if (options?.enabledOnly) {
    conditions.push(eq(sources.enabled, true));
  }
  if (options?.platform) {
    conditions.push(eq(sources.platform, options.platform));
  }

  const query = d.select().from(sources).where(conditions.length ? and(...conditions) : undefined);
  return await query.all();
}

/**
 * 获取已启用的 sources
 */
export async function getEnabledSources(db: D1Database, platform?: PlatformType): Promise<Source[]> {
  return getSources(db, { enabledOnly: true, platform });
}

/**
 * Source 名称映射表（slug -> name）
 */
export async function getSourceNameMap(db: D1Database): Promise<Record<string, string>> {
  const rows = await getSources(db);
  return rows.reduce((acc, cur) => {
    acc[cur.slug] = cur.name;
    return acc;
  }, {} as Record<string, string>);
}

export interface SourceStat {
  slug: string;
  name: string;
  url: string;
  platform: PlatformType;
  enabled: boolean;
  isRssHub: boolean;
  lastFetchedAt: number | null;
  lastStatus: string | null;
  errorCount: number;
  volume30d: number;
  avgScore30d: number;
  strategicValue: number;
}

/**
 * 更新 source 抓取状态
 */
export async function updateSourceStatus(
  db: D1Database,
  slug: string,
  params: { status: string; ok: boolean }
): Promise<void> {
  const now = Date.now();
  const { status, ok } = params;

  // 直接使用 D1 原生 API，避免 Drizzle timestamp 类型问题
  if (ok) {
    await db
      .prepare('UPDATE sources SET last_fetched_at = ?, last_status = ?, error_count = 0 WHERE slug = ?')
      .bind(now, status, slug)
      .run();
  } else {
    await db
      .prepare('UPDATE sources SET last_fetched_at = ?, last_status = ?, error_count = error_count + 1 WHERE slug = ?')
      .bind(now, status, slug)
      .run();
  }
}

/**
 * 获取源统计（近 N 天文章量、均分、贡献指数）
 */
export async function getSourceStats(db: D1Database, days: number = 30): Promise<SourceStat[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // 直接使用 D1 原生 API，因为 Drizzle 不支持复杂 JOIN + GROUP BY
  const stmt = db.prepare(`
    SELECT 
      s.slug,
      s.name,
      s.url,
      s.platform,
      s.enabled,
      s.is_rsshub as isRssHub,
      s.last_fetched_at as lastFetchedAt,
      s.last_status as lastStatus,
      s.error_count as errorCount,
      COALESCE(COUNT(a.id), 0) as volume30d,
      COALESCE(AVG(a.score), 0) as avgScore30d,
      COALESCE(SUM(a.score), 0) as sumScore30d
    FROM sources s
    LEFT JOIN articles a
      ON a.source_id = s.slug
     AND a.created_at >= ?
    GROUP BY s.slug
    ORDER BY s.enabled DESC, s.platform, s.slug;
  `);

  const result = await stmt.bind(since).all();
  const rows = result.results || [];

  // 处理 D1 返回的类型（字符串转数字）
  return rows.map((r: any) => {
    const volume30d = Number(r.volume30d || 0);
    const avgScore30d = Number(r.avgScore30d || 0);
    const strategicValue = Math.round((avgScore30d / 100) * volume30d * 100) / 100; // 两位小数
    return {
      slug: r.slug,
      name: r.name,
      url: r.url,
      platform: r.platform as PlatformType,
      enabled: Boolean(r.enabled),
      isRssHub: Boolean(r.isRssHub),
      lastFetchedAt: r.lastFetchedAt ? Number(r.lastFetchedAt) : null,
      lastStatus: r.lastStatus ?? null,
      errorCount: Number(r.errorCount || 0),
      volume30d,
      avgScore30d,
      strategicValue,
    } as SourceStat;
  });
}


