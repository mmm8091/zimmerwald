// TopBriefing 组件
import { h } from 'vue';
import { useQuery } from '../../utils/useQuery';
import { getLatestBriefing } from '../../api/client';
import { uiStore } from '../../stores/uiStore';

export const TopBriefing = {
  setup() {
    const { data: briefing, isError } = useQuery({
      queryKey: ['briefings', 'latest'],
      queryFn: getLatestBriefing,
    });

    function getAlertLabel(level: number) {
      const config: Record<number, { labelZh: string; labelEn: string }> = {
        1: { labelZh: '烈火', labelEn: 'INFERNO' },
        2: { labelZh: '野火', labelEn: 'WILDFIRE' },
        3: { labelZh: '星火', labelEn: 'SPARK' },
        4: { labelZh: '硝烟', labelEn: 'SMOKE' },
        5: { labelZh: '迷雾', labelEn: 'FOG' },
      };
      const c = config[level] || config[5];
      return uiStore.lang === 'zh' ? c.labelZh : c.labelEn;
    }

    function formatStats(stats: any) {
      if (!stats) return '';
      if (uiStore.lang === 'zh') {
        return `${stats.total_analyzed} 条已分析 · ${stats.strategic_count} 条战略级 (80+)`;
      }
      return `${stats.total_analyzed} REPORTS ANALYZED · ${stats.strategic_count} STRATEGIC (80+)`;
    }

    return () => {
      if (!briefing.value || isError.value) return null;
      const briefingData = briefing.value as any;
      
      return h('div', {
        class: 'bg-zinc-800 border-b border-zinc-700 px-6 py-3',
      }, [
        h('div', { class: 'flex items-center justify-between' }, [
          h('div', { class: 'flex items-center gap-4' }, [
            h('div', {
              class: 'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-rose-900/50 text-rose-300',
            }, getAlertLabel(briefingData.defconLevel)),
            h('div', { class: 'text-sm text-zinc-300' }, [
              h('span', { class: 'font-semibold' }, uiStore.lang === 'zh' ? '24小时简报' : '24-HOUR BRIEFING'),
              h('span', { class: 'mx-2' }, '·'),
              h('span', formatStats(briefingData.stats)),
            ]),
          ]),
          h('a', {
            href: '#/briefings',
            class: 'text-xs text-zinc-400 hover:text-zinc-200 transition-colors',
          }, uiStore.lang === 'zh' ? '查看详情 →' : 'View Details →'),
        ]),
      ]);
    };
  },
};

