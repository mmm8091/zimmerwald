// 过滤器状态管理
import { reactive } from 'vue';

export const filterStore = reactive({
  scoreRange: [60, 100],
  selectedPlatform: null as string | null,
  selectedCategory: null as string | null,
  selectedTags: [] as string[], // 改为数组支持多选
  days: 30, // 1=24h, 7=7d, 30=30d, 90=90d, 0=All，默认 30
  searchKeyword: '', // 搜索关键词
  page: 1, // 当前页码，从 1 开始
  get queryParams() {
    const offset = (this.page - 1) * 10;
    console.log('[filterStore] queryParams getter 被调用:', { page: this.page, offset, stack: new Error().stack?.split('\n').slice(1, 4).join('\n') });
    const params = {
      min_score: this.scoreRange[0],
      max_score: this.scoreRange[1],
      platform: this.selectedPlatform || undefined,
      category: this.selectedCategory || undefined,
      tags: this.selectedTags.length > 0 ? this.selectedTags.join(',') : undefined, // 多个标签用逗号分隔
      days: this.days, // 始终传递 days，0 表示全部
      search: this.searchKeyword.trim() || undefined, // 搜索关键词
      limit: 10, // 每页 10 篇
      offset: offset, // 分页偏移量
    };
    console.log('[filterStore] queryParams 返回值:', JSON.stringify(params));
    return params;
  },
  setScoreRange(range: number[]) {
    this.scoreRange = range;
    this.resetPage();
  },
  setPlatform(platform: string | null) {
    this.selectedPlatform = platform;
    this.resetPage();
  },
  setCategory(category: string | null) {
    this.selectedCategory = category;
    this.resetPage();
  },
  toggleTag(tag: string) {
    const index = this.selectedTags.indexOf(tag);
    if (index > -1) {
      this.selectedTags.splice(index, 1);
      console.log('[filterStore] 移除标签:', tag, '当前标签:', this.selectedTags);
    } else {
      this.selectedTags.push(tag);
      console.log('[filterStore] 添加标签:', tag, '当前标签:', this.selectedTags);
    }
    this.resetPage();
    console.log('[filterStore] queryParams:', this.queryParams);
  },
  clearTags() {
    this.selectedTags = [];
    this.resetPage();
  },
  setSearchKeyword(keyword: string) {
    this.searchKeyword = keyword;
    this.resetPage();
  },
  setDays(days: number) {
    this.days = days;
    this.resetPage();
  },
  nextPage() {
    console.log('[filterStore] nextPage 调用前:', { page: this.page, offset: (this.page - 1) * 10 });
    this.page++;
    const newOffset = (this.page - 1) * 10;
    console.log('[filterStore] nextPage 调用后:', { page: this.page, offset: newOffset, queryParams: this.queryParams });
  },
  resetPage() {
    this.page = 1;
  },
  resetFilters() {
    this.scoreRange = [60, 100];
    this.selectedPlatform = null;
    this.selectedCategory = null;
    this.selectedTags = [];
    this.days = 30; // 默认 30 天
    this.searchKeyword = '';
    this.page = 1;
  },
});

