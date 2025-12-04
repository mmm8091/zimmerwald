// Zimmerwald v1.1 /api/feedback 处理逻辑
// - 负责接收群众审计投票，写入 feedback 表，并做简单防刷

import type { Env } from '../core/types';
import { simpleHash } from '../core/db';

export async function handleFeedbackApi(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = (await request.json()) as { article_id?: number; vote_type?: string };
    const articleId = body.article_id;
    const voteType = body.vote_type;

    if (!articleId || typeof articleId !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: '缺少或非法的 article_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    const validVoteTypes = ['too_high', 'accurate', 'too_low'] as const;
    if (!voteType || !validVoteTypes.includes(voteType as any)) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少或非法的 vote_type' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    // 检查文章是否存在
    const articleExists = await env.DB
      .prepare('SELECT id FROM articles WHERE id = ? LIMIT 1')
      .bind(articleId)
      .first();
    if (!articleExists) {
      return new Response(
        JSON.stringify({ success: false, message: '文章不存在' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    // 生成 user_hash（基于 IP + UA 的简易指纹）
    const ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('x-forwarded-for') ||
      'unknown_ip';
    const ua = request.headers.get('User-Agent') || 'unknown_ua';
    const userHash = simpleHash(`${ip}|${ua}`);

    const now = Date.now();

    // 检查是否已有该用户对该文章的反馈
    const existing = await env.DB
      .prepare('SELECT id FROM feedback WHERE article_id = ? AND user_hash = ? LIMIT 1')
      .bind(articleId, userHash)
      .first<{ id: number }>();

    if (existing && existing.id) {
      // 已存在则更新最新投票
      await env.DB
        .prepare(
          `UPDATE feedback 
           SET vote_type = ?, created_at = ? 
           WHERE id = ?`
        )
        .bind(voteType, now, existing.id)
        .run();
    } else {
      // 否则插入新记录
      await env.DB
        .prepare(
          `INSERT INTO feedback (article_id, vote_type, user_hash, created_at) 
           VALUES (?, ?, ?, ?)`
        )
        .bind(articleId, voteType, userHash, now)
        .run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    console.error('处理 /api/feedback 时出错:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: '内部错误',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}


