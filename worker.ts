/**
 * Zimmerwald (齐默尔瓦尔德) v1.0
 * 国际共运新闻聚合平台 - Cloudflare Workers 后端
 */

import { XMLParser } from 'fast-xml-parser';
import { RSS_SOURCES, ENABLED_RSS_SOURCES } from './src/config/rss-sources';
import { SCHEDULER_CONFIG } from './src/config/scheduler';
import { LLM_CONFIG, ANTHROPIC_MAX_TOKENS } from './src/config/llm';
import { APP_CONFIG } from './src/config/app';

// 类型定义
interface Article {
  id?: number;
  title: string;
  url: string;
  source_name: string;
  summary?: string;
  category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
  score?: number;
  published_at?: number;
  created_at: number;
}

interface LLMResponse {
  summary: string;
  category: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
  score: number;
}

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  'content:encoded'?: string;
}

interface Env {
  DB: D1Database;
  AI_API_KEY: string;
  AI_API_BASE: string;
  AI_MODEL_NAME: string;
  AI_API_TYPE?: 'openai' | 'anthropic'; // 默认为 'openai'
}

// 备用 RSS 源（如果上面的无法访问，可以临时使用这些）
// const RSS_SOURCES = [
//   { name: 'China Daily', url: 'https://www.chinadaily.com.cn/rss/china_rss.xml' },
//   { name: 'Xinhua', url: 'http://www.xinhuanet.com/rss/world.xml' },
// ];

// 测试用的简单 RSS 源（用于调试）
// const RSS_SOURCES = [
//   { name: 'Test', url: 'https://rss.cnn.com/rss/edition.rss' }, // CNN RSS 用于测试
// ];

/**
 * 调用外部 LLM API 进行新闻分析
 * 支持 OpenAI 兼容格式（包括 OpenRouter、Grok 等）和 Anthropic 格式
 * 
 * OpenRouter 配置示例：
 * - AI_API_BASE: https://openrouter.ai/api/v1
 * - AI_API_TYPE: openai
 * - AI_MODEL_NAME: openai/gpt-4o 或 anthropic/claude-3.5-sonnet 等
 * 查看所有可用模型：https://openrouter.ai/models
 */
