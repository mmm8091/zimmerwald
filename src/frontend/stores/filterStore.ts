// 过滤器状态管理
import { reactive } from 'vue';

export const filterStore = reactive({
  scoreRange: [60, 100],
  selectedPlatform: null as string | null,
  selectedCategory: null as string | null,
  selectedTag: '',
  days: 30,
  get queryParams() {
    return {
      min_score: this.scoreRange[0],
      max_score: this.scoreRange[1],
      platform: this.selectedPlatform || undefined,
      category: this.selectedCategory || undefined,
      tag: this.selectedTag || undefined,
      days: this.days,
      limit: 200,
    };
  },
  setScoreRange(range: number[]) {
    this.scoreRange = range;
  },
  setPlatform(platform: string | null) {
    this.selectedPlatform = platform;
  },
  setCategory(category: string | null) {
    this.selectedCategory = category;
  },
  setTag(tag: string) {
    this.selectedTag = tag;
  },
  resetFilters() {
    this.scoreRange = [60, 100];
    this.selectedPlatform = null;
    this.selectedCategory = null;
    this.selectedTag = '';
    this.days = 30;
  },
});

