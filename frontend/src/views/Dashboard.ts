// Dashboard 视图组件
import { h, computed, watch } from 'vue';
import { MainLayout } from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ScoreHistogram } from '../components/layout/ScoreHistogram';
import { useQuery } from '../utils/useQuery';
import { getArticles } from '../api/client';
import { filterStore } from '../stores/filterStore';
import { uiStore } from '../stores/uiStore';

export const Dashboard = {
  setup() {
    // 用于标签云的文章数据（不包括标签筛选，且不受 limit 限制）
    const tagCloudParams = computed(() => {
      const params = { ...filterStore.queryParams };
      delete params.tags; // 标签云不包含标签筛选
      delete params.limit; // 标签云需要所有满足条件的文章，不受 limit 限制
      // 设置一个很大的 limit 值，确保获取所有文章用于标签云统计
      params.limit = 10000;
      console.log('[Dashboard] tagCloudParams:', params);
      return params;
    });
    
    const { data: articlesData, isLoading, isError, refetch } = useQuery({
      queryKey: computed(() => ['articles', filterStore.queryParams]),
      queryFn: () => {
        console.log('[Dashboard] 查询文章，参数:', filterStore.queryParams);
        return getArticles(filterStore.queryParams);
      },
    });
    
    // 用于标签云的数据（基于当前筛选，但不包括标签筛选）
    const { data: tagCloudData } = useQuery({
      queryKey: computed(() => ['articles-for-tags', tagCloudParams.value]),
      queryFn: () => {
        console.log('[Dashboard] 查询标签云数据，参数:', tagCloudParams.value);
        return getArticles(tagCloudParams.value);
      },
    });

    watch(() => filterStore.queryParams, () => {
      refetch();
    }, { deep: true });

    const platforms = [
      { value: 'News', labelZh: '新闻', labelEn: 'News', icon: '📰' },
      { value: 'Twitter', labelZh: 'Twitter', labelEn: 'Twitter', icon: '🐦' },
      { value: 'Telegram', labelZh: 'Telegram', labelEn: 'Telegram', icon: '✈️' },
    ];

    const categories = [
      { value: 'Labor', labelZh: '劳工', labelEn: 'Labor' },
      { value: 'Politics', labelZh: '政治', labelEn: 'Politics' },
      { value: 'Conflict', labelZh: '冲突', labelEn: 'Conflict' },
      { value: 'Theory', labelZh: '理论', labelEn: 'Theory' },
    ];

    return () => h(MainLayout, {}, {
      default: () => h('div', { class: 'max-w-7xl mx-auto space-y-6 p-6' }, [
        h('div', {}, [
          h('h1', { class: 'text-3xl font-bold text-zinc-100 mb-2' },
            uiStore.lang === 'zh' ? '情报中心' : 'Intelligence Dashboard'),
          h('p', { class: 'text-zinc-400' },
            uiStore.lang === 'zh' ? '实时监控全球共运动态' : 'Real-time monitoring of global movement dynamics'),
        ]),
        h('div', { class: 'grid grid-cols-1 lg:grid-cols-4 gap-6' }, [
          h('div', { class: 'lg:col-span-1 space-y-6' }, [
            // Time Filter - 独立显示在最上面
            h(Card, { padding: 'md' }, {
              default: () => [
                h('h2', { class: 'text-lg font-semibold text-zinc-100 mb-4' },
                  uiStore.lang === 'zh' ? '时间筛选' : 'Time Filter'),
                h('select', {
                  class: 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600',
                  value: filterStore.days,
                  onChange: (e: any) => { filterStore.days = parseInt(e.target.value); },
                }, [
                  h('option', { value: 1 }, uiStore.lang === 'zh' ? '24小时内' : '24 hours'),
                  h('option', { value: 7 }, uiStore.lang === 'zh' ? '7天内' : '7 days'),
                  h('option', { value: 30 }, uiStore.lang === 'zh' ? '30天内' : '30 days'),
                  h('option', { value: 90 }, uiStore.lang === 'zh' ? '90天内' : '90 days'),
                  h('option', { value: 0 }, uiStore.lang === 'zh' ? '全部' : 'All'),
                ]),
              ],
            }),
            // Score Histogram Filter
            h(Card, { padding: 'md' }, {
              default: () => [
                h('h2', { class: 'text-lg font-semibold text-zinc-100 mb-4' },
                  uiStore.lang === 'zh' ? '分数筛选' : 'Score Filter'),
                h(ScoreHistogram),
              ],
            }),
            // Platform Filter
            h(Card, { padding: 'md' }, {
              default: () => [
                h('h2', { class: 'text-lg font-semibold text-zinc-100 mb-4' },
                  uiStore.lang === 'zh' ? '平台' : 'Platform'),
                h('div', { class: 'space-y-2' }, [
                  ...platforms.map(p => h('label', {
                    key: p.value,
                    class: [
                      'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      filterStore.selectedPlatform === p.value
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                    ],
                  }, [
                    h('input', {
                      type: 'radio',
                      value: p.value,
                      checked: filterStore.selectedPlatform === p.value,
                      class: 'sr-only',
                      onChange: () => filterStore.setPlatform(p.value),
                    }),
                    h('span', p.icon),
                    h('span', uiStore.lang === 'zh' ? p.labelZh : p.labelEn),
                  ])),
                  h('label', {
                    class: [
                      'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      filterStore.selectedPlatform === null
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                    ],
                  }, [
                    h('input', {
                      type: 'radio',
                      checked: filterStore.selectedPlatform === null,
                      class: 'sr-only',
                      onChange: () => filterStore.setPlatform(null),
                    }),
                    h('span', uiStore.lang === 'zh' ? '全部' : 'All'),
                  ]),
                ]),
              ],
            }),
            // Category Filter
            h(Card, { padding: 'md' }, {
              default: () => [
                h('h2', { class: 'text-lg font-semibold text-zinc-100 mb-4' },
                  uiStore.lang === 'zh' ? '分类' : 'Category'),
                h('div', { class: 'space-y-2' }, [
                  ...categories.map(cat => h('label', {
                    key: cat.value,
                    class: [
                      'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      filterStore.selectedCategory === cat.value
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                    ],
                  }, [
                    h('input', {
                      type: 'radio',
                      value: cat.value,
                      checked: filterStore.selectedCategory === cat.value,
                      class: 'sr-only',
                      onChange: () => filterStore.setCategory(cat.value),
                    }),
                    h('span', uiStore.lang === 'zh' ? cat.labelZh : cat.labelEn),
                  ])),
                  h('label', {
                    class: [
                      'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      filterStore.selectedCategory === null
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                    ],
                  }, [
                    h('input', {
                      type: 'radio',
                      checked: filterStore.selectedCategory === null,
                      class: 'sr-only',
                      onChange: () => filterStore.setCategory(null),
                    }),
                    h('span', uiStore.lang === 'zh' ? '全部' : 'All'),
                  ]),
                ]),
              ],
            }),
            // 标签云（热门地理 + 其他）- 始终显示，基于当前筛选（不包括标签筛选）
            h(Card, { padding: 'md' }, {
              default: () => {
                // 统计所有标签（基于 tagCloudData，不包括标签筛选）
                const allTags = computed(() => {
                  const tagMap = new Map<string, { en: string; zh: string; count: number }>();
                  const dataSource = tagCloudData.value || articlesData.value;
                  if (!dataSource || !Array.isArray(dataSource)) return [];
                  const articles = dataSource as any[];
                  articles.forEach((article: any) => {
                    if (article.tags && Array.isArray(article.tags)) {
                      article.tags.forEach((tag: any) => {
                        const key = `${tag.en}|${tag.zh}`;
                        const existing = tagMap.get(key);
                        if (existing) {
                          existing.count++;
                        } else {
                          tagMap.set(key, {
                            en: tag.en || '',
                            zh: tag.zh || '',
                            count: 1,
                          });
                        }
                      });
                    }
                  });
                  return Array.from(tagMap.values()).map(tag => ({
                    ...tag,
                    key: `${tag.en}|${tag.zh}`,
                  }));
                });
                
                // 地理标签：包含常见国家名或包含"国"字
                const commonCountries = ['USA', 'China', 'Palestine', 'Israel', 'Russia', 'Ukraine', 'France', 'Germany', 'UK', 'India', 'Iran', 'Iraq', 'Syria', 'Yemen', 'Lebanon', 'Jordan', 'Egypt', 'Turkey', 'Saudi', 'Korea', 'Japan', 'Taiwan', 'Hong Kong', 'Pakistan', 'Bangladesh', 'Afghanistan', 'Brazil', 'Mexico', 'Canada', 'Australia', 'Italy', 'Spain', 'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Greece', 'Portugal', 'Austria', 'Switzerland', 'Czech', 'Hungary', 'Romania', 'Bulgaria', 'Serbia', 'Croatia', 'Slovakia', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Belarus', 'Moldova', 'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan', 'Uzbekistan', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Myanmar', 'Cambodia', 'Laos', 'Mongolia', 'Nepal', 'Sri Lanka', 'Myanmar', 'Chile', 'Argentina', 'Colombia', 'Venezuela', 'Peru', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'South Africa', 'Nigeria', 'Kenya', 'Ethiopia', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Sudan', 'Somalia', 'Tanzania', 'Uganda', 'Ghana', 'Senegal', 'Ivory Coast', 'Cameroon', 'Angola', 'Mozambique', 'Madagascar', 'Zimbabwe', 'Zambia', 'Malawi', 'Mali', 'Burkina Faso', 'Niger', 'Chad', 'Mauritania', 'Guinea', 'Sierra Leone', 'Liberia', 'Togo', 'Benin', 'Gabon', 'Congo', 'DRC', 'Rwanda', 'Burundi', 'Eritrea', 'Djibouti', 'Comoros', 'Mauritius', 'Seychelles', 'Cape Verde', 'São Tomé', 'Equatorial Guinea', 'Guinea-Bissau', 'Gambia', 'Lesotho', 'Swaziland', 'Botswana', 'Namibia', 'Central African Republic'];
                const geoTags = computed(() =>
                  allTags.value
                    .filter(tag => {
                      const en = (tag.en || '').trim();
                      const zh = (tag.zh || '').trim();
                      // 检查是否包含常见国家名
                      const hasCountry = commonCountries.some((c) => 
                        en.includes(c) || zh.includes(c) || en === c || zh === c || 
                        en.toLowerCase().includes(c.toLowerCase()) || zh.includes(c)
                      );
                      // 检查中文是否包含"国"字
                      const hasGuo = zh.includes('国');
                      return hasCountry || hasGuo;
                    })
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                );
                
                // 非地理标签
                const otherTags = computed(() =>
                  allTags.value
                    .filter(tag => !geoTags.value.find((g) => g.key === tag.key))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 20)
                );
                
                const isSelected = (key: string) => filterStore.selectedTags.includes(key);
                const renderTagButton = (tag: any) =>
                  h('button', {
                    key: tag.key,
                    class: [
                      'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      isSelected(tag.key)
                        ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                        : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-zinc-500',
                    ],
                    onClick: () => { filterStore.toggleTag(tag.key); },
                  }, (uiStore.lang === 'zh' ? (tag.zh || tag.en) : (tag.en || tag.zh)) + ' (' + tag.count + ')');
                
                return [
                  h('div', { class: 'flex items-center justify-between mb-4' }, [
                    h('h2', { class: 'text-lg font-semibold text-zinc-100' },
                      uiStore.lang === 'zh' ? '标签云' : 'Tag Cloud'),
                    h(Button, {
                      variant: 'ghost',
                      size: 'sm',
                      onClick: () => { filterStore.clearTags(); },
                    }, () => uiStore.lang === 'zh' ? '清除' : 'Clear'),
                  ]),
                  h('div', { class: 'space-y-3' }, [
                    h('div', { class: 'text-sm text-zinc-400' },
                      uiStore.lang === 'zh' ? '热门地理标签（前10）' : 'Top Geo Tags (10)'),
                    h('div', { class: 'flex flex-wrap gap-2' },
                      geoTags.value.map(renderTagButton)
                    ),
                    h('div', { class: 'text-sm text-zinc-400 mt-4' },
                      uiStore.lang === 'zh' ? '热门其他标签（前20）' : 'Top Other Tags (20)'),
                    h('div', { class: 'flex flex-wrap gap-2' },
                      otherTags.value.map(renderTagButton)
                    ),
                  ]),
                ];
              },
            }),
          ]),
          h('div', { class: 'lg:col-span-3 space-y-4' }, [
            // Active Filters
            ...((filterStore.selectedPlatform !== null || filterStore.selectedCategory !== null || filterStore.selectedTags.length > 0) ? [h('div', {
              class: 'flex flex-wrap gap-2',
            }, [
              filterStore.selectedPlatform && h(Badge, { variant: 'default' }, () => {
                const p = platforms.find(pl => pl.value === filterStore.selectedPlatform);
                return p ? (uiStore.lang === 'zh' ? `平台: ${p.labelZh}` : `Platform: ${p.labelEn}`) : '';
              }),
              filterStore.selectedCategory && h(Badge, { variant: 'default' }, () => {
                const c = categories.find(cat => cat.value === filterStore.selectedCategory);
                return c ? (uiStore.lang === 'zh' ? `分类: ${c.labelZh}` : `Category: ${c.labelEn}`) : '';
              }),
              ...filterStore.selectedTags.map((tagKey: string) => {
                const [en, zh] = tagKey.split('|');
                const label = uiStore.lang === 'zh' ? (zh || en) : (en || zh);
                return h(Badge, { 
                  key: tagKey,
                  variant: 'default',
                  onClick: () => filterStore.toggleTag(tagKey),
                  class: 'cursor-pointer',
                }, () => uiStore.lang === 'zh' ? `标签: ${label || tagKey}` : `Tag: ${label || tagKey}`);
              }),
              h(Button, {
                variant: 'ghost',
                size: 'sm',
                onClick: () => filterStore.resetFilters(),
              }, () => uiStore.lang === 'zh' ? '清除全部' : 'Clear All'),
            ])] : []),
            isLoading.value ? h('div', { class: 'text-center py-12 text-zinc-400' },
              uiStore.lang === 'zh' ? '加载中...' : 'Loading...')
            : isError.value ? h('div', { class: 'text-center py-12' }, [
              h('div', { class: 'text-red-400 mb-2' },
                uiStore.lang === 'zh' ? '加载失败' : 'Failed to load'),
              h(Button, { onClick: refetch }, () => uiStore.lang === 'zh' ? '重试' : 'Retry'),
            ])
            : articlesData.value && Array.isArray(articlesData.value) && (articlesData.value as any[]).length > 0
              ? h('div', { class: 'space-y-4' }, (articlesData.value as any[]).map((article: any) => {
                const getBorderClass = (score: number | null) => {
                  if (score === null) return 'border-l-2 border-l-zinc-800';
                  if (score >= 90) return 'border-l-4 border-l-rose-600';
                  if (score >= 80) return 'border-l-4 border-l-amber-500';
                  if (score >= 60) return 'border-l-2 border-l-yellow-500';
                  return 'border-l-2 border-l-zinc-800';
                };
                const getScoreVariant = (score: number | null) => {
                  if (score === null) return 'default';
                  if (score >= 90) return 'danger';
                  if (score >= 80) return 'warning';
                  if (score >= 60) return 'success';
                  return 'default';
                };
                const getPlatformIcon = (platform: string) => {
                  const icons: Record<string, string> = { News: '📰', Twitter: '🐦', Telegram: '✈️' };
                  return icons[platform] || '📰';
                };
                const getCategoryLabel = (category: string) => {
                  const labels: Record<string, Record<string, string>> = {
                    zh: { Labor: '劳工', Politics: '政治', Conflict: '冲突', Theory: '理论' },
                    en: { Labor: 'Labor', Politics: 'Politics', Conflict: 'Conflict', Theory: 'Theory' },
                  };
                  return labels[uiStore.lang][category] || category;
                };
                const formatDate = (timestamp: number) => {
                  if (!timestamp) return '';
                  const date = new Date(timestamp * 1000);
                  return date.toLocaleDateString(uiStore.lang === 'zh' ? 'zh-CN' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                };
                const summary = uiStore.lang === 'zh' ? article.summary_zh : article.summary_en;
                
                return h('article', {
                  key: article.id,
                  class: [
                    'bg-zinc-800 rounded-lg border border-zinc-700 p-6 transition-all hover:border-zinc-600',
                    getBorderClass(article.score),
                  ],
                }, [
                  h('div', { class: 'flex items-start justify-between gap-4 mb-3' }, [
                    h('div', { class: 'flex-1' }, [
                      h('h3', { class: 'text-lg font-semibold text-zinc-100 mb-2' }, [
                        h('a', {
                          href: article.url,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          class: 'hover:text-zinc-300 transition-colors',
                        }, uiStore.lang === 'zh' ? article.title_zh : article.title_en),
                      ]),
                      h('div', { class: 'flex items-center gap-3 text-sm text-zinc-400' }, [
                        h('span', { class: 'flex items-center gap-1' }, [
                          getPlatformIcon(article.platform),
                          article.source_name,
                        ]),
                        ...(article.category ? [h('span', { class: 'capitalize' }, getCategoryLabel(article.category))] : []),
                        ...(article.published_at ? [h('span', { class: 'text-zinc-500' }, formatDate(article.published_at))] : []),
                      ]),
                    ]),
                    ...(article.score !== null ? [h('div', { class: 'flex-shrink-0' }, [
                      h(Badge, {
                        variant: getScoreVariant(article.score),
                      }, () => String(article.score)),
                    ])] : []),
                  ]),
                  ...(summary ? [h('p', {
                    class: 'text-zinc-400 text-sm mb-4 line-clamp-2',
                  }, String(summary))] : []),
                  ...(article.tags && article.tags.length > 0 ? [h('div', {
                    class: 'flex flex-wrap gap-2 mb-4',
                  }, article.tags.slice(0, 5).map((tag: any, idx: number) => {
                    return h(Badge, {
                      key: idx,
                      variant: 'default',
                    }, () => uiStore.lang === 'zh' ? tag.zh : tag.en);
                  }))] : []),
                  h('div', { class: 'flex items-center justify-between' }, [
                    h('a', {
                      href: article.url,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      class: 'text-sm text-zinc-400 hover:text-zinc-200 transition-colors',
                    }, uiStore.lang === 'zh' ? '阅读原文 →' : 'Read Original →'),
                  ]),
                ]);
              }))
              : h('div', { class: 'text-center py-12 text-zinc-400' },
                uiStore.lang === 'zh' ? '暂无文章' : 'No articles found'),
          ]),
        ]),
      ]),
    });
  },
};

