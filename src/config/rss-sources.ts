/**
 * RSS 源配置
 * 可以在这里添加、删除或启用/禁用 RSS 源
 */

export interface RSSSource {
  name: string;
  url: string;
  enabled: boolean;
}

export const RSS_SOURCES: RSSSource[] = [
  // ✅ 已验证可用且有文章的源（13个）
  { name: 'WSWS', url: 'https://www.wsws.org/en/rss.xml', enabled: true },
  { name: 'Peoples Dispatch', url: 'https://peoplesdispatch.org/feed/', enabled: true },
  { name: 'Liberation News', url: 'https://www.liberationnews.org/feed/', enabled: true },
  { name: 'Fight Back News', url: 'https://www.fightbacknews.org/feed/', enabled: true },
  { name: 'Workers World', url: 'https://www.workers.org/feed/', enabled: true },
  { name: 'Morning Star', url: 'https://morningstaronline.co.uk/rss.xml', enabled: true },
  { name: 'Jacobin', url: 'https://jacobin.com/feed', enabled: true },
  { name: 'CounterPunch', url: 'https://www.counterpunch.org/feed/', enabled: true },
  { name: 'Monthly Review', url: 'https://monthlyreview.org/feed/', enabled: true },
  { name: 'MR Online', url: 'https://mronline.org/feed/', enabled: true },
  { name: 'Left Voice', url: 'https://www.leftvoice.org/feed/', enabled: true },
  { name: 'International Viewpoint', url: 'https://internationalviewpoint.org/spip.php?page=backend', enabled: true },
  { name: 'Links International Journal', url: 'https://links.org.au/rss.xml', enabled: true },
  
  // ❌ 无文章的源（已禁用，可后续重新测试）
  { name: 'Red Herald', url: 'https://theredherald.org/feed/', enabled: false },
  { name: 'People\'s World', url: 'https://www.peoplesworld.org/feed/', enabled: false },
  { name: 'Socialist Worker', url: 'https://socialistworker.co.uk/feed/', enabled: false },
  { name: 'Green Left', url: 'https://www.greenleft.org.au/feed', enabled: false },
  { name: 'Red Flag', url: 'https://redflag.org.au/rss.xml', enabled: false },
  { name: 'The Activist', url: 'https://theactivist.org/feed/', enabled: false },
  { name: 'Revolutionary Communist Party', url: 'https://www.revcom.us/rss.xml', enabled: false },
  { name: 'World Socialist Web Site Chinese', url: 'https://www.wsws.org/zh-hans/rss.xml', enabled: false },
];

// 过滤启用的源
export const ENABLED_RSS_SOURCES = RSS_SOURCES.filter(source => source.enabled !== false);

