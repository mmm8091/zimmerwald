// API 客户端
// 生产环境使用 Worker URL，开发环境使用相对路径（通过 vite proxy）
const API_BASE = import.meta.env.VITE_API_BASE || 
  (import.meta.env.PROD ? 'https://zimmerwald.leelooloo8091.workers.dev' : '');

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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:23',message:'getArticles called',data:params,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  const searchParams = new URLSearchParams();
  if (params.min_score !== undefined) searchParams.set('min_score', String(params.min_score));
  if (params.max_score !== undefined) searchParams.set('max_score', String(params.max_score));
  if (params.platform) searchParams.set('platform', params.platform);
  if (params.category) searchParams.set('category', params.category);
  if (params.tag) searchParams.set('tag', params.tag); // 兼容旧版本
  if (params.tags) {
    console.log('[getArticles] 传递 tags 参数:', params.tags, '类型:', typeof params.tags);
    searchParams.set('tags', params.tags); // 新版本：多个标签用逗号分隔
  }
  if (params.search) {
    console.log('[getArticles] 传递 search 参数:', params.search, '类型:', typeof params.search);
    searchParams.set('search', params.search);
  }
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params.days !== undefined) searchParams.set('days', String(params.days)); // 包括 0（全部）
  const query = searchParams.toString();
  const finalUrl = '/api/news' + (query ? '?' + query : '');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:38',message:'getArticles final URL',data:{url:finalUrl,searchParams:Object.fromEntries(searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  console.log('[getArticles] 最终 URL:', finalUrl, '完整参数:', Object.keys(params).map(k => `${k}=${params[k]}`).join(', '));
  return apiRequest(finalUrl);
}

export async function getSourcesStats(includeDisabled = false) {
  const query = includeDisabled ? '?include_disabled=1' : '';
  return apiRequest('/api/sources/stats' + query);
}

export async function getLatestBriefing() {
  // apiRequest 已经处理了 404，直接返回即可
  return apiRequest('/api/daily-briefings/latest');
}

export async function getScoreHistogram(params: Record<string, any> = {}) {
  const searchParams = new URLSearchParams();
  if (params.days !== undefined) searchParams.set('days', String(params.days));
  if (params.platform) searchParams.set('platform', params.platform);
  if (params.category) searchParams.set('category', params.category);
  if (params.tags) {
    console.log('[getScoreHistogram] 传递 tags 参数:', params.tags);
    searchParams.set('tags', params.tags);
  }
  if (params.search) {
    console.log('[getScoreHistogram] 传递 search 参数:', params.search);
    searchParams.set('search', params.search);
  }
  const query = searchParams.toString();
  console.log('[getScoreHistogram] 最终 URL:', '/api/stats/histogram' + (query ? '?' + query : ''), '完整参数:', Object.keys(params).map(k => `${k}=${params[k]}`).join(', '));
  return apiRequest('/api/stats/histogram' + (query ? '?' + query : ''));
}

