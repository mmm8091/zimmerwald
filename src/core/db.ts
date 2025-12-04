// Zimmerwald v1.1 数据库相关工具函数
// - 负责与 D1 的直接交互（读写 articles / feedback 等）
// - 不关心 HTTP 层和路由，仅聚焦数据访问与聚合

import { ArticleRow, LLMTag } from './types';

/**
 * 从最近一段时间的文章中提取热门标签，构造用于注入到 Prompt 的 JSON 字符串
 * 当前策略：过去 7 天，按出现频次排序，取前 30 个。
 * 返回值示例：`[{"en":"Strike","zh":"罢工"},{"en":"Election","zh":"选举"}]`
 */
export async function buildExistingTagsPromptFragment(db: D1Database): Promise<string> {
  try {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const result = await db
      .prepare(
        `SELECT tags 
         FROM articles 
         WHERE tags IS NOT NULL AND created_at >= ?`
      )
      .bind(sevenDaysAgo)
      .all<{ tags: string }>();

    const rows = result.results || [];
    if (rows.length === 0) {
      return '[]';
    }

    const freq = new Map<string, { en: string; zh: string; count: number }>();

    for (const row of rows) {
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
        // 忽略单条解析错误，继续统计
        continue;
      }
    }

    const sorted = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 30)
      .map((t) => ({ en: t.en, zh: t.zh }));

    if (sorted.length === 0) {
      return '[]';
    }

    return JSON.stringify(sorted);
  } catch (error) {
    console.error('构建 Existing Tags Prompt 片段时出错:', error);
    // 出错时退化为无热门标签，保持主流程可用
    return '[]';
  }
}

/**
 * 检查 URL 是否已存在
 */
export async function urlExists(db: D1Database, url: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM articles WHERE url = ? LIMIT 1')
    .bind(url)
    .first();
  return !!result;
}

/**
 * 保存文章到数据库（v1.1 宽表结构）
 */
export async function saveArticle(db: D1Database, article: ArticleRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO articles (
         url,
         source_id,
         published_at,
         created_at,
         title_en,
         title_zh,
         summary_en,
         summary_zh,
         category,
         tags,
         score,
         ai_reasoning
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      article.url,
      article.source_id,
      article.published_at ?? null,
      article.created_at,
      article.title_en ?? null,
      article.title_zh ?? null,
      article.summary_en ?? null,
      article.summary_zh ?? null,
      article.category ?? null,
      article.tags ?? null,
      article.score ?? null,
      article.ai_reasoning ?? null
    )
    .run();
}

/**
 * 生成一个简易哈希（用于 user_hash），避免直接存储原始 IP / UA
 * 这里使用一个稳定的字符串哈希算法（非加密，仅用于防刷）
 */
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // 转为 32 位整数
  }
  // 转为无符号 32 位十六进制字符串
  return (hash >>> 0).toString(16);
}


