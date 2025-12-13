// ScoreHistogram 组件
import { h, computed } from 'vue';
import { useQuery } from '../../utils/useQuery';
import { getScoreHistogram } from '../../api/client';
import { filterStore } from '../../stores/filterStore';

export const ScoreHistogram = {
  setup() {
    // 直方图参数：包含所有筛选条件，但排除分数范围
    const histogramParams = computed(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ScoreHistogram.ts:10',message:'histogramParams computed executing',data:{platform:filterStore.selectedPlatform,category:filterStore.selectedCategory,tags:filterStore.selectedTags,search:filterStore.searchKeyword,days:filterStore.days},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      // 确保 computed 响应所有筛选条件的变化 - 直接访问 filterStore 属性
      const params: Record<string, any> = {
        days: filterStore.days,
      };
      if (filterStore.selectedPlatform) params.platform = filterStore.selectedPlatform;
      if (filterStore.selectedCategory) params.category = filterStore.selectedCategory;
      if (filterStore.selectedTags.length > 0) params.tags = filterStore.selectedTags.join(',');
      if (filterStore.searchKeyword.trim()) params.search = filterStore.searchKeyword.trim();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c7c0288b-5f18-4399-aeaf-b757cde2bb7c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ScoreHistogram.ts:22',message:'histogramParams computed returning',data:params,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      console.log('[ScoreHistogram] histogramParams computed - 筛选条件:', {
        platform: filterStore.selectedPlatform,
        category: filterStore.selectedCategory,
        tags: filterStore.selectedTags,
        search: filterStore.searchKeyword,
        days: filterStore.days,
      });
      console.log('[ScoreHistogram] histogramParams:', JSON.stringify(params, null, 2));
      return params;
    });

    const { data: histogramData } = useQuery({
      queryKey: computed(() => ['histogram', histogramParams.value]),
      queryFn: () => getScoreHistogram(histogramParams.value),
    });
    
    const histogram = computed(() => {
      if (!histogramData.value || !(histogramData.value as any).histogram) {
        return Array.from({ length: 11 }, (_, i) => ({ bucket: i * 10, count: 0 }));
      }
      return (histogramData.value as any).histogram;
    });
    
    const isInRange = (bucket: number) => {
      return bucket >= filterStore.scoreRange[0] && bucket < filterStore.scoreRange[1];
    };
    
    const getHeight = (count: number) => {
      const max = Math.max(...histogram.value.map((b: any) => b.count), 1);
      return max > 0 ? (count / max) * 100 : 0;
    };
    
    return () => h('div', { class: 'space-y-4' }, [
      h('div', { class: 'flex items-end gap-1 h-32 relative' }, histogram.value.map((bucket: any, idx: number) => {
        const bucketLabel = bucket.bucket === 0 
          ? `0-9分: ${bucket.count}篇文章`
          : `${bucket.bucket}-${bucket.bucket + 9}分: ${bucket.count}篇文章`;
        return h('div', {
          key: idx,
          class: [
            'flex-1 rounded-t transition-all cursor-pointer group',
            // 背景直方图：所有柱状图都显示（完整分布）
            isInRange(bucket.bucket) 
              ? 'bg-zinc-500 hover:bg-zinc-400' // 当前分数范围内的柱状图高亮
              : 'bg-zinc-700 hover:bg-zinc-600', // 其他柱状图作为背景
          ],
          style: { height: `${getHeight(bucket.count)}%` },
          title: bucketLabel,
        }, [
          // 悬停提示框
          h('div', {
            class: 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 text-zinc-100 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-zinc-700',
            style: { display: bucket.count > 0 ? 'block' : 'none' },
          }, bucketLabel),
        ]);
      })),
      h('div', { class: 'space-y-2' }, [
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 10,
          value: filterStore.scoreRange[0],
          class: 'w-full',
          onInput: (e: any) => {
            const val = parseInt(e.target.value);
            if (val <= filterStore.scoreRange[1]) {
              filterStore.setScoreRange([val, filterStore.scoreRange[1]]);
            }
          },
        }),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 10,
          value: filterStore.scoreRange[1],
          class: 'w-full',
          onInput: (e: any) => {
            const val = parseInt(e.target.value);
            if (val >= filterStore.scoreRange[0]) {
              filterStore.setScoreRange([filterStore.scoreRange[0], val]);
            }
          },
        }),
        h('div', { class: 'flex justify-between text-xs text-zinc-400' }, [
          h('span', String(filterStore.scoreRange[0])),
          h('span', String(filterStore.scoreRange[1])),
        ]),
      ]),
    ]);
  },
};

