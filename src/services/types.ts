// Zimmerwald v1.2 服务层类型定义

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
}

