// Zimmerwald v1.3 Worker 入口（ES Module 格式）
// 使用 Hono 路由，支持定时任务抓取 RSS 并调用 AI 分析

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type NewArticle } from './src/db/schema';
import { getNews, urlExists, saveArticle } from './src/services/db';
import { analyzeNews } from './src/services/ai';
import { fetchRSSFeed, parseDate, sanitizeContent } from './src/services/rss';
import { getEnabledRssSources, getRssSourcesByPlatform } from './src/config/rss-sources';
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
app.get('/', (c) => {
  const html = generateHTML();
  return c.html(html);
});

/**
 * GET /api/news - 查询新闻列表
 * 支持筛选参数：min_score, tag, category, platform, limit
 */
app.get('/api/news', async (c) => {
  try {
    const minScoreParam = c.req.query('min_score');
    const tagParam = c.req.query('tag');
    const categoryParam = c.req.query('category');
    const platformParam = c.req.query('platform');
    const limitParam = c.req.query('limit');

    const minScore = minScoreParam ? parseInt(minScoreParam, 10) : undefined;
    const tag = tagParam || undefined;
    const category = categoryParam as 'Labor' | 'Politics' | 'Conflict' | 'Theory' | undefined;
    const platform = platformParam as 'News' | 'Twitter' | 'Telegram' | undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : 30;

    console.log('[/api/news] 查询参数:', { minScore, tag, category, platform, limit });

    const dbArticles = await getNews(c.env.DB, {
      minScore: Number.isNaN(minScore as number) ? undefined : minScore,
      tag,
      category,
      platform,
      limit: Number.isNaN(limit) ? 30 : limit,
    });

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
          // ignore parse error
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
        platform: (row.platform || 'News') as 'News' | 'Twitter' | 'Telegram',
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
 * 定时任务调度器：按平台分组抓取 RSS 并分析
 */
async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  let enabledSources;
  let byPlatform;
  try {
    enabledSources = getEnabledRssSources(env.RSSHUB_BASE);
    byPlatform = getRssSourcesByPlatform(env.RSSHUB_BASE);
  } catch (e) {
    console.error('RSSHUB_BASE 未配置或无效，请在 Cloudflare Vars/Secrets 设置', e);
    return;
  }

  const totalSources = enabledSources.length;
  const newsCount = byPlatform.News.length;
  const twitterCount = byPlatform.Twitter.length;
  const telegramCount = byPlatform.Telegram.length;

  console.log(`开始执行定时任务（共 ${totalSources} 个 RSS 源：News=${newsCount}, Twitter=${twitterCount}, Telegram=${telegramCount}）...`);

  const { maxSourcesPerPlatform, maxArticlesPerSource, maxTotalArticles, delayBetweenArticles } = SCHEDULER_CONFIG;

  let totalProcessed = 0;
  let platformSourcesProcessed = {
    News: 0,
    Twitter: 0,
    Telegram: 0,
  };

  const platforms: Array<{ platform: 'News' | 'Twitter' | 'Telegram'; sources: typeof enabledSources }> = [
    { platform: 'News', sources: byPlatform.News },
    { platform: 'Twitter', sources: byPlatform.Twitter },
    { platform: 'Telegram', sources: byPlatform.Telegram },
  ];

  for (const { platform, sources } of platforms) {
    const maxSourcesForPlatform = maxSourcesPerPlatform[platform];
    console.log(`\n📰 开始处理 ${platform} 平台（共 ${sources.length} 个源，本次处理最多 ${maxSourcesForPlatform} 个）`);

    for (const source of sources) {
      if (platformSourcesProcessed[platform] >= maxSourcesForPlatform) {
        console.log(`已达到 ${platform} 平台源处理限制（${maxSourcesForPlatform} 个），跳过剩余源`);
        break;
      }
      if (totalProcessed >= maxTotalArticles) {
        console.log(`已达到总文章处理限制（${maxTotalArticles} 篇），本次运行停止`);
        return;
      }

      console.log(`正在处理 RSS 源: ${source.name} (${source.url})`);
      const items = await fetchRSSFeed(source.url, source.isRssHub || false);
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

        if (await urlExists(env.DB, item.link)) {
          skippedCount++;
          if (skippedCount <= 3) {
            console.log(`跳过已存在的文章: ${item.title}`);
          }
          continue;
        }

        const rawDescription = item.description || item['content:encoded'] || '';
        const description = sanitizeContent(rawDescription, source.platform);

        console.log(`[${processedCount + 1}/${itemsToProcess.length}] 正在分析文章: ${item.title}`);
        const analysis = await analyzeNews(item.title, description, env);

        if (!analysis) {
          errorCount++;
          console.warn(`AI 分析失败，跳过文章: ${item.title}`);
          continue;
        }

        const publishedAt = parseDate(item.pubDate);
        const article: NewArticle = {
          url: item.link,
          sourceId: source.id || getSourceIdFromName(source.name),
          platform: source.platform,
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
            if (skippedCount === 1) {
              console.log(`⚠️ 检测到并发插入冲突（正常现象，可能多个实例同时处理同一篇文章）`);
            }
          } else {
            errorCount++;
            console.error(`❌ 保存文章失败: ${item.title}`, error);
          }
        }

        if (processedCount < itemsToProcess.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenArticles));
        }
      }

      platformSourcesProcessed[platform]++;
      console.log(
        `✅ ${source.name} (${platform}) 处理完成：成功 ${processedCount} 篇，跳过 ${skippedCount} 篇，错误 ${errorCount} 篇`
      );
    }
  }

  const totalSourcesProcessed =
    platformSourcesProcessed.News + platformSourcesProcessed.Twitter + platformSourcesProcessed.Telegram;
  console.log(`\n✅ 定时任务完成：`);
  console.log(`   - News: ${platformSourcesProcessed.News} 个源`);
  console.log(`   - Twitter: ${platformSourcesProcessed.Twitter} 个源`);
  console.log(`   - Telegram: ${platformSourcesProcessed.Telegram} 个源`);
  console.log(`   - 总计：${totalSourcesProcessed} 个源，${totalProcessed} 篇文章`);
}

/**
 * Cloudflare Worker 导出（ES Modules）
 */
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};



