/**
 * 应用通用配置
 */

export interface AppConfig {
  rssFetchTimeout: number; // RSS 抓取超时时间（毫秒）
  defaultTestLimit: number; // 测试端点的默认处理数量
  newsListLimit: number; // 新闻列表 API 默认返回数量
}

export const APP_CONFIG: AppConfig = {
  rssFetchTimeout: 30000, // 30 秒
  defaultTestLimit: 50, // 测试端点默认处理 50 篇文章
  newsListLimit: 30, // 默认返回最新 30 篇文章
};

