// Zimmerwald v1.1 LLM 调用与解析逻辑
// - 负责与外部大模型服务交互，并将结果规范化为内部使用的 LLMResponse

import { LLM_CONFIG, ANTHROPIC_MAX_TOKENS } from '../config/llm';
import { buildExistingTagsPromptFragment } from './db';
import type { Env, LLMResponse, LLMTag } from './types';

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
export async function callLLM(
  title: string,
  description: string,
  env: Env
): Promise<LLMResponse | null> {
  const apiType = env.AI_API_TYPE || 'openai';

  // 基于数据库中最近一段时间的热门标签，动态构建 Prompt
  const existingTagsJson = await buildExistingTagsPromptFragment(env.DB);
  console.log('📊 当前热门标签池（Top 30）:', existingTagsJson);
  
  // 获取当前日期（格式：YYYY-MM-DD）
  const currentDate = new Date().toISOString().split('T')[0];
  
  // 替换占位符
  let systemPrompt = LLM_CONFIG.systemPrompt.replace(
    '{{EXISTING_TAGS_PLACEHOLDER}}',
    existingTagsJson
  );
  systemPrompt = systemPrompt.replace(
    '{{CURRENT_DATE}}',
    currentDate
  );
  // 记录替换后的 Prompt 片段（仅前 500 字符，避免日志过长）
  const promptPreview = systemPrompt.substring(
    systemPrompt.indexOf('当前热门标签池：'),
    systemPrompt.indexOf('当前热门标签池：') + 500
  );
  console.log('📝 注入后的 Prompt 片段预览:', promptPreview);

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
        let jsonMatch = reasoningContent.match(
          /\{"summary"\s*:\s*"[^"]*"\s*,\s*"category"\s*:\s*"[^"]*"\s*,\s*"score"\s*:\s*\d+\s*\}/
        );

        if (!jsonMatch) {
          // 尝试更宽松的匹配（允许换行和空格）
          jsonMatch = reasoningContent.match(
            /\{\s*"summary"\s*:\s*"[^"]*"\s*,?\s*"category"\s*:\s*"[^"]*"\s*,?\s*"score"\s*:\s*\d+\s*\}/
          );
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
                  if (
                    testJson.summary &&
                    testJson.category &&
                    typeof testJson.score === 'number'
                  ) {
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
        content =
          data.choices?.[0]?.message?.text ||
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

    const raw = JSON.parse(jsonMatch[0]) as any;

    // 基础字段校验和兜底
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
    const category: 'Labor' | 'Politics' | 'Conflict' | 'Theory' = validCategories.includes(
      raw.category
    )
      ? raw.category
      : 'Politics';

    // 规范化 score
    const score = Math.max(0, Math.min(100, Math.round(raw.score)));

    // 处理可选字段，保证类型稳定
    const result: LLMResponse = {
      title_zh:
        typeof raw.title_zh === 'string' && raw.title_zh.trim()
          ? raw.title_zh.trim()
          : title || '（无标题）',
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
            .filter((t: LLMTag) => t.en || t.zh)
        : [],
    };

    return result;
  } catch (error) {
    console.error('调用 LLM API 时发生错误:', error);
    return null;
  }
}


