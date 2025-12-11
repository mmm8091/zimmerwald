// Zimmerwald v1.3 服务层类型定义

export type PlatformType = 'News' | 'Twitter' | 'Telegram';

export interface LLMTag {
  en: string;
  zh: string;
}

export interface LLMResponse {
  title_zh: string;
  title_en: string;
  summary_en: string;
  summary_zh: string;
  category: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
  score: number;
  ai_reasoning: string;
  tags: LLMTag[];
}

export interface Env {
  DB: D1Database;
  AI_API_KEY: string;
  AI_API_BASE: string;
  AI_MODEL_NAME: string;
  AI_API_TYPE?: 'openai' | 'anthropic';
  RSSHUB_BASE?: string;
  FALLBACK_API_KEY?: string;
  FALLBACK_API_BASE?: string;
  FALLBACK_MODEL_NAME?: string;
  FALLBACK_API_TYPE?: 'openai' | 'anthropic';
}
