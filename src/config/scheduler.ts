/**
 * 定时任务调度配置
 */

export interface SchedulerConfig {
  maxSourcesPerRun: number;
  maxArticlesPerSource: number;
  maxTotalArticles: number;
  delayBetweenArticles: number; // 毫秒
}

/**
 * Cloudflare Workers 付费版限制：1000 个子请求
 * 计算：13 个源 × 30 篇文章 = 390 篇文章
 * 请求数：13 个 RSS + 390 个 LLM = 403 个请求（远低于 1000）
 */
export const SCHEDULER_CONFIG: SchedulerConfig = {
  maxSourcesPerRun: 13, // 处理所有启用的源
  maxArticlesPerSource: 30, // 每个源最多处理 30 篇文章
  maxTotalArticles: 300, // 总共最多处理 300 篇文章（留有余量）
  delayBetweenArticles: 1000, // 每篇文章之间延迟 1 秒，避免 API 限流
};

