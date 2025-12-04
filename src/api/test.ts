/**
 * 测试端点处理器
 * 用于开发和调试的各种测试接口
 */

import { ENABLED_RSS_SOURCES } from '../config/rss-sources';
import { APP_CONFIG } from '../config/app';
import { LLM_CONFIG } from '../config/llm';
import { buildExistingTagsPromptFragment } from '../core/db';
import { fetchRSSFeed } from '../core/rss';
import { callLLM } from '../core/llm';
import { handleScheduledLimited } from '../scheduler';
import type { Env } from '../core/types';

/**
 * 批量测试所有 RSS 源
 */
export async function handleTestAllRss(env: Env): Promise<Response> {
  const results = [];
  console.log(`开始批量测试 ${ENABLED_RSS_SOURCES.length} 个 RSS 源...`);
  
  for (const source of ENABLED_RSS_SOURCES) {
    try {
      console.log(`测试 RSS 源: ${source.name}`);
      const items = await fetchRSSFeed(source.url);
      results.push({
        name: source.name,
        url: source.url,
        success: true,
        itemsCount: items.length,
        status: items.length > 0 ? '可用' : '无文章',
      });
    } catch (error) {
      results.push({
        name: source.name,
        url: source.url,
        success: false,
        itemsCount: 0,
        error: error instanceof Error ? error.message : '未知错误',
        status: '失败',
      });
    }
  }
  
  const successCount = results.filter(r => r.success && r.itemsCount > 0).length;
  const totalItems = results.reduce((sum, r) => sum + r.itemsCount, 0);
  
  return new Response(
    JSON.stringify({
      success: true,
      totalSources: ENABLED_RSS_SOURCES.length,
      successCount: successCount,
      totalItems: totalItems,
      results: results,
      summary: `共测试 ${ENABLED_RSS_SOURCES.length} 个源，${successCount} 个可用，共 ${totalItems} 篇文章`,
    }),
    {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
}

/**
 * 测试 LLM API 调用
 */
export async function handleTestLlm(env: Env, url: URL): Promise<Response> {
  const testTitle = url.searchParams.get('title') || '测试标题：工人在工厂举行罢工';
  const testDescription = url.searchParams.get('description') || '这是一篇测试新闻，描述工人为争取更好的工作条件而举行罢工。';
  
  try {
    // 检查必要的环境变量
    if (!env.AI_API_KEY || !env.AI_API_BASE || !env.AI_MODEL_NAME) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '缺少必要的环境变量配置',
          missing: {
            AI_API_KEY: !env.AI_API_KEY,
            AI_API_BASE: !env.AI_API_BASE,
            AI_MODEL_NAME: !env.AI_MODEL_NAME,
          },
          hint: '请在 Cloudflare Dashboard 中设置 Secrets，或使用 wrangler secret put 命令',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    console.log('开始测试 LLM API 调用...');
    console.log('API 配置:', {
      base: env.AI_API_BASE,
      model: env.AI_MODEL_NAME,
      type: env.AI_API_TYPE || 'openai',
    });
    
    // 直接使用 callLLM 函数（它会处理不同 API 类型的差异）
    const analysis = await callLLM(testTitle, testDescription, env);
    
    if (!analysis) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'LLM API 调用失败或返回空结果',
          config: {
            api_base: env.AI_API_BASE,
            model: env.AI_MODEL_NAME,
            api_type: env.AI_API_TYPE || 'openai',
          },
          hint: '请检查 Cloudflare Dashboard 日志查看详细错误信息',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'LLM API 调用成功',
        analysis: analysis,
        config: {
          api_base: env.AI_API_BASE,
          model: env.AI_MODEL_NAME,
          api_type: env.AI_API_TYPE || 'openai',
        },
      }),
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  } catch (error) {
    console.error('测试 LLM API 时发生错误:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        config: {
          api_base: env.AI_API_BASE,
          model: env.AI_MODEL_NAME,
          api_type: env.AI_API_TYPE || 'openai',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

/**
 * 测试 RSS 抓取（仅抓取，不分析）
 */
export async function handleTestRss(url: URL): Promise<Response> {
  const testUrl = url.searchParams.get('url') || 'https://www.wsws.org/en/rss.xml';
  try {
    console.log(`测试 RSS 抓取: ${testUrl}`);
    const items = await fetchRSSFeed(testUrl);
    return new Response(
      JSON.stringify({
        success: true,
        url: testUrl,
        itemsCount: items.length,
        items: items.slice(0, 3).map(item => ({
          title: item.title,
          link: item.link,
        })),
        message: `成功抓取 ${items.length} 篇文章（仅显示前3条）`,
      }),
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        url: testUrl,
        error: error instanceof Error ? error.message : '未知错误',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

/**
 * 查看当前热门标签池（用于验证 Context Loop）
 */
export async function handleTestTags(env: Env): Promise<Response> {
  try {
    const tagsJson = await buildExistingTagsPromptFragment(env.DB);
    let tagsArray: Array<{ en: string; zh: string }> = [];
    try {
      tagsArray = JSON.parse(tagsJson);
    } catch {
      // 如果解析失败，返回空数组
    }
    
    // 获取完整 Prompt 片段预览
    const promptWithTags = LLM_CONFIG.systemPrompt.replace(
      '{{EXISTING_TAGS_PLACEHOLDER}}',
      tagsJson
    );
    const promptPreview = promptWithTags.substring(
      promptWithTags.indexOf('当前热门标签池：'),
      Math.min(
        promptWithTags.indexOf('当前热门标签池：') + 800,
        promptWithTags.length
      )
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        message: '当前热门标签池（过去7天，Top 30）',
        tagsCount: tagsArray.length,
        tags: tagsArray,
        tagsJson: tagsJson,
        promptPreview: promptPreview,
        note: '这些标签会被注入到 LLM 的 System Prompt 中，鼓励 AI 优先复用这些标签',
      }, null, 2),
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

/**
 * 手动触发新闻抓取（测试用）
 */
export async function handleTestFetch(env: Env, url: URL): Promise<Response> {
  try {
    // 创建一个模拟的 ScheduledEvent 来触发抓取
    const mockEvent = {
      scheduledTime: Date.now(),
      cron: '0 * * * *',
    } as unknown as ScheduledEvent;
    
    // 使用 ctx.waitUntil 确保任务完成（在 fetch 事件中需要使用 ExecutionContext）
    // 注意：这里我们直接调用，但限制处理数量以避免超时
    const limit = parseInt(url.searchParams.get('limit') || APP_CONFIG.defaultTestLimit.toString(), 10);
    
    // 执行抓取任务，但限制处理数量
    handleScheduledLimited(mockEvent, env, limit).catch((error) => {
      console.error('抓取任务执行出错:', error);
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `新闻抓取任务已启动，正在处理前 ${limit} 篇文章。请稍等片刻后刷新首页查看结果。`,
        tip: '抓取过程可能需要几分钟，请查看 Cloudflare Dashboard 日志了解详细进度',
        limit: limit,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

