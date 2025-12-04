/**
 * Zimmerwald (齐默尔瓦尔德) v1.1 "International"
 * 国际共运新闻聚合平台 - Cloudflare Workers 后端
 * 
 * 主入口文件：路由分发和 Worker 生命周期管理
 */

import { Env } from './src/core/types';
import { handleNewsApi } from './src/api/news';
import { handleFeedbackApi } from './src/api/feedback';
import { handleTestAllRss, handleTestLlm, handleTestRss, handleTestTags, handleTestFetch } from './src/api/test';
import { handleScheduled } from './src/scheduler';
import { generateHTML } from './src/frontend/html';


/**
 * Worker 主入口
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 测试端点路由
    if (url.pathname === '/test/all-rss') {
      return handleTestAllRss(env);
    }
    if (url.pathname === '/test/llm') {
      return handleTestLlm(env, url);
    }
    if (url.pathname === '/test/rss') {
      return handleTestRss(url);
    }
    if (url.pathname === '/test/tags') {
      return handleTestTags(env);
    }
    if (url.pathname === '/test/fetch') {
      return handleTestFetch(env, url);
    }

    // API 路由
    if (url.pathname === '/api/news') {
      return handleNewsApi(request, env, url);
    }

    // 群众审计：记录对评分的反馈
    if (url.pathname === '/api/feedback') {
      return handleFeedbackApi(request, env, url);
    }

    // 前端页面
    if (url.pathname === '/') {
      // 首页由前端通过 /api/news 动态加载数据，这里只返回壳页面
      const html = generateHTML();
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

