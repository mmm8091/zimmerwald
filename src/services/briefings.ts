// Zimmerwald v1.5 每日简报服务
// 生成每日情报摘要和统计

import OpenAI from 'openai';
import { getDb } from './db';
import { articles, dailyBriefings, type NewDailyBriefing } from '../db/schema';
import { and, gte, desc, sql, eq } from 'drizzle-orm';
import type { Env } from './types';
import { BRIEFING_CONFIG, BRIEFING_PROMPT_TEMPLATE } from '../config/prompts';
import { BRIEFING_ALERT_CONFIG } from '../config/app';

/**
 * 生成每日简报
 * 在 UTC 0:00 执行，分析过去 24 小时的数据
 */
export async function generateDailyBriefing(db: D1Database, env: Env): Promise<void> {
  const d = getDb(db);
  const now = Date.now();
  const yesterday = now - 24 * 60 * 60 * 1000; // 24 小时前

  // 1. 收集过去 24 小时的文章
  const recentArticles = await d
    .select()
    .from(articles)
    .where(gte(articles.createdAt, yesterday))
    .orderBy(desc(articles.score), desc(articles.createdAt))
    .all();

  console.log(`[Briefing] 过去 24 小时共 ${recentArticles.length} 篇文章`);

  if (recentArticles.length === 0) {
    console.log('[Briefing] 没有文章，跳过生成');
    return;
  }

  // 2. 统计分析
  const totalAnalyzed = recentArticles.length;
  const highValueArticles = recentArticles.filter((a) => (a.score ?? 0) >= 80);
  const strategicArticles = highValueArticles; // score >= 80
  const highValueCount = highValueArticles.length;

  // 提取关键词（从标签中提取地理标签）
  const geoTagFreq = new Map<string, { en: string; zh: string; count: number }>();
  for (const article of recentArticles) {
    if (!article.tags) continue;
    try {
      const tags = JSON.parse(article.tags) as Array<{ en?: string; zh?: string }>;
      if (!Array.isArray(tags)) continue;

      for (const tag of tags) {
        const en = (tag.en || '').trim();
        const zh = (tag.zh || '').trim();
        if (!en && !zh) continue;

        // 简单判断：如果标签包含常见国家名，认为是地理标签
        const commonCountries = ['USA', 'China', 'Palestine', 'Israel', 'Russia', 'Ukraine', 'France', 'Germany', 'UK', 'India'];
        const isGeo = commonCountries.some((c) => en.includes(c) || zh.includes(c) || en === c || zh === c);

        if (isGeo) {
          const key = en || zh;
          const existing = geoTagFreq.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            geoTagFreq.set(key, { en, zh, count: 1 });
          }
        }
      }
    } catch {
      // ignore parse error
    }
  }

  const topKeywords = Array.from(geoTagFreq.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, BRIEFING_ALERT_CONFIG.topKeywordsCount);

  // 计算战略警戒等级（1-5，1为最高警戒）
  // 基于高价值文章比例和最高分
  const maxScore = Math.max(...recentArticles.map((a) => a.score ?? 0));
  const highValueRatio = highValueCount / totalAnalyzed;
  
  let alertLevel = BRIEFING_ALERT_CONFIG.defaultLevel; // 默认最低
  for (const threshold of BRIEFING_ALERT_CONFIG.thresholds) {
    if (maxScore >= threshold.minScore && highValueRatio >= threshold.minRatio) {
      alertLevel = threshold.level;
      break; // 找到第一个匹配的等级
    }
  }

  // 3. 准备 AI 输入（Top N 高分文章）
  const topArticles = recentArticles
    .filter((a) => (a.score ?? 0) >= BRIEFING_CONFIG.minScoreForBriefing)
    .slice(0, BRIEFING_CONFIG.topArticlesCount)
    .map((a) => ({
      title_zh: a.titleZh || a.titleEn || '',
      title_en: a.titleEn || '',
      summary_zh: a.summaryZh || '',
      summary_en: a.summaryEn || '',
      score: a.score ?? 0,
      category: a.category || '',
    }));

  // 4. 调用 AI 生成摘要
  const dateStr = new Date(now).toISOString().split('T')[0]; // YYYY-MM-DD
  
  // 获取当前警戒等级的标签信息
  const alertLabel = BRIEFING_ALERT_CONFIG.thresholds.find((t) => t.level === alertLevel) || BRIEFING_ALERT_CONFIG.thresholds[BRIEFING_ALERT_CONFIG.thresholds.length - 1];

  // 使用配置的提示词模板
  const briefingPrompt = BRIEFING_PROMPT_TEMPLATE.userZh({
    date: dateStr,
    topArticlesCount: topArticles.length,
    topArticles: topArticles.map((a) => ({
      score: a.score ?? 0,
      title_zh: a.title_zh || a.title_en || '',
      title_en: a.title_en || '',
      summary_zh: a.summary_zh || '',
      summary_en: a.summary_en || '',
    })),
    totalAnalyzed,
    highValueCount,
    strategicCount: strategicArticles.length,
    keywords: topKeywords.map((k) => k.zh || k.en),
    alertLevel,
    alertLevelCode: alertLabel.code,
    alertLevelLabelZh: alertLabel.labelZh,
    alertLevelLabelEn: alertLabel.labelEn,
  });

  const englishPrompt = BRIEFING_PROMPT_TEMPLATE.userEn({
    date: dateStr,
    topArticlesCount: topArticles.length,
    topArticles: topArticles.map((a) => ({
      score: a.score ?? 0,
      title_zh: a.title_zh || a.title_en || '',
      title_en: a.title_en || '',
      summary_zh: a.summary_zh || '',
      summary_en: a.summary_en || '',
    })),
    totalAnalyzed,
    highValueCount,
    strategicCount: strategicArticles.length,
    keywords: topKeywords.map((k) => k.en || k.zh),
    alertLevel,
    alertLevelCode: alertLabel.code,
    alertLevelLabelZh: alertLabel.labelZh,
    alertLevelLabelEn: alertLabel.labelEn,
  });

  let contentZh = '';
  let contentEn = '';

  try {
    // 使用主模型生成中文摘要
    const client = new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_API_BASE || 'https://api.deepseek.com',
    });

    const responseZh = await client.chat.completions.create({
      model: env.AI_MODEL_NAME || 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: BRIEFING_PROMPT_TEMPLATE.systemZh,
        },
        { role: 'user', content: briefingPrompt },
      ],
      temperature: BRIEFING_CONFIG.temperature,
      max_tokens: BRIEFING_CONFIG.maxTokensZh,
    });

    contentZh = responseZh.choices[0]?.message?.content || '';

    // 生成英文摘要
    const responseEn = await client.chat.completions.create({
      model: env.AI_MODEL_NAME || 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: BRIEFING_PROMPT_TEMPLATE.systemEn,
        },
        { role: 'user', content: englishPrompt },
      ],
      temperature: BRIEFING_CONFIG.temperature,
      max_tokens: BRIEFING_CONFIG.maxTokensEn,
    });

    contentEn = responseEn.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('[Briefing] AI 生成失败:', error);
    // 如果 AI 失败，生成简单的统计摘要
    const alertLabel = BRIEFING_ALERT_CONFIG.thresholds.find((t) => t.level === alertLevel);
    contentZh = `## ${dateStr} 每日简报\n\n过去 24 小时共分析了 ${totalAnalyzed} 篇文章，其中高价值情报（≥80分）${highValueCount} 篇。\n\n关键词：${topKeywords.map((k) => k.zh || k.en).join('、')}\n\n战略警戒等级：${alertLabel?.code || 'FOG'}（${alertLabel?.labelZh || '迷雾'}）`;
    contentEn = `## Daily Briefing ${dateStr}\n\nAnalyzed ${totalAnalyzed} articles in the past 24 hours, including ${highValueCount} high-value intelligence (≥80).\n\nKeywords: ${topKeywords.map((k) => k.en || k.zh).join(', ')}\n\nStrategic Alert Level: ${alertLabel?.code || 'FOG'} (${alertLabel?.labelEn || 'FOG'})`;
  }

  // 5. 存储到数据库
  const keyArticleIds = highValueArticles.slice(0, BRIEFING_ALERT_CONFIG.keyArticlesCount).map((a) => a.id);

  const newBriefing: NewDailyBriefing = {
    date: dateStr,
    contentZh,
    contentEn: contentEn || null,
    keyArticleIds: JSON.stringify(keyArticleIds),
    defconLevel: alertLevel, // 数据库字段名保持 defconLevel，但业务逻辑使用 alertLevel（战略警戒等级）
    createdAt: new Date(now), // Drizzle timestamp mode 需要 Date 对象
  };

  try {
    await d.insert(dailyBriefings).values(newBriefing);
    console.log(`[Briefing] 成功生成并存储 ${dateStr} 的简报`);
  } catch (error) {
    // 如果已存在，更新
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('UNIQUE constraint')) {
      await d
        .update(dailyBriefings)
        .set({
          contentZh,
          contentEn: contentEn || null,
          keyArticleIds: JSON.stringify(keyArticleIds),
          defconLevel: alertLevel, // 数据库字段名保持 defconLevel，但业务逻辑使用 alertLevel
        })
        .where(eq(dailyBriefings.date, dateStr));
      console.log(`[Briefing] 更新 ${dateStr} 的简报`);
    } else {
      throw error;
    }
  }
}

