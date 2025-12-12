// API 客户端
const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = endpoint.startsWith('http') ? endpoint : API_BASE + endpoint;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    // 404 错误不抛出，返回 null（用于可选资源如简报）
    if (response.status === 404) {
      return null;
    }
    throw new Error('API Error: ' + response.status + ' ' + response.statusText);
  }
  return response.json();
}

export async function getArticles(params: Record<string, any> = {}) {
  const searchParams = new URLSearchParams();
  if (params.min_score !== undefined) searchParams.set('min_score', String(params.min_score));
  if (params.max_score !== undefined) searchParams.set('max_score', String(params.max_score));
  if (params.platform) searchParams.set('platform', params.platform);
  if (params.category) searchParams.set('category', params.category);
  if (params.tag) searchParams.set('tag', params.tag); // 兼容旧版本
  if (params.tags) searchParams.set('tags', params.tags); // 新版本：多个标签用逗号分隔
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.days) searchParams.set('days', String(params.days));
  const query = searchParams.toString();
  return apiRequest('/api/news' + (query ? '?' + query : ''));
}

export async function getSourcesStats(includeDisabled = false) {
  const query = includeDisabled ? '?include_disabled=1' : '';
  return apiRequest('/api/sources/stats' + query);
}

export async function getLatestBriefing() {
  // apiRequest 已经处理了 404，直接返回即可
  return apiRequest('/api/daily-briefings/latest');
}

export async function getScoreHistogram(days = 30) {
  return apiRequest('/api/stats/histogram?days=' + days);
}

