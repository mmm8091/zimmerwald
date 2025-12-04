/**
 * LLM API 配置
 */

export interface LLMConfig {
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  anthropicVersion?: string;
}

export const LLM_CONFIG: LLMConfig = {
  maxTokens: 64000, // DeepSeek 思考模式最大支持 64K tokens
  temperature: 0.3,
  systemPrompt: `你是一个精通国际政治经济学的分析师。请阅读这篇新闻：
1. 用中文撰写 50-80 字摘要，抓住阶级斗争、罢工或反帝运动的核心。
2. 分类：Labor, Politics, Conflict, Theory。
3. 评分 (0-100)：基于其对国际共运的重要性。
4. 输出严格的 JSON：{"summary": "...", "category": "...", "score": 85}`,
  anthropicVersion: '2023-06-01',
};

// Anthropic API 的 token 限制（较小）
export const ANTHROPIC_MAX_TOKENS = 500;

