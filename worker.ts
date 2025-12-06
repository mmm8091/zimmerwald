// Zimmerwald v1.2 Worker 入口
// 使用 Hono 框架处理路由，Cron 调度器处理定时任务

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type NewArticle, type NewFeedback } from './src/db/schema';
import { getNews, urlExists, saveArticle, articleExists, upsertFeedback, simpleHash } from './src/services/db';
import { analyzeNews } from './src/services/ai';
import { fetchRSSFeed, parseDate } from './src/services/rss';
import { ENABLED_RSS_SOURCES } from './src/config/rss-sources';
import { SCHEDULER_CONFIG } from './src/config/scheduler';
import { getSourceIdFromName, getSourceNameFromId } from './src/core/sources';
import type { Env } from './src/services/types';
import { generateHTML } from './src/frontend/html';

// 初始化 Hono App
const app = new Hono<{ Bindings: Env }>();

// 启用 CORS
app.use('/*', cors());

/**
 * 首页：返回前端 HTML
 */
app.get('/', (c: any) => {
  const html = generateHTML();
  return c.html(html);
});

/**
 * GET /api/news - 查询新闻列表
 * 支持筛选参数：min_score, tag, category, limit
 */
app.get('/api/news', async (c: any) => {
  try {
    const minScoreParam = c.req.query('min_score');
    const tagParam = c.req.query('tag');
    const categoryParam = c.req.query('category');
    const limitParam = c.req.query('limit');

    const minScore = minScoreParam ? parseInt(minScoreParam, 10) : undefined;
    const tag = tagParam || undefined;
    const category = categoryParam as 'Labor' | 'Politics' | 'Conflict' | 'Theory' | undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : 30;

    console.log('[/api/news] 查询参数:', { minScore, tag, category, limit });

    const dbArticles = await getNews(c.env.DB, {
      minScore: Number.isNaN(minScore as number) ? undefined : minScore,
      tag,
      category,
      limit: Number.isNaN(limit) ? 30 : limit,
    });

    // 转换为前端友好的格式
    const mapped = dbArticles.map((row) => {
      const title =
        (row.titleZh && row.titleZh.trim().length > 0 && row.titleZh) ||
        (row.titleEn && row.titleEn.trim().length > 0 && row.titleEn) ||
        '(无标题)';

      const summary =
        (row.summaryZh && row.summaryZh.trim().length > 0 && row.summaryZh) ||
        (row.summaryEn && row.summaryEn.trim().length > 0 && row.summaryEn) ||
        undefined;

      let parsedTags: Array<{ en: string; zh: string }> = [];
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
          // 忽略解析错误
        }
      }

      return {
        id: row.id,
        url: row.url,
        source_id: row.sourceId,
        source_name: getSourceNameFromId(row.sourceId),
        title,
        summary,
        category: row.category ?? undefined,
        score: row.score ?? null,
        published_at: row.publishedAt ?? null,
        created_at: row.createdAt,
        title_en: row.titleEn ?? null,
        title_zh: row.titleZh ?? null,
        summary_en: row.summaryEn ?? null,
        summary_zh: row.summaryZh ?? null,
        tags_json: row.tags ?? null,
        tags: parsedTags,
        ai_reasoning: row.aiReasoning ?? null,
      };
    });

    console.log('[/api/news] 返回文章数量:', mapped.length);
    return c.json(mapped);
  } catch (error) {
    console.error('[/api/news] 处理请求时出错:', error);
    return c.json({ error: error instanceof Error ? error.message : '未知错误', success: false }, 500);
  }
});

/**
 * POST /api/feedback - 提交投票反馈
 */
