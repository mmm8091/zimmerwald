/**
 * 定时任务调度器
 * 处理 RSS 抓取和文章分析任务
 */

import { ENABLED_RSS_SOURCES } from './config/rss-sources';
import { SCHEDULER_CONFIG } from './config/scheduler';
import { ArticleRow, Env } from './core/types';
import { saveArticle, urlExists } from './core/db';
import { fetchRSSFeed, parseDate } from './core/rss';
import { callLLM } from './core/llm';
import { getSourceIdFromName } from './core/sources';

/**
 * 处理定时任务：抓取 RSS 并分析（限制处理数量，用于测试）
 */
export async function handleScheduledLimited(event: ScheduledEvent, env: Env, maxItems: number = 5): Promise<void> {
  const { delayBetweenArticles } = SCHEDULER_CONFIG;
  console.log(`开始执行定时任务（限制处理 ${maxItems} 篇文章）...`);

  let totalProcessed = 0;

  for (const source of ENABLED_RSS_SOURCES) {
    if (totalProcessed >= maxItems) {
      console.log(`已达到处理限制（${maxItems} 篇），停止处理`);
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

    for (const item of items) {
      if (totalProcessed >= maxItems) {
        console.log(`已达到处理限制（${maxItems} 篇），停止处理当前源`);
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
      const description =
        item.description ||
        item['content:encoded'] ||
        '';

      // 调用 LLM 分析
      console.log(`[${processedCount + 1}/${items.length}] 正在分析文章: ${item.title}`);
      const analysis = await callLLM(item.title, description, env);

      if (!analysis) {
        errorCount++;
        console.warn(`LLM 分析失败，跳过文章: ${item.title}`);
        continue;
      }

      // 保存到数据库（v1.1 宽表结构）
      const publishedAt = parseDate(item.pubDate);
      const article: ArticleRow = {
        url: item.link,
        source_id: getSourceIdFromName(source.name),
        published_at: publishedAt ?? null,
        created_at: Date.now(),
        // 使用 LLM 提供的双语与标签信息
        title_en: item.title || null,
        title_zh: analysis.title_zh || null,
        summary_en: analysis.summary_en || null,
        summary_zh: analysis.summary_zh || null,
        category: analysis.category,
        tags: analysis.tags && analysis.tags.length > 0 ? JSON.stringify(analysis.tags) : null,
        score: analysis.score,
        ai_reasoning: analysis.ai_reasoning || null,
      };

      try {
        await saveArticle(env.DB, article);
        processedCount++;
        totalProcessed++;
        console.log(`✅ 成功保存文章 (${processedCount}/${items.length}, 总计 ${totalProcessed}/${maxItems}): ${item.title}`);
      } catch (error) {
        // 处理竞态条件：如果多个 Worker 同时处理同一篇文章，可能会出现 UNIQUE 约束错误
        // 这种情况应该视为"已存在"，而不是真正的错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('UNIQUE constraint') && errorMessage.includes('articles.url')) {
          skippedCount++;
          if (skippedCount <= 3) {
            console.log(`⚠️ 文章已存在（并发插入冲突）: ${item.title}`);
          }
        } else {
          errorCount++;
          console.error(`❌ 保存文章失败: ${item.title}`, error);
        }
      }

      // 添加延迟以避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, delayBetweenArticles));
    }

    console.log(`${source.name} 处理完成: 新增 ${processedCount} 篇, 跳过 ${skippedCount} 篇, 错误 ${errorCount} 篇`);
  }

  console.log(`✅ 定时任务完成（共处理 ${totalProcessed} 篇文章）`);
}

/**
 * 处理定时任务：抓取 RSS 并分析（完整版本，用于生产环境）
 * 优化：分批处理以避免 Cloudflare Workers 子请求限制（付费版：1000个）
 */
export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  console.log(`开始执行定时任务（共 ${ENABLED_RSS_SOURCES.length} 个 RSS 源）...`);
  
  // 使用配置文件中的调度器配置
  const { maxSourcesPerRun, maxArticlesPerSource, maxTotalArticles, delayBetweenArticles } = SCHEDULER_CONFIG;

  let totalProcessed = 0;
  let sourcesProcessed = 0;

  for (const source of ENABLED_RSS_SOURCES) {
    // 限制每次运行的源数量
      if (sourcesProcessed >= maxSourcesPerRun) {
        console.log(`已达到源处理限制（${maxSourcesPerRun} 个），本次运行停止`);
      break;
    }

    // 限制总文章数量
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

    // 限制每个源处理的文章数量
    const itemsToProcess = items.slice(0, maxArticlesPerSource);
    console.log(`限制处理前 ${itemsToProcess.length} 篇文章（共 ${items.length} 篇）`);

    for (const item of itemsToProcess) {
      // 再次检查总限制
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
      const description =
        item.description ||
        item['content:encoded'] ||
        '';

      // 调用 LLM 分析
      console.log(`[${processedCount + 1}/${itemsToProcess.length}] 正在分析文章: ${item.title}`);
      const analysis = await callLLM(item.title, description, env);

      if (!analysis) {
        errorCount++;
        console.warn(`LLM 分析失败，跳过文章: ${item.title}`);
        continue;
      }

      // 保存到数据库（v1.1 宽表结构）
      const publishedAt = parseDate(item.pubDate);
      const article: ArticleRow = {
        url: item.link,
        source_id: getSourceIdFromName(source.name),
        published_at: publishedAt ?? null,
        created_at: Date.now(),
        title_en: item.title || null,
        title_zh: analysis.title_zh || null,
        summary_en: analysis.summary_en || null,
        summary_zh: analysis.summary_zh || null,
        category: analysis.category,
        tags: analysis.tags && analysis.tags.length > 0 ? JSON.stringify(analysis.tags) : null,
        score: analysis.score,
        ai_reasoning: analysis.ai_reasoning || null,
      };

      try {
        await saveArticle(env.DB, article);
        processedCount++;
        totalProcessed++;
        console.log(`✅ 成功保存文章 (${processedCount}/${itemsToProcess.length}, 总计 ${totalProcessed}/${maxTotalArticles}): ${item.title}`);
      } catch (error) {
        // 处理竞态条件：如果多个 Worker 同时处理同一篇文章，可能会出现 UNIQUE 约束错误
        // 这种情况应该视为"已存在"，而不是真正的错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('UNIQUE constraint') && errorMessage.includes('articles.url')) {
          skippedCount++;
          if (skippedCount <= 3) {
            console.log(`⚠️ 文章已存在（并发插入冲突）: ${item.title}`);
          }
        } else {
          errorCount++;
          console.error(`❌ 保存文章失败: ${item.title}`, error);
        }
      }

      // 添加延迟以避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, delayBetweenArticles));
    }

    sourcesProcessed++;
    console.log(`${source.name} 处理完成: 新增 ${processedCount} 篇, 跳过 ${skippedCount} 篇, 错误 ${errorCount} 篇`);
  }

  console.log(`✅ 定时任务完成（处理了 ${sourcesProcessed} 个源，共 ${totalProcessed} 篇文章）`);
  console.log(`💡 提示：Cloudflare Workers 付费版支持 1000 个子请求，本次运行处理了 ${sourcesProcessed} 个源，${totalProcessed} 篇文章。`);
}

