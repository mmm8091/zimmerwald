// Zimmerwald v1.1 RSS 抓取与解析工具函数
// - 负责从各个来源抓取 XML / Atom 并解析为统一的 RSSItem 数组

import { XMLParser } from 'fast-xml-parser';
import { APP_CONFIG } from '../config/app';
import type { RSSItem } from './types';

/**
 * 解析 RSS XML / Atom 源
 */
export async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    console.log(`开始抓取 RSS: ${url}`);
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`RSS 抓取超时 (30秒): ${url}`);
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
      const fetchTime = Date.now() - startTime;
      console.log(`RSS 请求完成，耗时: ${fetchTime}ms`);
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
      return [];
    }

    console.log(`RSS 响应成功，开始解析 XML...`);
    const xml = await response.text();
    console.log(`XML 长度: ${xml.length} 字符`);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const result = parser.parse(xml);
    const items: RSSItem[] = [];

    // 处理不同的 RSS 格式
    if (result.rss?.channel?.item) {
      const feedItems = Array.isArray(result.rss.channel.item)
        ? result.rss.channel.item
        : [result.rss.channel.item];
      items.push(...feedItems);
      console.log(`解析到 ${items.length} 条 RSS 文章`);
    } else if (result.feed?.entry) {
      // Atom 格式
      const feedItems = Array.isArray(result.feed.entry)
        ? result.feed.entry
        : [result.feed.entry];
      items.push(
        ...feedItems.map((entry: any) => ({
          title: entry.title?.['#text'] || entry.title,
          link: entry.link?.['@_href'] || entry.link,
          description:
            entry.summary?.['#text'] ||
            entry.summary ||
            entry.content?.['#text'] ||
            entry.content,
          pubDate: entry.published || entry.updated,
        }))
      );
      console.log(`解析到 ${items.length} 条 Atom 文章`);
    } else {
      console.warn(`无法识别 RSS 格式，尝试查找其他格式...`);
      console.log(`解析结果键: ${Object.keys(result).join(', ')}`);
    }

    return items;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`RSS 抓取超时: ${url}`);
    } else {
      console.error(`解析 RSS 时发生错误: ${url}`, error);
    }
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


