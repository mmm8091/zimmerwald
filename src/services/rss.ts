// Zimmerwald v1.3 RSS 服务
// 封装 RSS 抓取和解析逻辑，支持 RSSHub 源清洗

import { XMLParser } from 'fast-xml-parser';
import { decode } from 'html-entities';
import { APP_CONFIG } from '../config/app';
import type { PlatformType } from './types';

export interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  'content:encoded'?: string;
}

/**
 * 抓取并解析 RSS Feed
 * v1.3: 针对 RSSHub 源添加更完整的请求头
 */
export async function fetchRSSFeed(url: string, isRssHub: boolean = false): Promise<RSSItem[]> {
  try {
    console.log(`开始抓取 RSS: ${url}`);
    // 兼容未带协议的地址，默认补 https://
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, APP_CONFIG.rssFetchTimeout);

    // 构建请求头
    // RSSHub 源需要模拟同源请求，避免 CORS 或安全策略拦截
    const headers: HeadersInit = isRssHub
      ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          // 不设置 Accept-Encoding，让 Cloudflare Workers 自动处理
          // 设置 Origin 为 RSSHub 的地址，模拟同源请求
          'Origin': new URL(safeUrl).origin,
          'Referer': safeUrl,
        }
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        };

    let response: Response;
    try {
      response = await fetch(safeUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`RSS 抓取超时: ${url}`);
      } else {
        console.error(`RSS 请求失败: ${url}`, fetchError);
      }
      return [];
    }

    if (!response.ok) {
      console.error(`获取 RSS 失败: ${url} - ${response.status} ${response.statusText}`);
      // 对于 403 错误，输出更多调试信息
      if (response.status === 403) {
        console.error(`RSSHub 403 错误：可能是服务器限制或需要认证。URL: ${url}`);
      }
      return [];
    }

    const xml = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const result = parser.parse(xml);
    const items: RSSItem[] = [];

    // 处理 RSS 格式
    if (result.rss?.channel?.item) {
      const feedItems = Array.isArray(result.rss.channel.item) ? result.rss.channel.item : [result.rss.channel.item];
      items.push(...feedItems);
    } else if (result.feed?.entry) {
      // Atom 格式
      const feedItems = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
      items.push(
        ...feedItems.map((entry: any) => ({
          title: entry.title?.['#text'] || entry.title,
          link: entry.link?.['@_href'] || entry.link,
          description:
            entry.summary?.['#text'] || entry.summary || entry.content?.['#text'] || entry.content,
          pubDate: entry.published || entry.updated,
        }))
      );
    }

    return items;
  } catch (error) {
    console.error(`解析 RSS 时发生错误: ${url}`, error);
    return [];
  }
}

/**
 * 解析日期字符串为时间戳
 */
export function parseDate(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).getTime();
  } catch {
    return null;
  }
}

/**
 * HTML 实体解码（使用 html-entities 包）
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return decode(text);
}

/**
 * 清洗 RSSHub 返回的内容（Twitter/Telegram）
 * 移除 HTML 标签，保留纯文本，处理特殊格式
 * 
 * News 平台：只做基本 HTML 标签移除和实体解码（AI 分析不需要 HTML）
 * Twitter/Telegram：彻底清洗，移除 RSSHub 广告、处理图片标记等
 */
export function sanitizeContent(html: string, platform: PlatformType): string {
  if (!html) return '';

  let cleanText = html;

  // RSSHub 源（Twitter/Telegram）需要特殊处理
  if (platform === 'Twitter' || platform === 'Telegram') {
    // 1. 移除 RSSHub 注入的广告或尾巴
    cleanText = cleanText.replace(/Powered by RSSHub/gi, '');
    cleanText = cleanText.replace(/via RSSHub/gi, '');

    // 2. 将 <br> 和 <br/> 换成换行符
    cleanText = cleanText.replace(/<br\s*\/?>/gi, '\n');

    // 3. 处理图片/视频标签（保留标记，去除大段代码）
    if (cleanText.includes('<img') || cleanText.includes('<video')) {
      cleanText = cleanText.replace(/<img[^>]*>/gi, '[图片]');
      cleanText = cleanText.replace(/<video[^>]*>.*?<\/video>/gi, '[视频]');
    }

    // 4. 移除所有 HTML 标签
    cleanText = cleanText.replace(/<[^>]*>/g, '');

    // 5. 清理多余的空白字符
    cleanText = cleanText.replace(/\n\s*\n/g, '\n').trim();
  } else if (platform === 'News') {
    // News 平台：只移除 HTML 标签，不做 RSSHub 特有清洗
    // 移除标签时不留空格，避免产生多余空白
    cleanText = cleanText.replace(/<[^>]*>/g, '');
    // 清理多余的空白字符（包括换行、制表符等）
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
  }

  // 解码 HTML 实体（所有平台都需要）
  cleanText = decodeHtmlEntities(cleanText);

  return cleanText.trim();
}

