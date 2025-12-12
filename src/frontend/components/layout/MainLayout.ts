// MainLayout 组件
import { h, onMounted } from 'vue';
import { AppSidebar } from './AppSidebar';
import { TopBriefing } from './TopBriefing';
import { uiStore } from '../../stores/uiStore';

export const MainLayout = {
  setup(_: any, { slots }: any) {
    onMounted(() => {
      uiStore.init();
    });

    return () => h('div', { class: 'min-h-screen bg-zinc-900 flex' }, [
      h(AppSidebar, {
        isOpen: uiStore.sidebarOpen,
        onClose: () => { uiStore.sidebarOpen = false; },
      }),
      h('div', {
        class: [
          'flex-1 transition-all duration-300',
          uiStore.sidebarOpen ? 'lg:ml-64' : 'ml-0',
        ],
      }, [
        h(TopBriefing),
        !uiStore.sidebarOpen && h('button', {
          onClick: () => { uiStore.sidebarOpen = true; },
          class: 'fixed top-4 left-4 z-50 p-2 bg-zinc-800 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors lg:hidden',
        }, '☰'),
        h('main', { class: 'p-6' }, slots.default()),
      ]),
    ]);
  },
};

