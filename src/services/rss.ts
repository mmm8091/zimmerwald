// Zimmerwald v1.2 RSS 服务
// 封装 RSS 抓取和解析逻辑

import { XMLParser } from 'fast-xml-parser';
import { APP_CONFIG } from '../config/app';

export interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  'content:encoded'?: string;
}

/**
 * 抓取并解析 RSS Feed
 */
export async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    console.log(`开始抓取 RSS: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, APP_CONFIG.rssFetchTimeout);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
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
      console.error(`获取 RSS 失败: ${url} - ${response.status}`);
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

