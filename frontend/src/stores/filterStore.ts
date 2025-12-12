// 过滤器状态管理
import { reactive } from 'vue';

export const filterStore = reactive({
  scoreRange: [60, 100],
  selectedPlatform: null as string | null,
  selectedCategory: null as string | null,
  selectedTags: [] as string[], // 改为数组支持多选
  days: 30,
  get queryParams() {
    return {
      min_score: this.scoreRange[0],
      max_score: this.scoreRange[1],
      platform: this.selectedPlatform || undefined,
      category: this.selectedCategory || undefined,
      tags: this.selectedTags.length > 0 ? this.selectedTags.join(',') : undefined, // 多个标签用逗号分隔
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
  toggleTag(tag: string) {
    const index = this.selectedTags.indexOf(tag);
    if (index > -1) {
      this.selectedTags.splice(index, 1);
    } else {
      this.selectedTags.push(tag);
    }
  },
  clearTags() {
    this.selectedTags = [];
  },
  resetFilters() {
    this.scoreRange = [60, 100];
    this.selectedPlatform = null;
    this.selectedCategory = null;
    this.selectedTags = [];
    this.days = 30;
  },
});

