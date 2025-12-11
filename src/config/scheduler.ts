/**
 * 定时任务调度配置 (v1.3)
 * 支持按平台设置处理上限，确保每个平台都能被处理
 */

export interface SchedulerConfig {
  maxSourcesPerPlatform: {
    News: number;
    Twitter: number;
    Telegram: number;
  };
  maxArticlesPerSource: number;
  maxTotalArticles: number;
  delayBetweenArticles: number; // 毫秒
  aiAnalysisConcurrency: number; // AI 分析并发数
}

/**
 * Cloudflare Workers 付费版限制：1000 个子请求
 * v1.3 更新：按平台分配处理上限，确保每个平台都能被处理
 * 
 * 计算示例：
 * - News: 5 个源 × 30 篇文章 = 150 篇文章
 * - Twitter: 5 个源 × 30 篇文章 = 150 篇文章
 * - Telegram: 5 个源 × 30 篇文章 = 150 篇文章
 * 请求数：15 个 RSS + 450 个 LLM = 465 个请求（远低于 1000）
 */
export const SCHEDULER_CONFIG: SchedulerConfig = {
  maxSourcesPerPlatform: {
    News: 5, // 每次处理最多 5 个 News 源
    Twitter: 5, // 每次处理最多 5 个 Twitter 源
    Telegram: 5, // 每次处理最多 5 个 Telegram 源
  },
  maxArticlesPerSource: 30, // 每个源最多处理 30 篇文章
  maxTotalArticles: 450, // 总共最多处理 450 篇文章（15 个源 × 30 篇）
  delayBetweenArticles: 1000, // 每篇文章之间延迟 1 秒，避免 API 限流
  aiAnalysisConcurrency: 30, // AI 分析并发数（v1.4 优化：并行处理提升效率）
};

