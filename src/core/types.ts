// Zimmerwald v1.1 核心类型定义
// 统一管理 Worker 内部使用的共享类型，避免在单个文件中膨胀

export interface ArticleRow {
  id?: number;
  url: string;
  source_id: string;
  published_at?: number | null;
  created_at: number;
  title_en?: string | null;
  title_zh?: string | null;
  summary_en?: string | null;
  summary_zh?: string | null;
  category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory' | null;
  tags?: string | null; // JSON 字符串：[{"en":"Strike","zh":"罢工"}, ...]
  score?: number | null;
  ai_reasoning?: string | null;
}

// 前端与 API 使用的视图模型（兼容 v1.0 的字段命名）
export interface Article {
  id?: number;
  url: string;
  source_id: string;
  source_name: string; // 展示用友好名称
  title: string;
  summary?: string;
  category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
  score?: number | null;
  published_at?: number | null;
  created_at: number;
  // v1.1 额外暴露的双语与标签字段（供前端 Intelligence Dashboard 使用）
  title_en?: string | null;
  title_zh?: string | null;
  summary_en?: string | null;
  summary_zh?: string | null;
  tags_json?: string | null; // 原始 JSON 字符串
  tags?: LLMTag[]; // 解析后的标签数组
  ai_reasoning?: string | null;
}

// v1.1 LLM 返回的结构（与宽表 fields 对应）
export interface LLMTag {
  en: string;
  zh: string;
}

export interface LLMResponse {
  title_zh: string;
  summary_en: string;
  summary_zh: string;
  category: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
  score: number;
  ai_reasoning: string;
  tags: LLMTag[];
}

export interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  'content:encoded'?: string;
}

// Cloudflare Workers Env 类型（在 wrangler 中通过 bindings 提供）
export interface Env {
  DB: D1Database;
  AI_API_KEY: string;
  AI_API_BASE: string;
  AI_MODEL_NAME: string;
  AI_API_TYPE?: 'openai' | 'anthropic'; // 默认为 'openai'
}

// /api/news 查询参数类型
export interface NewsQueryOptions {
  limit?: number;
  minScore?: number;
  category?: 'Labor' | 'Politics' | 'Conflict' | 'Theory';
  tag?: string | null;
}


