/**
 * RSS 源配置 (v1.3)
 * 运行时通过 env.RSSHUB_BASE 拼接 RSSHub URL
 */
import { APP_CONFIG } from './app';
import type { PlatformType } from '../services/types';

export interface RSSSource {
  id: string;
  name: string;
  url: string;
  platform: PlatformType;
  enabled: boolean;
  isRssHub?: boolean;
  rsshubPath?: string; // 仅模板使用
}

type SourceTemplate = Omit<RSSSource, 'url'> & { url?: string };

export const SOURCE_TEMPLATES: SourceTemplate[] = [
  // === 传统新闻源 (News) ===
  { id: 'wsws', name: 'WSWS', url: 'https://www.wsws.org/en/rss.xml', platform: 'News', enabled: true },
  { id: 'peoples_dispatch', name: 'Peoples Dispatch', url: 'https://peoplesdispatch.org/feed/', platform: 'News', enabled: true },
  { id: 'liberation_news', name: 'Liberation News', url: 'https://www.liberationnews.org/feed/', platform: 'News', enabled: true },
  { id: 'fight_back_news', name: 'Fight Back News', url: 'https://www.fightbacknews.org/feed/', platform: 'News', enabled: true },
  { id: 'workers_world', name: 'Workers World', url: 'https://www.workers.org/feed/', platform: 'News', enabled: true },
  { id: 'morning_star', name: 'Morning Star', url: 'https://morningstaronline.co.uk/rss.xml', platform: 'News', enabled: true },
  { id: 'jacobin', name: 'Jacobin', url: 'https://jacobin.com/feed', platform: 'News', enabled: true },
  { id: 'counterpunch', name: 'CounterPunch', url: 'https://www.counterpunch.org/feed/', platform: 'News', enabled: true },
  { id: 'monthly_review', name: 'Monthly Review', url: 'https://monthlyreview.org/feed/', platform: 'News', enabled: true },
  { id: 'mr_online', name: 'MR Online', url: 'https://mronline.org/feed/', platform: 'News', enabled: true },
  { id: 'left_voice', name: 'Left Voice', url: 'https://www.leftvoice.org/feed/', platform: 'News', enabled: true },
  { id: 'international_viewpoint', name: 'International Viewpoint', url: 'https://internationalviewpoint.org/spip.php?page=backend', platform: 'News', enabled: true },
  { id: 'links_international', name: 'Links International Journal', url: 'https://links.org.au/rss.xml', platform: 'News', enabled: true },

  // === Twitter 源 (通过 RSSHub) ===
  { id: 'tw_uaw', name: 'UAW (Twitter)', rsshubPath: '/twitter/user/UAW', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_teamsters', name: 'Teamsters (Twitter)', rsshubPath: '/twitter/user/Teamsters', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_strikemap', name: 'StrikeMapUS (Twitter)', rsshubPath: '/twitter/user/StrikeMapUS', platform: 'Twitter', enabled: false, isRssHub: true },
  { id: 'tw_labornotes', name: 'LaborNotes (Twitter)', rsshubPath: '/twitter/user/LaborNotes', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_moreperfect', name: 'More Perfect Union (Twitter)', rsshubPath: '/twitter/user/MorePerfectUS', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_public_citizen', name: 'Public Citizen (Twitter)', rsshubPath: '/twitter/user/Public_Citizen', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_dsa', name: 'DSA (Twitter)', rsshubPath: '/twitter/user/DemSocialists', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_jacobin', name: 'Jacobin (Twitter)', rsshubPath: '/twitter/user/Jacobin', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_bertrand', name: 'Arnaud Bertrand (Twitter)', rsshubPath: '/twitter/user/RnaudBertrand', platform: 'Twitter', enabled: true, isRssHub: true },
  { id: 'tw_peoples_party', name: 'Peoples Party (Twitter)', rsshubPath: '/twitter/user/PeoplesParty', platform: 'Twitter', enabled: true, isRssHub: true },

  // === Telegram 源 (通过 RSSHub) ===
  { id: 'tg_geopolitics', name: 'Geopolitics Live (TG)', rsshubPath: '/telegram/channel/geopolitics_live', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_bellum', name: 'Bellum Acta (TG)', rsshubPath: '/telegram/channel/BellumActaNews', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_intelslava', name: 'Intel Slava (TG)', rsshubPath: '/telegram/channel/intelslava', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_palestine', name: 'Palestine Resist (TG)', rsshubPath: '/telegram/channel/PalestineResist', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_redstream', name: 'Red Stream Network (TG)', rsshubPath: '/telegram/channel/redstreamnet', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_islander', name: 'The Islander (TG)', rsshubPath: '/telegram/channel/TheIslanderNews', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_disclosetv', name: 'disclosetv (TG)', rsshubPath: '/telegram/channel/disclosetv', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_medvedev', name: 'Medvedev (TG)', rsshubPath: '/telegram/channel/MedvedevRussiaE', platform: 'Telegram', enabled: true, isRssHub: true },
  { id: 'tg_shuinc', name: 'Shuinc (TG)', rsshubPath: '/telegram/channel/shuinc', platform: 'Telegram', enabled: true, isRssHub: true },
];

export const SOURCE_NAME_MAP: Record<string, string> = SOURCE_TEMPLATES.reduce((acc, cur) => {
  acc[cur.id] = cur.name;
  return acc;
}, {} as Record<string, string>);

function resolveBase(rssHubBase?: string): string {
  const base = (rssHubBase || APP_CONFIG.rssHubBase || '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('RSSHUB_BASE is not set. Please configure it as an environment variable.');
  }
  return base;
}

export function buildRssSources(rssHubBase?: string): RSSSource[] {
  const base = resolveBase(rssHubBase);
  return SOURCE_TEMPLATES.map((tpl) => {
    if (tpl.isRssHub) {
      return { ...tpl, url: `${base}${tpl.rsshubPath}`, rsshubPath: undefined };
    }
    return { ...tpl, url: tpl.url || '' };
  });
}

export function getEnabledRssSources(rssHubBase?: string) {
  return buildRssSources(rssHubBase).filter((source) => source.enabled !== false);
}

export function getRssSourcesByPlatform(rssHubBase?: string) {
  const enabled = getEnabledRssSources(rssHubBase);
  return {
    News: enabled.filter((source) => source.platform === 'News'),
    Twitter: enabled.filter((source) => source.platform === 'Twitter'),
    Telegram: enabled.filter((source) => source.platform === 'Telegram'),
  };
}