async function callLLM(
  title: string,
  description: string,
  env: Env
): Promise<LLMResponse | null> {
  const apiType = env.AI_API_TYPE || 'openai';
  const systemPrompt = LLM_CONFIG.systemPrompt;

  const userPrompt = `标题：${title}\n\n内容：${description}`;

  try {
    let response: Response;

    if (apiType === 'anthropic') {
      // Anthropic Claude API 格式
      response = await fetch(env.AI_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.AI_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: env.AI_MODEL_NAME,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
      });
    } else {
      // OpenAI 兼容格式 (默认，适用于 OpenRouter、Grok 等)
      // OpenRouter 使用此格式，模型名称格式：provider/model-name
      response = await fetch(`${env.AI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.AI_MODEL_NAME,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: LLM_CONFIG.temperature,
          max_tokens: LLM_CONFIG.maxTokens,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM API 错误: ${response.status} - ${errorText}`);
      return null;
    }

    const data = (await response.json()) as any;

    // 添加详细日志以便调试
    console.log('LLM API 响应状态:', response.status, response.statusText);
    console.log('LLM API 响应结构:', JSON.stringify(data).substring(0, 1000));
    console.log('响应 keys:', Object.keys(data).join(', '));
    if (data.choices) {
      console.log('choices 数量:', data.choices.length);
      if (data.choices[0]) {
        console.log('choice 0 keys:', Object.keys(data.choices[0]).join(', '));
        if (data.choices[0].message) {
          console.log('message keys:', Object.keys(data.choices[0].message).join(', '));
        }
      }
    }

    // 解析响应
    let content: string;
    if (apiType === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      // OpenAI 兼容格式
      content = data.choices?.[0]?.message?.content || '';
      
      // DeepSeek 思考模式处理：如果 content 为空但 finish_reason 是 length，说明被截断了
      const finishReason = data.choices?.[0]?.finish_reason;
      if (!content && finishReason === 'length') {
        console.warn('⚠️ 输出被截断（finish_reason: length），增加 max_tokens 或简化 prompt');
      }
      
      // DeepSeek 思考模式特殊处理
      // 在思考模式下，如果 content 为空，尝试从 reasoning_content 中提取 JSON
      const reasoningContent = data.choices?.[0]?.message?.reasoning_content;
      if (!content && reasoningContent) {
        console.log('检测到 DeepSeek 思考模式，从 reasoning_content 中提取 JSON...');
        console.log('reasoning_content 长度:', reasoningContent.length);
        console.log('finish_reason:', finishReason);
        
        // 尝试从思考内容中提取 JSON
        // 查找包含 summary, category, score 的 JSON 对象
        // 使用更宽松的匹配模式，因为可能被截断
        let jsonMatch = reasoningContent.match(/\{"summary"\s*:\s*"[^"]*"\s*,\s*"category"\s*:\s*"[^"]*"\s*,\s*"score"\s*:\s*\d+\s*\}/);
        
        if (!jsonMatch) {
          // 尝试更宽松的匹配（允许换行和空格）
          jsonMatch = reasoningContent.match(/\{\s*"summary"\s*:\s*"[^"]*"\s*,?\s*"category"\s*:\s*"[^"]*"\s*,?\s*"score"\s*:\s*\d+\s*\}/);
        }
        
        if (!jsonMatch) {
          // 如果还是找不到，尝试从末尾开始找（JSON 通常在最后）
          const lines = reasoningContent.split('\n');
          for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
            const line = lines[i];
            if (line.includes('summary') && line.includes('category')) {
              // 尝试从这一行开始向后匹配
              const remaining = lines.slice(i).join('\n');
              jsonMatch = remaining.match(/\{[\s\S]{0,500}\}/);
              if (jsonMatch) {
                try {
                  const testJson = JSON.parse(jsonMatch[0]);
                  if (testJson.summary && testJson.category && typeof testJson.score === 'number') {
                    break;
                  }
                } catch {
                  jsonMatch = null;
                }
              }
            }
          }
        }
        
        if (jsonMatch && jsonMatch[0]) {
          try {
            const testJson = JSON.parse(jsonMatch[0]);
            if (testJson.summary && testJson.category && typeof testJson.score === 'number') {
              content = jsonMatch[0];
              console.log('✅ 成功从 reasoning_content 中提取 JSON');
            }
          } catch (e) {
            console.warn('提取的 JSON 解析失败:', e);
          }
        }
        
        if (!content) {
          console.warn('无法从 reasoning_content 中提取有效 JSON');
        }
      }
      
      // 如果 content 为空，尝试其他可能的字段
      if (!content) {
        console.warn('尝试其他响应格式...');
        content = data.choices?.[0]?.message?.text || 
                 data.choices?.[0]?.text ||
                 data.content || 
                 data.text || 
                 data.message ||
                 '';
      }
    }

    if (!content) {
      console.error('LLM 返回空内容，完整响应:', JSON.stringify(data).substring(0, 1000));
      return null;
    }

    console.log(`LLM 返回内容长度: ${content.length} 字符`);

    // 尝试提取 JSON（处理可能的 markdown 代码块或额外文本）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('无法从 LLM 响应中提取 JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as LLMResponse;

    // 验证和规范化数据
    if (!parsed.summary || !parsed.category || typeof parsed.score !== 'number') {
      console.error('LLM 返回的 JSON 格式不完整');
      return null;
    }

    // 确保 category 是有效值
    const validCategories: Array<'Labor' | 'Politics' | 'Conflict' | 'Theory'> = [
      'Labor',
      'Politics',
      'Conflict',
      'Theory',
    ];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'Politics'; // 默认分类
    }

    // 确保 score 在 0-100 范围内
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return parsed;
  } catch (error) {
    console.error('调用 LLM API 时发生错误:', error);
    return null;
  }
}

/**
 * 解析 RSS XML
 */
