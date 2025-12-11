/**
 * Zimmerwald v1.3 前端 HTML 页面
 * 使用 Vue 3 (CDN) Options API
 * 支持平台筛选（News/Twitter/Telegram），已移除群众审计投票
 */

import { APP_CONFIG } from '../config/app';

/**
 * 生成前端 HTML 页面
 */
export function generateHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zimmerwald - 国际共运新闻聚合平台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="module">
    import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

    createApp({
      // Options API
      data() {
        return {
          lang: 'zh',
          filter: {
            minScore: 0, // 默认显示所有文章
            category: '',
            tag: '',
            platform: 'All', // 平台筛选 (All/News/Twitter/Telegram)
            limit: ${APP_CONFIG.newsListLimit},
          },
          articles: [],
          loading: false,
        };
      },
      computed: {
        // 计算直方图数据 (0-100 分分布)
        histogram() {
          const bins = new Array(11).fill(0);
          this.articles.forEach((article) => {
            if (typeof article.score !== 'number') return;
            let score = article.score;
            if (score < 0) score = 0;
            if (score > 100) score = 100;
            const idx = score === 100 ? 10 : Math.floor(score / 10);
            bins[idx]++;
          });
          const max = Math.max(...bins, 1);
          return bins.map((count, i) => ({
            count,
            height: max > 0 ? Math.round((count / max) * 100) : 0,
            label: String(i * 10),
          }));
        },
        // 计算热门标签 (Top 20)
        trendingTags() {
          const freq = new Map();
          this.articles.forEach((article) => {
            if (!Array.isArray(article.tags)) return;
            article.tags.forEach((tag) => {
              const key = (tag.en || '') + '|' + (tag.zh || '');
              if (!key.trim()) return;
              freq.set(key, {
                en: tag.en || '',
                zh: tag.zh || '',
                count: (freq.get(key)?.count || 0) + 1,
              });
            });
          });
          return Array.from(freq.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        },
        // 计算当前激活的过滤器
        activeFilters() {
          const parts = [];
          parts.push('最低评分 ≥ ' + this.filter.minScore);
          if (this.filter.platform && this.filter.platform !== 'All') {
            parts.push('平台 = ' + this.filter.platform);
          }
          if (this.filter.category) parts.push('分类 = ' + this.filter.category);
          if (this.filter.tag) parts.push('标签包含 "' + this.filter.tag + '"');
          return parts.length ? parts.join('，') : '无';
        },
      },
      methods: {
        // 平台显示名称
        getPlatformLabel(platform) {
          const labels = {
            News: this.lang === 'zh' ? '新闻' : 'News',
            Twitter: 'Twitter',
            Telegram: 'Telegram',
            All: this.lang === 'zh' ? '全部' : 'All',
          };
          return labels[platform] || platform;
        },
        // 平台样式类
        getPlatformClass(platform) {
          const classes = {
            News: 'bg-blue-100 text-blue-700 border-blue-300',
            Twitter: 'bg-sky-100 text-sky-700 border-sky-300',
            Telegram: 'bg-indigo-100 text-indigo-700 border-indigo-300',
          };
          return classes[platform] || 'bg-gray-100 text-gray-700 border-gray-300';
        },
        // 语言切换
        toggleLang() {
          this.lang = this.lang === 'zh' ? 'en' : 'zh';
          try {
            localStorage.setItem('zimmerwald_lang', this.lang);
          } catch (e) {
            // 忽略 localStorage 错误
          }
        },
        // 选择标签
        selectTag(tag) {
          this.filter.tag = tag;
          this.fetchNews();
        },
        // 清除标签筛选
        clearTagFilter() {
          this.filter.tag = '';
          this.fetchNews();
        },
        // 拉取新闻
        async fetchNews() {
          this.loading = true;
          try {
            const params = new URLSearchParams();
            params.set('limit', String(this.filter.limit));
            if (this.filter.minScore > 0) {
              params.set('min_score', String(this.filter.minScore));
            }
            if (this.filter.category) {
              params.set('category', this.filter.category);
            }
            if (this.filter.tag) {
              params.set('tag', this.filter.tag);
            }
            if (this.filter.platform && this.filter.platform !== 'All') {
              params.set('platform', this.filter.platform);
            }

            const resp = await fetch('/api/news?' + params.toString());
            if (!resp.ok) {
              throw new Error('HTTP ' + resp.status);
            }

            const data = await resp.json();
            this.articles = Array.isArray(data) ? data : [];
          } catch (error) {
            console.error('加载新闻失败:', error);
            this.articles = [];
          } finally {
            this.loading = false;
          }
        },
        // 格式化日期
        formatDate(timestamp) {
          if (!timestamp) return '';
          return new Date(timestamp).toLocaleDateString('zh-CN');
        },
        // 相对时间（Twitter/Telegram）
        formatRelativeTime(timestamp) {
          if (!timestamp) return '';
          const now = Date.now();
          const diff = now - timestamp;
          const minutes = Math.floor(diff / 60000);
          const hours = Math.floor(diff / 3600000);
          const days = Math.floor(diff / 86400000);

          if (minutes < 1) return this.lang === 'zh' ? '刚刚' : 'Just now';
          if (minutes < 60) return minutes + (this.lang === 'zh' ? '分钟前' : 'm ago');
          if (hours < 24) return hours + (this.lang === 'zh' ? '小时前' : 'h ago');
          if (days < 7) return days + (this.lang === 'zh' ? '天前' : 'd ago');
          return this.formatDate(timestamp);
        },
        // 评分样式
        getScoreClass(score) {
          if (!score && score !== 0) return 'text-gray-500';
          if (score >= 80) return 'text-red-600 font-bold';
          if (score >= 60) return 'text-orange-500';
          if (score >= 40) return 'text-yellow-500';
          return 'text-gray-400';
        },
        // 分类样式
        getCategoryClass(category) {
          const classes = {
            Labor: 'bg-blue-100 text-blue-800',
            Politics: 'bg-purple-100 text-purple-800',
            Conflict: 'bg-red-100 text-red-800',
            Theory: 'bg-green-100 text-green-800',
          };
          return classes[category] || 'bg-gray-100 text-gray-800';
        },
      },
      mounted() {
        // 恢复语言设置
        try {
          const saved = localStorage.getItem('zimmerwald_lang');
          if (saved === 'en' || saved === 'zh') {
            this.lang = saved;
          }
        } catch (e) {
          // 忽略 localStorage 错误
        }

        // 初始加载
        this.fetchNews();
      },
      watch: {
        'filter.minScore'() {
          this.fetchNews();
        },
        'filter.category'() {
          this.fetchNews();
        },
        'filter.platform'() {
          this.fetchNews();
        },
      },
    }).mount('#app');
  </script>
</head>
<body class="bg-gray-50">
  <div id="app" class="container mx-auto px-4 py-8 max-w-4xl">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Zimmerwald</h1>
      <p class="text-gray-600">
        <span v-if="lang === 'zh'">国际共运情报仪表盘</span>
        <span v-else>International Communist News Dashboard</span>
      </p>
      <div class="mt-4 flex items-center gap-4 text-sm">
        <div class="inline-flex items-center border border-gray-300 rounded-full overflow-hidden">
          <button
            @click="lang = 'zh'"
            :class="[
              'px-3 py-1 text-xs transition-colors',
              lang === 'zh' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            ]"
          >
            CN
          </button>
          <button
            @click="lang = 'en'"
            :class="[
              'px-3 py-1 text-xs transition-colors',
              lang === 'en' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            ]"
          >
            EN
          </button>
        </div>
      </div>
    </header>

    <!-- 筛选器 -->
    <section class="mb-4 bg-white rounded-lg shadow-sm p-4 flex flex-col gap-4 text-sm">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-gray-600 text-xs">
            <span v-if="lang === 'zh'">最低评分</span>
            <span v-else>Min Score</span>
          </span>
          <input
            v-model.number="filter.minScore"
            type="range"
            min="0"
            max="100"
            step="5"
            class="w-40"
          />
          <span class="text-gray-800 text-xs font-mono">≥ {{ filter.minScore }}</span>
        </div>
        <!-- 平台筛选 -->
        <div class="flex items-center gap-2">
          <span class="text-gray-600 text-xs">
            <span v-if="lang === 'zh'">平台</span>
            <span v-else>Platform</span>
          </span>
          <select
            v-model="filter.platform"
            class="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="All">{{ lang === 'zh' ? '全部' : 'All' }}</option>
            <option value="News">News</option>
            <option value="Twitter">Twitter</option>
            <option value="Telegram">Telegram</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-600 text-xs">
            <span v-if="lang === 'zh'">分类</span>
            <span v-else>Category</span>
          </span>
          <select
            v-model="filter.category"
            class="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="">{{ lang === 'zh' ? '全部' : 'All' }}</option>
            <option value="Labor">Labor</option>
            <option value="Politics">Politics</option>
            <option value="Conflict">Conflict</option>
            <option value="Theory">Theory</option>
          </select>
        </div>
        <div class="flex items-center gap-2 flex-1 min-w-[140px]">
          <span class="text-gray-600 text-xs">
            <span v-if="lang === 'zh'">标签</span>
            <span v-else>Tag</span>
          </span>
          <input
            v-model="filter.tag"
            @keyup.enter="fetchNews()"
            type="text"
            :placeholder="lang === 'zh' ? '输入英文或中文标签关键字' : 'Enter tag keyword'"
            class="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
          />
          <button
            @click="fetchNews()"
            class="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 bg-gray-50 hover:bg-gray-100"
          >
            <span v-if="lang === 'zh'">筛选</span>
            <span v-else>Filter</span>
          </button>
          <button
            v-if="filter.tag"
            @click="clearTagFilter()"
            class="px-2 py-1 text-xs border border-gray-300 rounded text-red-600 hover:bg-red-50"
          >
            ×
          </button>
        </div>
      </div>

      <!-- 直方图和标签云 -->
      <div class="flex flex-col md:flex-row gap-4">
        <!-- 直方图 -->
        <div class="md:w-1/2">
          <h2 class="text-xs font-semibold text-gray-700 mb-1">
            <span v-if="lang === 'zh'">评分分布</span>
            <span v-else>Score Distribution</span>
          </h2>
          <div class="h-24 flex items-end gap-1 text-[10px] text-gray-500">
            <div
              v-for="(bin, i) in histogram"
              :key="i"
              class="flex flex-col items-center flex-1 min-w-[10px]"
              style="height: 100%;"
            >
              <div
                class="w-full bg-red-500 rounded-t"
                :style="{ height: Math.max(bin.height, 2) + '%', opacity: 0.6, minHeight: '2px' }"
              ></div>
              <span class="mt-1 text-[9px] text-gray-400 whitespace-nowrap">{{ bin.label }}</span>
            </div>
          </div>
        </div>

        <!-- 热门标签云 -->
        <div class="md:w-1/2">
          <h2 class="text-xs font-semibold text-gray-700 mb-1">
            <span v-if="lang === 'zh'">热门标签</span>
            <span v-else>Trending Tags</span>
          </h2>
          <div class="flex flex-wrap gap-1 text-[10px] text-gray-600">
            <button
              v-for="(tagItem, i) in trendingTags"
              :key="i"
              @click="selectTag(lang === 'zh' ? tagItem.zh : tagItem.en)"
              class="px-1 py-0.5 rounded text-gray-700 hover:bg-gray-100"
              :style="{ fontSize: (10 * (0.7 + (tagItem.count / (trendingTags[0]?.count || 1)) * 0.8)).toFixed(1) + 'px' }"
              :title="(tagItem.zh || '') + (tagItem.en ? ' / ' + tagItem.en : '') + '（' + tagItem.count + '）'"
            >
              {{ lang === 'zh' ? (tagItem.zh || tagItem.en) : (tagItem.en || tagItem.zh) }}
            </button>
            <span v-if="trendingTags.length === 0" class="text-gray-400 text-[10px]">
              <span v-if="lang === 'zh'">暂无标签</span>
              <span v-else>No tags</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 当前过滤条件 -->
      <div class="text-xs text-gray-500">
        <span v-if="lang === 'zh'">当前过滤：</span>
        <span v-else>Active filters: </span>
        {{ activeFilters }}
      </div>
    </section>
    
    <!-- 新闻列表 -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <div v-if="loading" class="text-gray-500 text-center py-8">
        <span v-if="lang === 'zh'">加载中...</span>
        <span v-else>Loading...</span>
      </div>
      <div v-else-if="articles.length === 0" class="text-gray-500 text-center py-8">
        <span v-if="lang === 'zh'">暂无新闻</span>
        <span v-else>No articles</span>
      </div>
      <div v-else>
        <article
          v-for="article in articles"
          :key="article.id"
          :class="[
            'border-b border-gray-200 last:border-b-0',
            article.platform === 'Twitter' || article.platform === 'Telegram'
              ? 'py-3'
              : 'py-4'
          ]"
        >
          <!-- News 样式 -->
          <template v-if="article.platform === 'News' || !article.platform">
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1">
                <h2 class="text-lg font-semibold text-gray-900">
                  <a
                    :href="article.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-blue-600 transition-colors"
                  >
                    <span v-if="lang === 'zh'">
                      {{ article.title_zh || article.title || '(无标题)' }}
                    </span>
                    <span v-else>
                      {{ article.title_en || article.title || '(No title)' }}
                    </span>
                  </a>
                </h2>
              </div>
              <div class="ml-4 flex items-center gap-2 text-sm">
                <span
                  v-if="article.category"
                  :class="['px-2 py-1 text-xs rounded', getCategoryClass(article.category)]"
                >
                  {{ article.category }}
                </span>
                <div v-if="typeof article.score === 'number'" class="flex items-center gap-1">
                  <span :class="['score-value', getScoreClass(article.score)]">
                    {{ article.score }}
                  </span>
                </div>
              </div>
    </div>
    
            <div class="text-sm text-gray-600 mb-2">
              <span class="font-medium">{{ article.source_name || '' }}</span>
              <span v-if="formatDate(article.published_at)" class="mx-2">•</span>
              <span v-if="formatDate(article.published_at)">{{ formatDate(article.published_at) }}</span>
  </div>

            <p v-if="(lang === 'zh' ? article.summary_zh : article.summary_en)" class="text-gray-700 mt-2">
              <span v-if="lang === 'zh'">{{ article.summary_zh || article.summary || '' }}</span>
              <span v-else>{{ article.summary_en || article.summary || '' }}</span>
            </p>
          </template>

          <!-- Twitter/Telegram 样式 -->
          <template v-else>
            <div class="flex items-start gap-3">
              <div
                :class="[
                  'px-2 py-0.5 text-xs font-medium rounded border flex-shrink-0',
                  getPlatformClass(article.platform)
                ]"
              >
                {{ getPlatformLabel(article.platform) }}
              </div>

              <div class="flex-1 min-w-0">
                <p
                  v-if="(lang === 'zh' ? (article.summary_zh || article.summary) : (article.summary_en || article.summary))"
                  class="text-gray-800 text-sm leading-relaxed mb-2"
                >
                  <a
                    :href="article.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-blue-600 transition-colors"
                  >
                    <span v-if="lang === 'zh'">{{ article.summary_zh || article.summary || article.title_zh || article.title || '' }}</span>
                    <span v-else>{{ article.summary_en || article.summary || article.title_en || article.title || '' }}</span>
                  </a>
                </p>
                <p
                  v-else-if="(lang === 'zh' ? (article.title_zh || article.title) : (article.title_en || article.title))"
                  class="text-gray-800 text-sm leading-relaxed mb-2"
                >
                  <a
                    :href="article.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-blue-600 transition-colors"
                  >
                    <span v-if="lang === 'zh'">{{ article.title_zh || article.title || '' }}</span>
                    <span v-else>{{ article.title_en || article.title || '' }}</span>
                  </a>
                </p>

                <div class="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span class="font-medium">{{ article.source_name || '' }}</span>
                  <span v-if="article.published_at">•</span>
                  <span v-if="article.published_at" :title="formatDate(article.published_at)">
                    {{ formatRelativeTime(article.published_at) }}
                  </span>
                  <span v-if="article.category" class="mx-1">•</span>
                  <span
                    v-if="article.category"
                    :class="['px-1.5 py-0.5 text-xs rounded', getCategoryClass(article.category)]"
                  >
                    {{ article.category }}
                  </span>
                  <span v-if="typeof article.score === 'number'" class="mx-1">•</span>
                  <span
                    v-if="typeof article.score === 'number'"
                    :class="['font-medium', getScoreClass(article.score)]"
                  >
                    {{ article.score }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </article>
      </div>
    </div>

    <footer class="mt-8 text-center text-sm text-gray-500">
      <p>Zimmerwald v1.3</p>
    </footer>
  </div>
</body>
</html>`;
}
