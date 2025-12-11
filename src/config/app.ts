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

