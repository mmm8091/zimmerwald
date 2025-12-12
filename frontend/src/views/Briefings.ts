// Briefings 视图组件
import { h } from 'vue';
import { MainLayout } from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useQuery } from '../utils/useQuery';
import { getLatestBriefing } from '../api/client';
import { uiStore } from '../stores/uiStore';

export const Briefings = {
  setup() {
    const { data: latestBriefing } = useQuery({
      queryKey: ['briefings', 'latest'],
      queryFn: getLatestBriefing,
    });
    const getAlertVariant = (level: number) => {
      if (level <= 1) return 'danger';
      if (level <= 2) return 'warning';
      return 'default';
    };
    const getAlertLabel = (level: number) => {
      const config: Record<number, { labelZh: string; labelEn: string }> = {
        1: { labelZh: '烈火', labelEn: 'INFERNO' },
        2: { labelZh: '野火', labelEn: 'WILDFIRE' },
        3: { labelZh: '星火', labelEn: 'SPARK' },
        4: { labelZh: '硝烟', labelEn: 'SMOKE' },
        5: { labelZh: '迷雾', labelEn: 'FOG' },
      };
      const c = config[level] || config[5];
      return uiStore.lang === 'zh' ? c.labelZh : c.labelEn;
    };
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString(uiStore.lang === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };
    const renderMarkdown = (text: string) => {
      return text
        .replace(/### (.*)/g, '<h3 class="text-lg font-semibold text-zinc-200 mt-4 mb-2">$1</h3>')
        .replace(/## (.*)/g, '<h2 class="text-xl font-bold text-zinc-100 mt-6 mb-3">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-zinc-300">$1</em>')
        .replace(/\n\n/g, '</p><p class="text-zinc-400 mb-3">')
        .replace(/^/, '<p class="text-zinc-400 mb-3">')
        .replace(/$/, '</p>');
    };
    return () => h(MainLayout, {}, {
      default: () => h('div', { class: 'max-w-5xl mx-auto space-y-6' }, [
        h('div', {}, [
          h('h1', { class: 'text-3xl font-bold text-zinc-100 mb-2' },
            uiStore.lang === 'zh' ? '每日简报' : 'Daily Briefings'),
          h('p', { class: 'text-zinc-400' },
            uiStore.lang === 'zh' ? '每日战略情报摘要与分析' : 'Daily strategic intelligence summaries and analysis'),
        ]),
        latestBriefing.value && h(Card, {
          padding: 'lg',
          class: 'border-l-4 border-l-amber-500',
        }, {
          default: () => {
            const briefing = latestBriefing.value as any;
            return [
              h('div', { class: 'flex items-center justify-between mb-4' }, [
                h('div', { class: 'flex items-center gap-3' }, [
                  h(Badge, {
                    variant: getAlertVariant(briefing.defconLevel),
                  }, () => getAlertLabel(briefing.defconLevel)),
                  h('span', {
                    class: 'text-sm text-zinc-400',
                  }, formatDate(briefing.date)),
                ]),
                h('span', {
                  class: 'text-xs text-zinc-500',
                }, uiStore.lang === 'zh' ? '最新' : 'Latest'),
              ]),
              h('div', {
                class: 'prose prose-invert prose-zinc max-w-none mb-6',
                innerHTML: renderMarkdown(
                  uiStore.lang === 'zh'
                    ? briefing.contentZh
                    : briefing.contentEn || briefing.contentZh
                ),
              }),
              h('div', { class: 'grid grid-cols-3 gap-4 pt-4 border-t border-zinc-700' }, [
                h('div', {}, [
                  h('div', { class: 'text-sm text-zinc-400 mb-1' },
                    uiStore.lang === 'zh' ? '已分析' : 'Analyzed'),
                  h('div', { class: 'text-lg font-semibold text-zinc-100' },
                    String(briefing.stats?.total_analyzed || 0)),
                ]),
                h('div', {}, [
                  h('div', { class: 'text-sm text-zinc-400 mb-1' },
                    uiStore.lang === 'zh' ? '高价值' : 'High Value'),
                  h('div', { class: 'text-lg font-semibold text-amber-400' },
                    String(briefing.stats?.high_value_count || 0)),
                ]),
                h('div', {}, [
                  h('div', { class: 'text-sm text-zinc-400 mb-1' },
                    uiStore.lang === 'zh' ? '战略级' : 'Strategic'),
                  h('div', { class: 'text-lg font-semibold text-rose-400' },
                    String(briefing.stats?.strategic_count || 0)),
                ]),
              ]),
              briefing.stats?.top_keywords && briefing.stats.top_keywords.length > 0 && h('div', {
                class: 'mt-4 pt-4 border-t border-zinc-700',
              }, [
                h('div', { class: 'text-sm text-zinc-400 mb-2' },
                  uiStore.lang === 'zh' ? '关键词' : 'Keywords'),
                h('div', { class: 'flex flex-wrap gap-2' },
                  briefing.stats.top_keywords.map((keyword: any, idx: number) =>
                    h(Badge, {
                      key: idx,
                      variant: 'default',
                    }, () => [
                      uiStore.lang === 'zh' ? keyword.zh : keyword.en,
                      h('span', {
                        class: 'ml-1 text-xs opacity-70',
                      }, `(${keyword.count})`),
                    ])
                  )
                ),
              ]),
            ];
          },
        }),
        !latestBriefing.value && h('div', {
          class: 'text-center py-12 text-zinc-400',
        }, uiStore.lang === 'zh' ? '暂无简报数据' : 'No briefing data available'),
      ]),
    });
  },
};