/**
 * 获取指定日期的简报
 */
export async function getDailyBriefing(db: D1Database, date?: string): Promise<DailyBriefing | null> {
  const d = getDb(db);
  const targetDate = date || new Date().toISOString().split('T')[0];

  const result = await d.select().from(dailyBriefings).where(eq(dailyBriefings.date, targetDate)).limit(1).all();

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  let keyArticleIds: number[] = [];
  if (row.keyArticleIds) {
    try {
      keyArticleIds = JSON.parse(row.keyArticleIds);
    } catch {
      // ignore
    }
  }

  // 计算统计信息（从关联文章）
  const stats = {
    total_analyzed: 0,
    high_value_count: 0,
    strategic_count: 0,
    top_keywords: [] as Array<{ en: string; zh: string; count: number }>,
  };

  if (keyArticleIds.length > 0) {
    // 这里可以进一步查询关联文章的详细信息
    // 简化处理，返回基本信息
  }

  return {
    date: row.date,
    contentZh: row.contentZh,
    contentEn: row.contentEn || undefined,
    defconLevel: row.defconLevel ?? 5,
    keyArticleIds: keyArticleIds,
    stats,
  };
}

/**
 * 获取最新简报
 */
export async function getLatestBriefing(db: D1Database): Promise<DailyBriefing | null> {
  const d = getDb(db);

  const result = await d
    .select()
    .from(dailyBriefings)
    .orderBy(desc(dailyBriefings.date))
    .limit(1)
    .all();

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  let keyArticleIds: number[] = [];
  if (row.keyArticleIds) {
    try {
      keyArticleIds = JSON.parse(row.keyArticleIds);
    } catch {
      // ignore
    }
  }

  return {
    date: row.date,
    contentZh: row.contentZh,
    contentEn: row.contentEn || undefined,
    defconLevel: row.defconLevel ?? 5,
    keyArticleIds: keyArticleIds,
    stats: {
      total_analyzed: 0,
      high_value_count: 0,
      strategic_count: 0,
      top_keywords: [],
    },
  };
}

