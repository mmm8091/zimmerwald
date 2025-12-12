// Sources 视图组件
import { h, computed } from 'vue';
import { MainLayout } from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useQuery } from '../utils/useQuery';
import { getSourcesStats } from '../api/client';
import { uiStore } from '../stores/uiStore';

export const Sources = {
  setup() {
    const { data: statsData, isLoading } = useQuery({
      queryKey: ['sources', 'stats'],
      queryFn: () => getSourcesStats(false),
    });
    const sourcesData = computed(() => (statsData.value as any)?.sources || []);
    const totalVolume = computed(() => {
      if (!statsData.value) return 0;
      const data = statsData.value as any;
      const byPlatform = data.stats?.byPlatform;
      if (!byPlatform) return 0;
      return byPlatform.News.volume + byPlatform.Twitter.volume + byPlatform.Telegram.volume;
    });
    const getPlatformIcon = (platform: string) => {
      const icons: Record<string, string> = { News: '📰', Twitter: '🐦', Telegram: '✈️' };
      return icons[platform] || '🗂️';
    };
    const getStatusVariant = (status: string) => {
      if (!status) return 'default';
      if (status.startsWith('Error')) return 'danger';
      return 'success';
    };
    const getStatusLabel = (status: string, enabled: boolean) => {
      if (!enabled) return uiStore.lang === 'zh' ? '已禁用' : 'Disabled';
      if (!status) return uiStore.lang === 'zh' ? '未知' : 'Unknown';
      if (status.startsWith('Error')) return uiStore.lang === 'zh' ? '错误' : 'Error';
      return uiStore.lang === 'zh' ? '正常' : 'OK';
    };
    const getScoreVariant = (score: number) => {
      if (score >= 80) return 'danger';
      if (score >= 60) return 'warning';
      if (score >= 40) return 'success';
      return 'default';
    };
    const formatScore = (score: number) => score.toFixed(1);
    const formatDateTime = (timestamp: number) => {
      if (!timestamp) return uiStore.lang === 'zh' ? '从未' : 'Never';
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (minutes < 1) return uiStore.lang === 'zh' ? '刚刚' : 'Just now';
      if (minutes < 60) return `${minutes}${uiStore.lang === 'zh' ? '分钟前' : 'm ago'}`;
      if (hours < 24) return `${hours}${uiStore.lang === 'zh' ? '小时前' : 'h ago'}`;
      if (days < 7) return `${days}${uiStore.lang === 'zh' ? '天前' : 'd ago'}`;
      return date.toLocaleDateString(uiStore.lang === 'zh' ? 'zh-CN' : 'en-US');
    };
    return () => h(MainLayout, {}, {
      default: () => h('div', { class: 'max-w-7xl mx-auto space-y-6' }, [
        h('div', {}, [
          h('h1', { class: 'text-3xl font-bold text-zinc-100 mb-2' },
            uiStore.lang === 'zh' ? '信源健康度' : 'Source Health'),
          h('p', { class: 'text-zinc-400' },
            uiStore.lang === 'zh' ? '监控所有订阅源的状态和表现' : 'Monitor status and performance of all sources'),
        ]),
        statsData.value && h('div', { class: 'grid grid-cols-1 md:grid-cols-4 gap-4' }, [
          h(Card, { padding: 'md' }, {
            default: () => {
              const data = statsData.value as any;
              return [
                h('div', { class: 'text-sm text-zinc-400 mb-1' },
                  uiStore.lang === 'zh' ? '总源数' : 'Total Sources'),
                h('div', { class: 'text-2xl font-bold text-zinc-100' },
                  String(data.stats?.total || 0)),
              ];
            },
          }),
          h(Card, { padding: 'md' }, {
            default: () => {
              const data = statsData.value as any;
              return [
                h('div', { class: 'text-sm text-zinc-400 mb-1' },
                  uiStore.lang === 'zh' ? '已启用' : 'Enabled'),
                h('div', { class: 'text-2xl font-bold text-green-400' },
                  String(data.stats?.enabled || 0)),
              ];
            },
          }),
          h(Card, { padding: 'md' }, {
            default: () => {
              const data = statsData.value as any;
              return [
                h('div', { class: 'text-sm text-zinc-400 mb-1' },
                  uiStore.lang === 'zh' ? '已禁用' : 'Disabled'),
                h('div', { class: 'text-2xl font-bold text-zinc-500' },
                  String(data.stats?.disabled || 0)),
              ];
            },
          }),
          h(Card, { padding: 'md' }, {
            default: () => [
              h('div', { class: 'text-sm text-zinc-400 mb-1' },
                uiStore.lang === 'zh' ? '30天总量' : '30d Volume'),
              h('div', { class: 'text-2xl font-bold text-zinc-100' },
                String(totalVolume.value)),
            ],
          }),
        ]),
        h(Card, { padding: 'none' }, {
          default: () => h('div', { class: 'overflow-x-auto' }, [
            h('table', { class: 'w-full' }, [
              h('thead', { class: 'bg-zinc-800 border-b border-zinc-700' }, [
                h('tr', {}, [
                  h('th', { class: 'px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase' },
                    uiStore.lang === 'zh' ? '信源' : 'Source'),
                  h('th', { class: 'px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase' },
                    uiStore.lang === 'zh' ? '状态' : 'Status'),
                  h('th', { class: 'px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase' },
                    uiStore.lang === 'zh' ? '30天总量' : 'Volume (30d)'),
                  h('th', { class: 'px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase' },
                    uiStore.lang === 'zh' ? '平均质量' : 'Avg Quality'),
                  h('th', { class: 'px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase' },
                    uiStore.lang === 'zh' ? '最后抓取' : 'Last Fetched'),
                ]),
              ]),
              h('tbody', { class: 'divide-y divide-zinc-700' }, [
                isLoading.value ? h('tr', {}, [
                  h('td', {
                    colspan: 5,
                    class: 'px-6 py-12 text-center text-zinc-400',
                  }, uiStore.lang === 'zh' ? '加载中...' : 'Loading...'),
                ])
                : sourcesData.value.length === 0 ? h('tr', {}, [
                  h('td', {
                    colspan: 5,
                    class: 'px-6 py-12 text-center text-zinc-400',
                  }, uiStore.lang === 'zh' ? '暂无数据' : 'No data available'),
                ])
                : sourcesData.value.map((source: any) => h('tr', {
                  key: source.slug,
                  class: 'hover:bg-zinc-800 transition-colors',
                }, [
                  h('td', { class: 'px-6 py-4 whitespace-nowrap' }, [
                    h('div', { class: 'flex items-center gap-2' }, [
                      h('span', getPlatformIcon(source.platform)),
                      h('a', {
                        href: source.url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        class: 'text-zinc-100 hover:text-zinc-300 transition-colors',
                      }, source.name),
                    ]),
                  ]),
                  h('td', { class: 'px-6 py-4 whitespace-nowrap' }, [
                    h(Badge, {
                      variant: getStatusVariant(source.lastStatus),
                    }, () => getStatusLabel(source.lastStatus, source.enabled)),
                  ]),
                  h('td', { class: 'px-6 py-4 whitespace-nowrap text-zinc-300' },
                    String(source.volume30d)),
                  h('td', { class: 'px-6 py-4 whitespace-nowrap' }, [
                    h(Badge, {
                      variant: getScoreVariant(source.avgScore30d),
                    }, () => formatScore(source.avgScore30d)),
                  ]),
                  h('td', {
                    class: 'px-6 py-4 whitespace-nowrap text-sm text-zinc-400',
                  }, formatDateTime(source.lastFetchedAt)),
                ])),
              ]),
            ]),
          ]),
        }),
      ]),
    });
  },
};

