// Zimmerwald v1.1 新闻查询与视图映射逻辑
// - 负责从 D1 中查询 articles，并映射为前端 / API 友好的 Article 结构

import { APP_CONFIG } from '../config/app';
import type { Article, ArticleRow, Env, LLMTag, NewsQueryOptions } from './types';
import { getSourceNameFromId } from './sources';

/**
 * 获取新闻列表（从 v1.1 宽表映射到前端视图模型）
 */
export async function getNews(env: Env, options: NewsQueryOptions): Promise<Article[]> {
  const limit = options.limit ?? APP_CONFIG.newsListLimit;

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (typeof options.minScore === 'number') {
    conditions.push('score >= ?');
    params.push(options.minScore);
  }

  if (options.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }

  if (options.tag && options.tag.trim().length > 0) {
    // 简单模糊匹配：在 JSON 文本中查找中英文任意一侧包含该关键词
    conditions.push('tags LIKE ?');
    params.push(`%${options.tag.trim()}%`);
  }

  let sql = `SELECT * FROM articles`;
  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }
  sql += ` ORDER BY score DESC, published_at DESC, created_at DESC LIMIT ?`;
  params.push(limit);

  const result = await env.DB.prepare(sql).bind(...params).all<ArticleRow>();

  const rows: ArticleRow[] = result.results || [];

  // 映射为前端友好的 Article 结构（兼容 v1.0 页面展示）
  const mapped: Article[] = rows.map((row) => {
    const title =
      (row.title_zh && row.title_zh.trim().length > 0 && row.title_zh) ||
      (row.title_en && row.title_en.trim().length > 0 && row.title_en) ||
      '(无标题)';

    const summary =
      (row.summary_zh && row.summary_zh.trim().length > 0 && row.summary_zh) ||
      (row.summary_en && row.summary_en.trim().length > 0 && row.summary_en) ||
      undefined;

    const source_id = row.source_id;
    const source_name = getSourceNameFromId(source_id);

    // 尝试解析 tags JSON，用于 API 消费方直接使用
    let parsedTags: LLMTag[] = [];
    if (row.tags) {
      try {
        const arr = JSON.parse(row.tags) as Array<{ en?: string; zh?: string }>;
        if (Array.isArray(arr)) {
          parsedTags = arr
            .map((t) => ({
              en: (t.en || '').trim(),
              zh: (t.zh || '').trim(),
            }))
            .filter((t) => t.en || t.zh);
        }
      } catch {
        // 单条解析失败不影响整体
      }
    }

    return {
      id: row.id,
      url: row.url,
      source_id,
      source_name,
      title,
      summary,
      category: row.category ?? undefined,
      score: row.score ?? null,
      published_at: row.published_at ?? null,
      created_at: row.created_at,
      // 额外暴露的原始双语与标签信息
      title_en: row.title_en ?? null,
      title_zh: row.title_zh ?? null,
      summary_en: row.summary_en ?? null,
      summary_zh: row.summary_zh ?? null,
      tags_json: row.tags ?? null,
      tags: parsedTags,
      ai_reasoning: row.ai_reasoning ?? null,
    };
  });

  return mapped;
}


