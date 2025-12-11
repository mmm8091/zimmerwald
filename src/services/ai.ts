// Zimmerwald v1.2 AI 服务
// 封装 OpenAI SDK，实现 Context Loop 和 Prompt Injection

import OpenAI from 'openai';
import { SYSTEM_PROMPT_TEMPLATE, LLM_CONFIG } from '../config/prompts';
import { getTopTags } from './db';
import type { LLMResponse, Env } from './types';

interface ModelConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

function isRiskError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('Content Exists Risk') || msg.includes('400');
}

async function runModel(config: ModelConfig, systemPrompt: string, userPrompt: string) {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: LLM_CONFIG.temperature,
    max_tokens: LLM_CONFIG.maxTokens,
  });

  return response.choices[0]?.message?.content;
}

/**
 * 分析新闻文章
 * Context Loop: 先查询热门标签，注入到 System Prompt
 */
export async function analyzeNews(
  title: string,
  description: string,
  env: Env
): Promise<LLMResponse | null> {
  try {
    // Context Loop: 获取最近 7 天的热门标签
    const topTags = await getTopTags(env.DB, 7, 30);
    const tagsJson = JSON.stringify(topTags);
    console.log('📊 当前热门标签池（Top 30）:', tagsJson);

    // 获取当前日期
    const currentDate = new Date().toISOString().split('T')[0];

    // Prompt Injection: 注入热门标签和日期
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{{EXISTING_TAGS_PLACEHOLDER}}', tagsJson).replace(
      '{{CURRENT_DATE}}',
      currentDate
    );

    const userPrompt = `标题：${title}\n\n内容：${description}`;

    const primaryConfig: ModelConfig = {
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_API_BASE,
      model: env.AI_MODEL_NAME,
    };

    const fallbackConfig =
      env.FALLBACK_API_KEY && (env.FALLBACK_API_BASE || env.FALLBACK_MODEL_NAME)
        ? {
            apiKey: env.FALLBACK_API_KEY,
            baseURL: env.FALLBACK_API_BASE || 'https://openrouter.ai/api/v1',
            model: env.FALLBACK_MODEL_NAME || 'anthropic/claude-sonnet-4.5',
          }
        : null;

    let content: string | undefined;

    try {
      content = await runModel(primaryConfig, systemPrompt, userPrompt);
    } catch (err) {
      console.error('主模型调用失败，将尝试备用模型（若配置）:', err);
      if (fallbackConfig && isRiskError(err)) {
        try {
          content = await runModel(fallbackConfig, systemPrompt, userPrompt);
        } catch (fallbackErr) {
          console.error('备用模型调用也失败:', fallbackErr);
          return null;
        }
      } else {
        return null;
      }
    }

    if (!content) {
      console.error('LLM 返回空内容');
      return null;
    }

    console.log(`LLM 返回内容长度: ${content.length} 字符`);

    // 提取 JSON（处理可能的 Markdown 代码块）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('无法从 LLM 响应中提取 JSON');
      return null;
    }

    const raw = JSON.parse(jsonMatch[0]) as any;

    // 基础字段校验
    if (!raw.category || typeof raw.score !== 'number') {
      console.error('LLM 返回的 JSON 缺少关键字段 category/score');
      return null;
    }

    // 规范化 category
    const validCategories: Array<'Labor' | 'Politics' | 'Conflict' | 'Theory'> = [
      'Labor',
      'Politics',
      'Conflict',
      'Theory',
    ];
    const category: 'Labor' | 'Politics' | 'Conflict' | 'Theory' = validCategories.includes(raw.category)
      ? raw.category
      : 'Politics';

    // 规范化 score (0-100)
    const score = Math.max(0, Math.min(100, Math.round(raw.score)));

    // 构建返回结果
    const result: LLMResponse = {
      title_zh:
        typeof raw.title_zh === 'string' && raw.title_zh.trim()
          ? raw.title_zh.trim()
          : title || '（无标题）',
      title_en: typeof raw.title_en === 'string' ? raw.title_en.trim() : title || '',
      summary_en: typeof raw.summary_en === 'string' ? raw.summary_en.trim() : '',
      summary_zh:
        typeof raw.summary_zh === 'string' && raw.summary_zh.trim()
          ? raw.summary_zh.trim()
          : '（暂无中文摘要）',
      category,
      score,
      ai_reasoning: typeof raw.ai_reasoning === 'string' ? raw.ai_reasoning.trim() : '',
      tags: Array.isArray(raw.tags)
        ? raw.tags
            .map((t: any) => ({
              en: typeof t?.en === 'string' ? t.en.trim() : '',
              zh: typeof t?.zh === 'string' ? t.zh.trim() : '',
            }))
            .filter((t) => t.en || t.zh)
        : [],
    };

    return result;
  } catch (error) {
    console.error('调用 LLM API 时发生错误:', error);
    return null;
  }
}

