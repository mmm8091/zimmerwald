// ScoreHistogram 组件
import { h, computed } from 'vue';
import { useQuery } from '../../utils/useQuery';
import { getScoreHistogram } from '../../api/client';
import { filterStore } from '../../stores/filterStore';

export const ScoreHistogram = {
  setup() {
    // 直方图参数：包含所有筛选条件，但排除分数范围
    const histogramParams = computed(() => {
      const params: Record<string, any> = {
        days: filterStore.days,
      };
      if (filterStore.selectedPlatform) params.platform = filterStore.selectedPlatform;
      if (filterStore.selectedCategory) params.category = filterStore.selectedCategory;
      if (filterStore.selectedTags.length > 0) params.tags = filterStore.selectedTags.join(',');
      if (filterStore.searchKeyword.trim()) params.search = filterStore.searchKeyword.trim();
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
      h('div', { class: 'flex items-end gap-1 h-32' }, histogram.value.map((bucket: any, idx: number) =>
        h('div', {
          key: idx,
          class: [
            'flex-1 rounded-t transition-all',
            // 背景直方图：所有柱状图都显示（完整分布）
            isInRange(bucket.bucket) 
              ? 'bg-zinc-500' // 当前分数范围内的柱状图高亮
              : 'bg-zinc-700', // 其他柱状图作为背景
          ],
          style: { height: `${getHeight(bucket.count)}%` },
          title: `${bucket.bucket}-${bucket.bucket + 9}: ${bucket.count}`,
        })
      )),
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