async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    console.log(`开始抓取 RSS: ${url}`);
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`RSS 抓取超时 (30秒): ${url}`);
      controller.abort();
    }, APP_CONFIG.rssFetchTimeout);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const fetchTime = Date.now() - startTime;
      console.log(`RSS 请求完成，耗时: ${fetchTime}ms`);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`RSS 抓取超时: ${url}`);
      } else {
        console.error(`RSS 请求失败: ${url}`, fetchError);
      }
      return [];
    }

    if (!response.ok) {
      console.error(`获取 RSS 失败: ${url} - ${response.status} ${response.statusText}`);
      return [];
    }

    console.log(`RSS 响应成功，开始解析 XML...`);
    const xml = await response.text();
    console.log(`XML 长度: ${xml.length} 字符`);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const result = parser.parse(xml);
    const items: RSSItem[] = [];

    // 处理不同的 RSS 格式
    if (result.rss?.channel?.item) {
      const feedItems = Array.isArray(result.rss.channel.item)
        ? result.rss.channel.item
        : [result.rss.channel.item];
      items.push(...feedItems);
      console.log(`解析到 ${items.length} 条 RSS 文章`);
    } else if (result.feed?.entry) {
      // Atom 格式
      const feedItems = Array.isArray(result.feed.entry)
        ? result.feed.entry
        : [result.feed.entry];
      items.push(
        ...feedItems.map((entry: any) => ({
          title: entry.title?.['#text'] || entry.title,
          link: entry.link?.['@_href'] || entry.link,
          description: entry.summary?.['#text'] || entry.summary || entry.content?.['#text'] || entry.content,
          pubDate: entry.published || entry.updated,
        }))
      );
      console.log(`解析到 ${items.length} 条 Atom 文章`);
    } else {
      console.warn(`无法识别 RSS 格式，尝试查找其他格式...`);
      console.log(`解析结果键: ${Object.keys(result).join(', ')}`);
    }

    return items;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`RSS 抓取超时: ${url}`);
    } else {
      console.error(`解析 RSS 时发生错误: ${url}`, error);
    }
    return [];
  }
}

/**
 * 解析日期字符串为时间戳
 */
function parseDate(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).getTime();
  } catch {
    return null;
  }
}

/**
 * 检查 URL 是否已存在
 */
async function urlExists(db: D1Database, url: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM articles WHERE url = ? LIMIT 1')
    .bind(url)
    .first();
  return !!result;
}

/**
 * 保存文章到数据库
 */
async function saveArticle(db: D1Database, article: Article): Promise<void> {
  await db
    .prepare(
      `INSERT INTO articles (title, url, source_name, summary, category, score, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      article.title,
      article.url,
      article.source_name,
      article.summary || null,
      article.category || null,
      article.score || null,
      article.published_at || null,
      article.created_at
    )
    .run();
}

/**
 * 处理定时任务：抓取 RSS 并分析（限制处理数量，用于测试）
 */
async function handleScheduledLimited(event: ScheduledEvent, env: Env, maxItems: number = 5): Promise<void> {
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

      // 保存到数据库
      const publishedAt = parseDate(item.pubDate);
      const article: Article = {
        title: item.title,
        url: item.link,
        source_name: source.name,
        summary: analysis.summary,
        category: analysis.category,
        score: analysis.score,
        published_at: publishedAt ?? undefined,
        created_at: Date.now(),
      };

      try {
        await saveArticle(env.DB, article);
        processedCount++;
        totalProcessed++;
        console.log(`✅ 成功保存文章 (${processedCount}/${items.length}, 总计 ${totalProcessed}/${maxItems}): ${item.title}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ 保存文章失败: ${item.title}`, error);
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
async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
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

      // 保存到数据库
      const publishedAt = parseDate(item.pubDate);
      const article: Article = {
        title: item.title,
        url: item.link,
        source_name: source.name,
        summary: analysis.summary,
        category: analysis.category,
        score: analysis.score,
        published_at: publishedAt ?? undefined,
        created_at: Date.now(),
      };

      try {
        await saveArticle(env.DB, article);
        processedCount++;
        totalProcessed++;
        console.log(`✅ 成功保存文章 (${processedCount}/${itemsToProcess.length}, 总计 ${totalProcessed}/${maxTotalArticles}): ${item.title}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ 保存文章失败: ${item.title}`, error);
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

/**
 * 获取新闻列表 API
 */
async function getNews(env: Env, limit: number = 30): Promise<Article[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM articles 
     ORDER BY published_at DESC, created_at DESC 
     LIMIT ?`
  )
    .bind(limit)
    .all<Article>();

  return result.results || [];
}

/**
 * 生成前端 HTML 页面
 */
