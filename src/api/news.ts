// Zimmerwald v1.1 /api/news 处理逻辑
// - 负责解析查询参数，调用核心 getNews，并返回 JSON

import { APP_CONFIG } from '../config/app';
import type { Env, NewsQueryOptions } from '../core/types';
import { getNews } from '../core/news';

export async function handleNewsApi(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const limitParam = url.searchParams.get('limit');
    const minScoreParam = url.searchParams.get('min_score');
    const categoryParam = url.searchParams.get('category');
    const tagParam = url.searchParams.get('tag');

    const limit = limitParam ? parseInt(limitParam, 10) : APP_CONFIG.newsListLimit;
    const minScore = minScoreParam ? parseInt(minScoreParam, 10) : undefined;
    const category = (categoryParam as NewsQueryOptions['category']) || undefined;
    const tag = tagParam || null;

    console.log('[/api/news] 查询参数:', { limit, minScore, category, tag });

    const articles = await getNews(env, {
      limit: Number.isNaN(limit) ? APP_CONFIG.newsListLimit : limit,
      minScore: Number.isNaN(minScore as number) ? undefined : minScore,
      category,
      tag,
    });

    console.log('[/api/news] 返回文章数量:', articles.length);

    return new Response(JSON.stringify(articles), {
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*', // 允许跨域
      },
    });
  } catch (error) {
    console.error('[/api/news] 处理请求时出错:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '未知错误',
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}


