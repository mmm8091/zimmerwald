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
    maxScore?: number;
    tag?: string; // 兼容旧版本
    tags?: string[]; // 新版本：多个标签（OR 逻辑）
    category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
    platform?: 'News' | 'Twitter' | 'Telegram';
    limit?: number;
    offset?: number;
    since?: number;
    search?: string;
  }
): Promise<Article[]> {
  const d = getDb(db);
  const conditions = [];

  // 分数范围筛选
  if (typeof options.minScore === 'number' && options.minScore > 0) {
    conditions.push(and(isNotNull(articles.score), gte(articles.score, options.minScore)));
  }
  if (typeof options.maxScore === 'number' && options.maxScore < 100) {
    conditions.push(and(isNotNull(articles.score), sql`${articles.score} <= ${options.maxScore}`));
  }

  if (options.category) {
    conditions.push(eq(articles.category, options.category));
  }

  if (options.platform) {
    conditions.push(eq(articles.platform, options.platform));
  }

  // 支持多标签筛选（OR 逻辑）
  // 使用 SQLite JSON 函数进行精确匹配
  if (options.tags && options.tags.length > 0) {
    // #region agent log
    console.log(JSON.stringify({location:'db.ts:119',message:'Processing tags filter',data:{tags:options.tags,tagsLength:options.tags.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'}));
    // #endregion
    console.log('[getNews] 开始处理标签筛选，标签列表:', options.tags);
    // 使用 OR 逻辑：文章包含任意一个标签即可
    const tagConditions: any[] = [];
    for (const tag of options.tags) {
      if (!tag || !tag.trim()) {
        console.log('[getNews] 跳过空标签:', tag);
        continue;
      }
      // 标签格式是 "en|zh"，需要匹配 JSON 数组中的 en 或 zh 字段
      const [en, zh] = tag.split('|');
      const enTrimmed = en?.trim();
      const zhTrimmed = zh?.trim();
      
      console.log('[getNews] 处理标签:', { tag, enTrimmed, zhTrimmed });
      
      // 使用 SQLite JSON 函数：检查 JSON 数组中是否有匹配的标签
      // 使用 sql 模板标签配合参数绑定
      if (enTrimmed && zhTrimmed) {
        const sqlCondition = sql`articles.tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(articles.tags) 
          WHERE json_extract(value, '$.en') = ${enTrimmed} 
             OR json_extract(value, '$.zh') = ${zhTrimmed}
        )`;
        console.log('[getNews] 生成 SQL 条件 (en+zh):', { en: enTrimmed, zh: zhTrimmed });
        tagConditions.push(sqlCondition);
      } else if (enTrimmed) {
        const sqlCondition = sql`articles.tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(articles.tags) 
          WHERE json_extract(value, '$.en') = ${enTrimmed}
        )`;
        console.log('[getNews] 生成 SQL 条件 (en only):', { en: enTrimmed });
        tagConditions.push(sqlCondition);
      } else if (zhTrimmed) {
        const sqlCondition = sql`articles.tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(articles.tags) 
          WHERE json_extract(value, '$.zh') = ${zhTrimmed}
        )`;
        console.log('[getNews] 生成 SQL 条件 (zh only):', { zh: zhTrimmed });
        tagConditions.push(sqlCondition);
      }
    }
    
    if (tagConditions.length > 0) {
      console.log('[getNews] 标签条件数量:', tagConditions.length);
      // 多个标签之间是 AND 关系：文章必须包含所有选中的标签
      if (tagConditions.length === 1) {
        conditions.push(tagConditions[0]);
      } else {
        conditions.push(and(...tagConditions));
      }
      console.log('[getNews] 已添加标签筛选条件（AND 逻辑）');
    } else {
      console.log('[getNews] 警告：没有有效的标签条件');
    }
  } else if (options.tag && options.tag.trim().length > 0) {
    // 兼容旧版本：单个标签
    const [en, zh] = options.tag.split('|');
    const enTrimmed = en?.trim();
    const zhTrimmed = zh?.trim();
    
    if (enTrimmed && zhTrimmed) {
      conditions.push(
        sql`articles.tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(articles.tags) 
          WHERE json_extract(value, '$.en') = ${enTrimmed} 
             OR json_extract(value, '$.zh') = ${zhTrimmed}
        )`
      );
    } else if (enTrimmed) {
      conditions.push(
        sql`articles.tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(articles.tags) 
          WHERE json_extract(value, '$.en') = ${enTrimmed}
        )`
      );
    } else if (zhTrimmed) {
      conditions.push(
        sql`articles.tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(articles.tags) 
          WHERE json_extract(value, '$.zh') = ${zhTrimmed}
        )`
      );
    }
  }

  // since 为 0 或 undefined 表示不限制时间
  if (options.since && options.since > 0) {
    conditions.push(gte(articles.createdAt, options.since));
  }

  // 搜索功能：在标题、摘要、标签、信源名称中搜索
  if (options.search && options.search.trim()) {
    // #region agent log
    console.log(JSON.stringify({location:'db.ts:211',message:'Processing search condition',data:{search:options.search},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'}));
    // #endregion
    const searchKeyword = options.search.trim();
    const searchTerm = `%${searchKeyword}%`;
    // 使用 OR 连接多个字段的搜索条件
    const searchConditions = [
      like(articles.titleEn, searchTerm),
      like(articles.titleZh, searchTerm),
      like(articles.summaryEn, searchTerm),
      like(articles.summaryZh, searchTerm),
      // 标签搜索：使用 JSON 函数检查 tags 字段
      sql`articles.tags IS NOT NULL AND EXISTS (
        SELECT 1 FROM json_each(articles.tags) 
        WHERE json_extract(value, '$.en') LIKE ${searchTerm} 
           OR json_extract(value, '$.zh') LIKE ${searchTerm}
      )`,
      // 信源名称搜索：需要通过 JOIN sources 表
      sql`EXISTS (
        SELECT 1 FROM sources 
        WHERE sources.slug = articles.source_id 
          AND sources.name LIKE ${searchTerm}
      )`,
    ];
    conditions.push(or(...searchConditions));
    // #region agent log
    console.log(JSON.stringify({location:'db.ts:233',message:'Search condition added',data:{searchKeyword,searchTerm,conditionsCount:conditions.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'}));
    // #endregion
    console.log('[getNews] 添加搜索条件:', searchKeyword, '搜索词:', searchTerm);
  }

  let query = d
    .select()
    .from(articles)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(articles.score), desc(articles.publishedAt), desc(articles.createdAt));

  // 分页支持
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  query = query.limit(limit).offset(offset);

  console.log('[getNews] 查询条件数量:', conditions.length);
  console.log('[getNews] 查询参数:', { 
    minScore: options.minScore,
    maxScore: options.maxScore,
    tags: options.tags, 
    category: options.category, 
    platform: options.platform, 
    since: options.since,
    search: options.search,
    limit: options.limit,
    offset: options.offset,
  });
  
  const sqlQuery = query.toSQL();
  console.log('[getNews] 生成的 SQL:', sqlQuery.sql);
  console.log('[getNews] SQL 参数:', sqlQuery.params);
  
  const result = await query.all();
  console.log('[getNews] 查询结果数量:', result.length);
  
  return result;
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


