/**
 * 应用通用配置
 */

export interface AppConfig {
  rssFetchTimeout: number; // RSS 抓取超时时间（毫秒）
  defaultTestLimit: number; // 测试端点的默认处理数量
  newsListLimit: number; // 新闻列表 API 默认返回数量
  rssHubBase: string; // RSSHub 实例地址（建议自托管，通过 Cloudflare Tunnel/HTTPS 反代）
}

const envRssHubBase = typeof process !== 'undefined' ? process.env?.RSSHUB_BASE : undefined;

export const APP_CONFIG: AppConfig = {
  rssFetchTimeout: 30000, // 30 秒
  defaultTestLimit: 50, // 测试端点默认处理 50 篇文章
  newsListLimit: 30, // 默认返回最新 30 篇文章
  // 应通过环境变量 RSSHUB_BASE 提供；未配置会导致 RSSHub 源不可用
  rssHubBase: envRssHubBase || '',
};

/**
 * 每日简报配置
 */
export const BRIEFING_ALERT_CONFIG = {
  // 战略警戒等级阈值配置（1-5，1为最高警戒）
  // 基于最高分和高价值文章比例计算
  thresholds: [
    { level: 1, minScore: 90, minRatio: 0.1, labelZh: '烈火', labelEn: 'INFERNO', code: 'INFERNO' }, // 最高警戒
    { level: 2, minScore: 80, minRatio: 0.05, labelZh: '野火', labelEn: 'WILDFIRE', code: 'WILDFIRE' },
    { level: 3, minScore: 70, minRatio: 0.02, labelZh: '星火', labelEn: 'SPARK', code: 'SPARK' },
    { level: 4, minScore: 60, minRatio: 0, labelZh: '硝烟', labelEn: 'SMOKE', code: 'SMOKE' },
    { level: 5, minScore: 0, minRatio: 0, labelZh: '迷雾', labelEn: 'FOG', code: 'FOG' }, // 默认最低
  ],
  defaultLevel: 5, // 默认等级
  highValueThreshold: 80, // 高价值文章阈值
  strategicThreshold: 80, // 战略级文章阈值
  topKeywordsCount: 10, // 提取的关键词数量
  keyArticlesCount: 10, // 关联的关键文章数量
};

