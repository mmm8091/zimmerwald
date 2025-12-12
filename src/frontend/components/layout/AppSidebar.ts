// AppSidebar 组件
import { h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { uiStore } from '../../stores/uiStore';

export const AppSidebar = {
  props: ['isOpen'],
  emits: ['close'],
  setup(props: any, { emit }: any) {
    let router: any = null;
    let route: any = { path: '/' };
    try {
      router = useRouter();
      route = useRoute();
    } catch (e) {
      console.warn('Router not available:', e);
    }

    const navItems = [
      { path: '/', labelZh: '情报中心', labelEn: 'Dashboard', icon: '📊' },
      { path: '/sources', labelZh: '信源健康', labelEn: 'Sources', icon: '📰' },
      { path: '/briefings', labelZh: '每日简报', labelEn: 'Briefings', icon: '📄' },
      { path: '/about', labelZh: '关于', labelEn: 'About', icon: 'ℹ️' },
    ];

    return () => h('aside', {
      class: [
        'fixed left-0 top-0 h-full bg-zinc-900 border-r border-zinc-800 transition-transform duration-300 z-40 w-64',
        props.isOpen ? 'translate-x-0' : '-translate-x-full',
      ],
    }, [
      h('div', { class: 'flex flex-col h-full' }, [
        h('div', { class: 'p-6 border-b border-zinc-800' }, [
          h('h1', { class: 'text-xl font-bold text-zinc-100' }, 'Zimmerwald'),
          h('p', { class: 'text-xs text-zinc-500 mt-1' }, 'Intelligence Platform'),
        ]),
        h('nav', { class: 'flex-1 p-4 space-y-1' }, navItems.map((item: any) => 
          h('a', {
            href: '#' + item.path,
            onClick: (e) => {
              e.preventDefault();
              if (router) {
                router.push(item.path);
              } else {
                window.location.hash = item.path;
              }
            },
            class: [
              'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
              (route.path || window.location.hash.slice(1) || '/') === item.path
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
            ],
          }, [
            h('span', item.icon),
            h('span', uiStore.lang === 'zh' ? item.labelZh : item.labelEn),
          ])
        )),
        h('div', { class: 'p-4 border-t border-zinc-800' }, [
          h('button', {
            onClick: () => uiStore.setLang(uiStore.lang === 'zh' ? 'en' : 'zh'),
            class: 'px-3 py-1.5 text-sm rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors',
          }, uiStore.lang === 'zh' ? 'EN' : '中文'),
        ]),
      ]),
      props.isOpen && h('div', {
        class: 'fixed inset-0 bg-black/50 z-30 lg:hidden',
        onClick: () => emit('close'),
      }),
    ]);
  },
};

