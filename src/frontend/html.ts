/**
 * 前端 HTML 页面生成
 * 生成 Intelligence Dashboard 的完整 HTML（包含内联 JavaScript）
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
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Zimmerwald</h1>
      <p class="text-gray-600">国际共运情报仪表盘（MVP 前端）</p>
      <div class="mt-4 flex items-center gap-4 text-sm">
        <div class="inline-flex items-center border border-gray-300 rounded-full overflow-hidden">
          <button id="btn-lang-cn" class="px-3 py-1 bg-gray-900 text-white text-xs">CN</button>
          <button id="btn-lang-en" class="px-3 py-1 bg-white text-gray-700 text-xs">EN</button>
        </div>
        <div class="text-gray-500 text-xs">
          语言切换仅在前端进行，不会重新加载页面。
        </div>
      </div>
    </header>

    <section class="mb-4 bg-white rounded-lg shadow-sm p-4 flex flex-col gap-4 text-sm">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-gray-600 text-xs">最低评分</span>
          <input id="score-slider" type="range" min="0" max="100" step="5" value="0" class="w-40">
          <span id="score-value" class="text-gray-800 text-xs font-mono">≥ 0</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-600 text-xs">分类</span>
          <select id="category-select" class="border border-gray-300 rounded px-2 py-1 text-xs">
            <option value="">全部</option>
            <option value="Labor">Labor</option>
            <option value="Politics">Politics</option>
            <option value="Conflict">Conflict</option>
            <option value="Theory">Theory</option>
          </select>
        </div>
        <div class="flex items-center gap-2 flex-1 min-w-[140px]">
          <span class="text-gray-600 text-xs">标签</span>
          <input id="tag-input" type="text" placeholder="输入英文或中文标签关键字" class="border border-gray-300 rounded px-2 py-1 text-xs flex-1">
          <button id="tag-search-btn" class="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 bg-gray-50 hover:bg-gray-100">筛选</button>
        </div>
      </div>
      <div class="flex flex-col md:flex-row gap-4">
        <div class="md:w-1/2">
          <h2 class="text-xs font-semibold text-gray-700 mb-1">评分分布</h2>
          <div id="histogram" class="h-24 flex items-end gap-1 text-[10px] text-gray-500"></div>
        </div>
        <div class="md:w-1/2">
          <h2 class="text-xs font-semibold text-gray-700 mb-1">热门标签</h2>
          <div id="tag-cloud" class="flex flex-wrap gap-1 text-[10px] text-gray-600"></div>
        </div>
      </div>
      <div id="active-filters" class="text-xs text-gray-500"></div>
    </section>
    
    <div id="news-container" class="bg-white rounded-lg shadow-sm p-6">
      <p class="text-gray-500 text-center py-8">加载中...</p>
    </div>
    
    <footer class="mt-8 text-center text-sm text-gray-500">
      <p>数据来源: WSWS, Peoples Dispatch, Red Herald</p>
    </footer>
  </div>

  <script>
    (function() {
      const state = {
        lang: 'zh',
        minScore: 0, // 默认显示所有文章，用户可以通过滑块调整
        category: '',
        tag: '',
        limit: ${APP_CONFIG.newsListLimit},
        articles: [],
      };

      // 语言切换：通过切换 .hidden class 控制显示
      const btnCn = document.getElementById('btn-lang-cn');
      const btnEn = document.getElementById('btn-lang-en');
      const scoreSlider = document.getElementById('score-slider');
      const scoreValue = document.getElementById('score-value');
      const categorySelect = document.getElementById('category-select');
      const tagInput = document.getElementById('tag-input');
      const tagSearchBtn = document.getElementById('tag-search-btn');
      const newsContainer = document.getElementById('news-container');
      const histogramEl = document.getElementById('histogram');
      const tagCloudEl = document.getElementById('tag-cloud');
      const activeFiltersEl = document.getElementById('active-filters');

      // 检查必要的 DOM 元素是否存在
      if (!newsContainer) {
        console.error('找不到 news-container 元素');
        return;
      }
      if (!histogramEl) console.warn('找不到 histogram 元素');
      if (!tagCloudEl) console.warn('找不到 tag-cloud 元素');
      if (!activeFiltersEl) console.warn('找不到 active-filters 元素');

      function setLanguage(lang) {
        const cnElems = document.querySelectorAll('.lang-cn');
        const enElems = document.querySelectorAll('.lang-en');

        if (lang === 'zh') {
          cnElems.forEach(el => el.classList.remove('hidden'));
          enElems.forEach(el => el.classList.add('hidden'));
          btnCn.classList.add('bg-gray-900', 'text-white');
          btnCn.classList.remove('bg-white', 'text-gray-700');
          btnEn.classList.remove('bg-gray-900', 'text-white');
          btnEn.classList.add('bg-white', 'text-gray-700');
        } else {
          cnElems.forEach(el => el.classList.add('hidden'));
          enElems.forEach(el => el.classList.remove('hidden'));
          btnEn.classList.add('bg-gray-900', 'text-white');
          btnEn.classList.remove('bg-white', 'text-gray-700');
          btnCn.classList.remove('bg-gray-900', 'text-white');
          btnCn.classList.add('bg-white', 'text-gray-700');
        }

        state.lang = lang;
        try {
          window.localStorage.setItem('zimmerwald_lang', lang);
        } catch (e) {}
      }

      btnCn && btnCn.addEventListener('click', () => setLanguage('zh'));
      btnEn && btnEn.addEventListener('click', () => setLanguage('en'));

      function renderActiveFilters() {
        const parts = [];
        parts.push('最低评分 ≥ ' + state.minScore);
        if (state.category) parts.push('分类 = ' + state.category);
        if (state.tag) parts.push('标签包含 "' + state.tag + '"');
        activeFiltersEl.textContent = '当前过滤：' + (parts.length ? parts.join('，') : '无');
      }

      function renderHistogram() {
        if (!histogramEl) {
          console.warn('renderHistogram: histogramEl 不存在');
          return;
        }
        const bins = new Array(11).fill(0);
        state.articles.forEach((a) => {
          if (typeof a.score !== 'number') return;
          let s = a.score;
          if (s < 0) s = 0;
          if (s > 100) s = 100;
          const idx = s === 100 ? 10 : Math.floor(s / 10);
          bins[idx]++;
        });
        const max = Math.max(...bins, 1);
        const labels = ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'];
        
        try {
          histogramEl.innerHTML = bins
            .map((count, i) => {
              // 确保最小高度为 2px，这样即使没有数据也能看到柱子
              const heightPercent = max > 0 ? Math.round((count / max) * 100) : 0;
              const heightPx = Math.max(heightPercent, 2);
              return '<div class="flex flex-col items-center flex-1 min-w-[10px]" style="height: 100%;">' +
                '<div class="w-full bg-red-500 rounded-t" style="height: ' + heightPx + '%; opacity: 0.6; min-height: 2px;"></div>' +
                '<span class="mt-1 text-[9px] text-gray-400 whitespace-nowrap">' + labels[i] + '</span>' +
                '</div>';
            })
            .join('');
          console.log('直方图渲染完成，数据:', bins);
        } catch (e) {
          console.error('渲染直方图时出错:', e);
        }
      }

      function renderTagCloud() {
        const freq = new Map();
        state.articles.forEach((a) => {
          if (!Array.isArray(a.tags)) return;
          a.tags.forEach((t) => {
            const key = (t.en || '') + '|' + (t.zh || '');
            if (!key.trim()) return;
            freq.set(key, (freq.get(key) || 0) + 1);
          });
        });
        const entries = Array.from(freq.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);
        if (entries.length === 0) {
          tagCloudEl.innerHTML = '<span class="text-gray-400 text-[10px]">暂无标签</span>';
          return;
        }
        const max = entries[0][1] || 1;
        tagCloudEl.innerHTML = entries
          .map(([key, count]) => {
            const parts = key.split('|');
            const en = parts[0] || '';
            const zh = parts[1] || '';
            const weight = 0.7 + (count / max) * 0.8;
            const fontSize = (10 * weight).toFixed(1);
            const label = zh || en || '';
            const title = (zh && en ? zh + ' / ' + en : label) + '（' + count + '）';
            const keyword = zh || en;
            return '<button class="tag-cloud-item px-1 py-0.5 rounded text-gray-700 hover:bg-gray-100"' +
              ' style="font-size: ' + fontSize + 'px"' +
              ' data-tag="' + keyword + '"' +
              ' title="' + title.replace(/"/g, '&quot;') + '"' +
              '>' + label.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</button>';
          })
          .join('');
      }

      function renderArticles() {
        if (!newsContainer) {
          console.error('renderArticles: newsContainer 不存在');
          return;
        }
        if (!Array.isArray(state.articles) || state.articles.length === 0) {
          newsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">暂无新闻</p>';
          if (histogramEl) histogramEl.innerHTML = '';
          if (tagCloudEl) tagCloudEl.innerHTML = '';
          if (activeFiltersEl) activeFiltersEl.textContent = '当前过滤：无（显示全部已加载文章）';
          return;
        }
        console.log('开始渲染文章，共', state.articles.length, '篇');
        const cards = state.articles.map((article) => {
          const titleZh = article.title_zh || article.title || '(无标题)';
          const titleEn = article.title_en || article.title || '(No title)';
          const summaryZh = article.summary_zh || article.summary || '';
          const summaryEn = article.summary_en || article.summary || '';
          const scoreClass = (function(score) {
            if (!score) return 'text-gray-500';
            if (score >= 80) return 'text-red-600 font-bold';
            if (score >= 60) return 'text-orange-500';
            if (score >= 40) return 'text-yellow-500';
            return 'text-gray-400';
          })(article.score);
          const badgeClass = (function(category) {
            const badges = {
              Labor: 'bg-blue-100 text-blue-800',
              Politics: 'bg-purple-100 text-purple-800',
              Conflict: 'bg-red-100 text-red-800',
              Theory: 'bg-green-100 text-green-800',
            };
            return badges[category] || 'bg-gray-100 text-gray-800';
          })(article.category);
          const dateText = article.published_at
            ? new Date(article.published_at).toLocaleDateString('zh-CN')
            : '';
          return (
            '<article class="border-b border-gray-200 py-4">' +
            '<div class="flex items-start justify-between mb-2">' +
            '<div class="flex-1">' +
            '<h2 class="text-lg font-semibold text-gray-900">' +
            '<a href="' + article.url + '" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors">' +
            '<span class="lang-cn">' + titleZh.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
            '<span class="lang-en hidden">' + titleEn.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
            '</a>' +
            '</h2>' +
            '</div>' +
            '<div class="ml-4 flex items-center gap-2 text-sm">' +
            (article.category
              ? '<span class="px-2 py-1 text-xs rounded ' + badgeClass + '">' + article.category + '</span>'
              : '') +
            (typeof article.score === 'number'
              ? '<div class="flex items-center gap-1" data-article-id="' + (article.id || '') + '">' +
                '<span class="' + scoreClass + ' score-value">' + article.score + '</span>' +
                '<div class="flex flex-col text-xs text-gray-400 crowd-audit-buttons">' +
                '<button class="vote-btn" data-vote="too_low" title="分数偏低">▲</button>' +
                '<button class="vote-btn" data-vote="accurate" title="分数合理">OK</button>' +
                '<button class="vote-btn" data-vote="too_high" title="分数偏高">▼</button>' +
                '</div>' +
                '</div>'
              : '') +
            '</div>' +
            '</div>' +
            '<div class="text-sm text-gray-600 mb-2">' +
            '<span class="font-medium">' + (article.source_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
            (dateText ? '<span class="mx-2">•</span><span>' + dateText + '</span>' : '') +
            '</div>' +
            (summaryZh || summaryEn
              ? '<p class="text-gray-700 mt-2">' +
                '<span class="lang-cn">' + summaryZh.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
                '<span class="lang-en hidden">' + summaryEn.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
                '</p>'
              : '') +
            '</article>'
          );
        });
        try {
          newsContainer.innerHTML = cards.join('');
          setLanguage(state.lang);
          renderHistogram();
          renderTagCloud();
          renderActiveFilters();
          console.log('文章渲染完成');
        } catch (e) {
          console.error('渲染文章时出错:', e);
          newsContainer.innerHTML = '<p class="text-red-500 text-center py-8">渲染出错: ' + (e instanceof Error ? e.message : '未知错误') + '</p>';
        }
      }

      let fetchTimer = null;
      function scheduleFetchArticles() {
        if (fetchTimer) clearTimeout(fetchTimer);
        fetchTimer = setTimeout(fetchArticles, 200);
      }

      async function fetchArticles() {
        const params = new URLSearchParams();
        params.set('limit', String(state.limit));
        // 只有当 minScore > 0 时才添加过滤条件，0 表示显示所有文章
        if (typeof state.minScore === 'number' && state.minScore > 0) {
          params.set('min_score', String(state.minScore));
        }
        if (state.category) params.set('category', state.category);
        if (state.tag) params.set('tag', state.tag);
        newsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">加载中...</p>';
        try {
          const apiUrl = '/api/news?' + params.toString();
          console.log('正在请求:', apiUrl);
          const resp = await fetch(apiUrl);
          console.log('API 响应状态:', resp.status, resp.statusText);
          
          if (!resp.ok) {
            throw new Error('HTTP ' + resp.status + ': ' + resp.statusText);
          }
          
          const data = await resp.json();
          const dataCount = Array.isArray(data) ? data.length : 0;
          console.log('API 返回数据:', dataCount + ' 篇文章', data);
          
          if (Array.isArray(data)) {
            state.articles = data;
            if (data.length === 0) {
              newsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">暂无符合条件的文章</p>';
            } else {
              renderArticles();
            }
          } else {
            console.error('API 返回非数组格式:', data);
            newsContainer.innerHTML = '<p class="text-red-500 text-center py-8">数据格式错误</p>';
          }
        } catch (e) {
          console.error('加载新闻失败', e);
          const errorMsg = e instanceof Error ? e.message : '未知错误';
          newsContainer.innerHTML = '<p class="text-red-500 text-center py-8">加载失败: ' + errorMsg + '</p>';
        }
      }

      if (scoreSlider && scoreValue) {
        scoreSlider.addEventListener('input', () => {
          const v = Number(scoreSlider.value || '0');
          state.minScore = v;
          scoreValue.textContent = '≥ ' + v;
        });
        scoreSlider.addEventListener('change', () => {
          scheduleFetchArticles();
        });
      }

      if (categorySelect) {
        categorySelect.addEventListener('change', () => {
          state.category = categorySelect.value || '';
          scheduleFetchArticles();
        });
      }

      function applyTagFilterFromInput() {
        const value = (tagInput && tagInput.value) || '';
        state.tag = value.trim();
        scheduleFetchArticles();
      }

      if (tagSearchBtn) {
        tagSearchBtn.addEventListener('click', applyTagFilterFromInput);
      }
      if (tagInput) {
        tagInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyTagFilterFromInput();
          }
        });
      }

      // 初始化语言（默认中文）
      let initialLang = 'zh';
      try {
        const saved = window.localStorage.getItem('zimmerwald_lang');
        if (saved === 'en' || saved === 'zh') initialLang = saved;
      } catch (e) {}
      setLanguage(initialLang);

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || !(target instanceof HTMLElement)) return;
        if (target.classList.contains('tag-cloud-item')) {
          const t = target.getAttribute('data-tag') || '';
          if (tagInput) tagInput.value = t;
          state.tag = t;
          scheduleFetchArticles();
        }
      });

      // 群众审计按钮事件代理
      document.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains('vote-btn')) return;

        const voteType = target.getAttribute('data-vote');
        const wrapper = target.closest('[data-article-id]');
        if (!wrapper) return;
        const articleId = wrapper.getAttribute('data-article-id');
        if (!articleId) return;

        try {
          const resp = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              article_id: Number(articleId),
              vote_type: voteType,
            }),
          });
          const data = await resp.json();
          if (data && data.success) {
            target.classList.add('text-green-600');
            setTimeout(() => {
              target.classList.remove('text-green-600');
            }, 1000);
          } else {
            console.warn('反馈失败', data);
          }
        } catch (e) {
          console.error('提交反馈出错', e);
        }
      });

      // 初次加载
      scheduleFetchArticles();
    })();
  </script>
</body>
</html>`;
}