/**
 * 获取分数分布直方图数据
 */
export async function getScoreHistogram(
  db: D1Database,
  options: {
    days?: number;
    platform?: 'News' | 'Twitter' | 'Telegram';
    category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
    tags?: string[];
    search?: string;
  } = {}
): Promise<Array<{ bucket: number; count: number }>> {
  const days = options.days ?? 30;
  const since = (days === 0) ? undefined : Date.now() - days * 24 * 60 * 60 * 1000;

  // 构建 WHERE 条件
  const whereConditions: string[] = [];
  const bindValues: any[] = [];

  // 时间筛选
  if (since) {
    whereConditions.push('created_at >= ?');
    bindValues.push(since);
  }

  // 平台筛选
  if (options.platform) {
    whereConditions.push('platform = ?');
    bindValues.push(options.platform);
  }

  // 分类筛选
  if (options.category) {
    whereConditions.push('category = ?');
    bindValues.push(options.category);
  }

  // 标签筛选
  if (options.tags && options.tags.length > 0) {
    const tagConditions: string[] = [];
    for (const tag of options.tags) {
      if (!tag || !tag.trim()) continue;
      const [en, zh] = tag.split('|');
      const enTrimmed = en?.trim();
      const zhTrimmed = zh?.trim();
      
      if (enTrimmed && zhTrimmed) {
        tagConditions.push(`(tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(tags) 
          WHERE json_extract(value, '$.en') = ? 
             OR json_extract(value, '$.zh') = ?
        ))`);
        bindValues.push(enTrimmed, zhTrimmed);
      } else if (enTrimmed) {
        tagConditions.push(`(tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(tags) 
          WHERE json_extract(value, '$.en') = ?
        ))`);
        bindValues.push(enTrimmed);
      } else if (zhTrimmed) {
        tagConditions.push(`(tags IS NOT NULL AND EXISTS (
          SELECT 1 FROM json_each(tags) 
          WHERE json_extract(value, '$.zh') = ?
        ))`);
        bindValues.push(zhTrimmed);
      }
    }
    if (tagConditions.length > 0) {
      whereConditions.push(`(${tagConditions.join(' OR ')})`);
    }
  }

  // 搜索筛选
  if (options.search && options.search.trim()) {
    const searchTerm = `%${options.search.trim()}%`;
    whereConditions.push(`(
      title_en LIKE ? OR title_zh LIKE ? OR 
      summary_en LIKE ? OR summary_zh LIKE ? OR
      (tags IS NOT NULL AND EXISTS (
        SELECT 1 FROM json_each(tags) 
        WHERE json_extract(value, '$.en') LIKE ? 
           OR json_extract(value, '$.zh') LIKE ?
      )) OR
      EXISTS (
        SELECT 1 FROM sources 
        WHERE sources.slug = articles.source_id 
          AND sources.name LIKE ?
      )
    )`);
    bindValues.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // 使用 D1 原生 API 执行复杂查询
  const stmt = db.prepare(`
    SELECT 
      CASE 
        WHEN score IS NULL THEN 0
        WHEN score < 10 THEN 0
        WHEN score < 20 THEN 10
        WHEN score < 30 THEN 20
        WHEN score < 40 THEN 30
        WHEN score < 50 THEN 40
        WHEN score < 60 THEN 50
        WHEN score < 70 THEN 60
        WHEN score < 80 THEN 70
        WHEN score < 90 THEN 80
        ELSE 90
      END as bucket,
      COUNT(*) as count
    FROM articles
    ${whereClause}
    GROUP BY bucket
    ORDER BY bucket;
  `);

  const result = await stmt.bind(...bindValues).all();
  const rows = result.results || [];

  // 确保所有 bucket 都存在（0-90，步长 10）
  const buckets = new Map<number, number>();
  for (let i = 0; i <= 90; i += 10) {
    buckets.set(i, 0);
  }

  for (const row of rows) {
    const bucket = Number(row.bucket || 0);
    const count = Number(row.count || 0);
    buckets.set(bucket, count);
  }

  return Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count }));
}

// 类型定义（前端 API 响应格式）
export interface DailyBriefing {
  date: string;
  contentZh: string;
  contentEn?: string;
  defconLevel: number;
  keyArticleIds: number[];
  stats: {
    total_analyzed: number;
    high_value_count: number;
    strategic_count: number;
    top_keywords: Array<{ en: string; zh: string; count: number }>;
  };
}