function generateHTML(articles: Article[]): string {
  const getScoreColor = (score: number | undefined): string => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-red-600 font-bold';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-gray-400';
  };

  const getCategoryBadge = (category: string | undefined): string => {
    const badges: Record<string, string> = {
      Labor: 'bg-blue-100 text-blue-800',
      Politics: 'bg-purple-100 text-purple-800',
      Conflict: 'bg-red-100 text-red-800',
      Theory: 'bg-green-100 text-green-800',
    };
    return badges[category || ''] || 'bg-gray-100 text-gray-800';
  };

  const articlesHTML = articles
    .map(
      (article) => `
    <article class="border-b border-gray-200 py-4">
      <div class="flex items-start justify-between mb-2">
        <h2 class="text-lg font-semibold text-gray-900 flex-1">
          <a href="${article.url}" target="_blank" rel="noopener noreferrer" 
             class="hover:text-blue-600 transition-colors">
            ${escapeHtml(article.title)}
          </a>
        </h2>
        <div class="ml-4 flex items-center gap-2">
          ${article.category ? `<span class="px-2 py-1 text-xs rounded ${getCategoryBadge(article.category)}">${article.category}</span>` : ''}
          ${article.score !== undefined ? `<span class="${getScoreColor(article.score)}">${article.score}</span>` : ''}
        </div>
      </div>
      <div class="text-sm text-gray-600 mb-2">
        <span class="font-medium">${escapeHtml(article.source_name)}</span>
        ${article.published_at ? `<span class="mx-2">•</span><span>${new Date(article.published_at).toLocaleDateString('zh-CN')}</span>` : ''}
      </div>
      ${article.summary ? `<p class="text-gray-700 mt-2">${escapeHtml(article.summary)}</p>` : ''}
    </article>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zimmerwald - 国际共运新闻聚合平台</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Zimmerwald</h1>
      <p class="text-gray-600">国际共运新闻聚合平台</p>
    </header>
    
    <div id="news-container" class="bg-white rounded-lg shadow-sm p-6">
      ${articles.length === 0 ? '<p class="text-gray-500 text-center py-8">暂无新闻</p>' : articlesHTML}
    </div>
    
    <footer class="mt-8 text-center text-sm text-gray-500">
      <p>数据来源: WSWS, Peoples Dispatch, Red Herald</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * HTML 转义函数
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Worker 主入口
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 测试端点：批量测试所有 RSS 源
    if (url.pathname === '/test/all-rss') {
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

    // 测试端点：直接测试 LLM API 调用（返回详细响应）
    if (url.pathname === '/test/llm') {
      const testTitle = url.searchParams.get('title') || '测试标题：工人在工厂举行罢工';
      const testDescription = url.searchParams.get('description') || '这是一篇测试新闻，描述工人为争取更好的工作条件而举行罢工。';
      
      try {
        console.log('开始测试 LLM API 调用...');
        console.log('API 配置:', {
          base: env.AI_API_BASE,
          model: env.AI_MODEL_NAME,
          type: env.AI_API_TYPE || 'openai',
        });
        
        // 直接调用 API 并捕获完整响应
        const apiType = env.AI_API_TYPE || 'openai';
        const systemPrompt = LLM_CONFIG.systemPrompt;

        const userPrompt = `标题：${testTitle}\n\n内容：${testDescription}`;
        
        const response = await fetch(`${env.AI_API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AI_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.AI_MODEL_NAME,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: userPrompt,
              },
            ],
            temperature: LLM_CONFIG.temperature,
            max_tokens: LLM_CONFIG.maxTokens,
          }),
        });

        const responseText = await response.text();
        let responseData: any;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'API 返回非 JSON 格式',
              status: response.status,
              statusText: response.statusText,
              rawResponse: responseText.substring(0, 2000),
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

        const analysis = await callLLM(testTitle, testDescription, env);
        
        return new Response(
          JSON.stringify({
            success: analysis !== null,
            message: analysis ? 'LLM API 调用成功' : 'LLM API 返回空结果',
            analysis: analysis,
            apiResponse: {
              status: response.status,
              statusText: response.statusText,
              data: responseData,
              content: responseData.choices?.[0]?.message?.content || null,
            },
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

    // 测试端点：测试 RSS 抓取（仅抓取，不分析）
    if (url.pathname === '/test/rss') {
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

    // 测试端点：手动触发新闻抓取
    if (url.pathname === '/test/fetch') {
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

    // API 路由
    if (url.pathname === '/api/news') {
      const limit = parseInt(url.searchParams.get('limit') || APP_CONFIG.newsListLimit.toString(), 10);
      const articles = await getNews(env, limit);
      return new Response(JSON.stringify(articles), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // 前端页面
    if (url.pathname === '/') {
      const articles = await getNews(env, APP_CONFIG.newsListLimit);
      const html = generateHTML(articles);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

