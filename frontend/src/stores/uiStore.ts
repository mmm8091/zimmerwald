// UI 状态管理
import { reactive } from 'vue';

export const uiStore = reactive({
  sidebarOpen: true,
  lang: 'zh' as 'zh' | 'en',
  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  },
  setLang(l: 'zh' | 'en') {
    this.lang = l;
    try {
      localStorage.setItem('zimmerwald_lang', l);
    } catch {}
  },
  init() {
    try {
      const saved = localStorage.getItem('zimmerwald_lang');
      if (saved === 'zh' || saved === 'en') {
        this.lang = saved;
      }
    } catch {}
  },
});