app.post('/api/feedback', async (c: any) => {
  try {
    const body = (await c.req.json()) as { article_id?: number; vote_type?: string };
    const articleId = body.article_id;
    const voteType = body.vote_type;

    if (!articleId || typeof articleId !== 'number') {
      return c.json({ success: false, message: '缺少或非法的 article_id' }, 400);
    }

    const validVoteTypes = ['too_high', 'accurate', 'too_low'] as const;
    if (!voteType || !validVoteTypes.includes(voteType as any)) {
      return c.json({ success: false, message: '缺少或非法的 vote_type' }, 400);
    }

    // 检查文章是否存在
    if (!(await articleExists(c.env.DB, articleId))) {
      return c.json({ success: false, message: '文章不存在' }, 404);
    }

    // 生成 user_hash
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown_ip';
    const ua = c.req.header('User-Agent') || 'unknown_ua';
    const userHash = simpleHash(`${ip}|${ua}`);

    // 插入或更新反馈
    await upsertFeedback(c.env.DB, {
      articleId,
      voteType,
      userHash,
      createdAt: Date.now(),
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('处理 /api/feedback 时出错:', error);
    return c.json({ success: false, message: '内部错误' }, 500);
  }
});

/**
 * 定时任务调度器：抓取 RSS 并分析
 */
async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  console.log(`开始执行定时任务（共 ${ENABLED_RSS_SOURCES.length} 个 RSS 源）...`);

  const { maxSourcesPerRun, maxArticlesPerSource, maxTotalArticles, delayBetweenArticles } = SCHEDULER_CONFIG;

  let totalProcessed = 0;
  let sourcesProcessed = 0;

  for (const source of ENABLED_RSS_SOURCES) {
    if (sourcesProcessed >= maxSourcesPerRun) {
      console.log(`已达到源处理限制（${maxSourcesPerRun} 个），本次运行停止`);
      break;
    }

    if (totalProcessed >= maxTotalArticles) {
      console.log(`已达到总文章处理限制（${maxTotalArticles} 篇），本次运行停止`);
      break;
    }

    console.log(`正在处理 RSS 源: ${source.name} (${source.url})`);
    const items = await fetchRSSFeed(source.url);
    console.log(`从 ${source.name} 获取到 ${items.length} 篇文章`);

    if (items.length === 0) {
      console.warn(`警告: ${source.name} 没有获取到任何文章，跳过`);
      continue;
    }

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const itemsToProcess = items.slice(0, maxArticlesPerSource);
    console.log(`限制处理前 ${itemsToProcess.length} 篇文章（共 ${items.length} 篇）`);

    for (const item of itemsToProcess) {
      if (totalProcessed >= maxTotalArticles) {
        console.log(`已达到总文章处理限制（${maxTotalArticles} 篇），停止处理当前源`);
        break;
      }

      if (!item.link || !item.title) {
        continue;
      }

      // 检查是否已存在
      if (await urlExists(env.DB, item.link)) {
        skippedCount++;
        if (skippedCount <= 3) {
          console.log(`跳过已存在的文章: ${item.title}`);
        }
        continue;
      }

      // 准备文章内容
      const description = item.description || item['content:encoded'] || '';

      // 调用 AI 分析
      console.log(`[${processedCount + 1}/${itemsToProcess.length}] 正在分析文章: ${item.title}`);
      const analysis = await analyzeNews(item.title, description, env);

      if (!analysis) {
        errorCount++;
        console.warn(`AI 分析失败，跳过文章: ${item.title}`);
        continue;
      }

      // 保存到数据库
      const publishedAt = parseDate(item.pubDate);
      const article: NewArticle = {
        url: item.link,
        sourceId: getSourceIdFromName(source.name),
        publishedAt: publishedAt ?? Date.now(),
        createdAt: Date.now(),
        titleEn: item.title || '',
        titleZh: analysis.title_zh || '',
        summaryEn: analysis.summary_en || null,
        summaryZh: analysis.summary_zh || null,
        category: analysis.category || null,
        tags: analysis.tags && analysis.tags.length > 0 ? JSON.stringify(analysis.tags) : null,
        score: analysis.score || null,
        aiReasoning: analysis.ai_reasoning || null,
      };

      try {
        await saveArticle(env.DB, article);
        processedCount++;
        totalProcessed++;
        console.log(
          `✅ 成功保存文章 (${processedCount}/${itemsToProcess.length}, 总计 ${totalProcessed}/${maxTotalArticles}): ${item.title}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('UNIQUE constraint') && errorMessage.includes('articles.url')) {
          skippedCount++;
          // 只在第一次遇到时记录日志，避免日志过多
          if (skippedCount === 1) {
            console.log(`⚠️ 检测到并发插入冲突（这是正常的，多个 Worker 实例可能同时处理同一篇文章）`);
          }
        } else {
          errorCount++;
          console.error(`❌ 保存文章失败: ${item.title}`, error);
        }
      }

      // 延迟以避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, delayBetweenArticles));
    }

    sourcesProcessed++;
    console.log(
      `${source.name} 处理完成: 新增 ${processedCount} 篇, 跳过 ${skippedCount} 篇, 错误 ${errorCount} 篇`
    );
  }

  console.log(`✅ 定时任务完成（处理了 ${sourcesProcessed} 个源，共 ${totalProcessed} 篇文章）`);
}

/**
 * Cloudflare Worker 导出
 */
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

