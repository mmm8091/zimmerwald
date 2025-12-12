// About 视图组件
import { h } from 'vue';
import { MainLayout } from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import { uiStore } from '../stores/uiStore';

export const About = {
  setup() {
    return () => h(MainLayout, {}, {
      default: () => h('div', { class: 'max-w-4xl mx-auto space-y-6' }, [
        h('div', {}, [
          h('h1', { class: 'text-3xl font-bold text-zinc-100 mb-2' },
            uiStore.lang === 'zh' ? '关于' : 'About'),
        ]),
        h(Card, { padding: 'lg' }, {
          default: () => h('div', { class: 'prose prose-invert prose-zinc max-w-none' }, [
            h('h2', { class: 'text-2xl font-bold text-zinc-100 mb-4' },
              'Zimmerwald Intelligence'),
            h('p', { class: 'text-zinc-400 mb-4' },
              uiStore.lang === 'zh'
                ? 'Zimmerwald 是一个国际共运新闻聚合与分析平台，使用 AI 技术对全球范围内的劳工运动、政治冲突、理论发展等关键信息进行实时监控和分析。'
                : 'Zimmerwald is an international movement news aggregation and analysis platform that uses AI technology to monitor and analyze key information about labor movements, political conflicts, and theoretical developments worldwide in real-time.'),
            h('h3', { class: 'text-xl font-semibold text-zinc-200 mt-6 mb-3' },
              uiStore.lang === 'zh' ? '核心功能' : 'Core Features'),
            h('ul', { class: 'list-disc list-inside text-zinc-400 space-y-2 mb-4' }, [
              h('li', uiStore.lang === 'zh' ? '实时 RSS 源监控与抓取' : 'Real-time RSS source monitoring and fetching'),
              h('li', uiStore.lang === 'zh' ? 'AI 驱动的五因子唯物主义评分系统' : 'AI-powered five-factor materialist scoring system'),
              h('li', uiStore.lang === 'zh' ? '每日战略简报生成' : 'Daily strategic briefing generation'),
              h('li', uiStore.lang === 'zh' ? '信源健康度监控' : 'Source health monitoring'),
              h('li', uiStore.lang === 'zh' ? '多平台支持（新闻、Twitter、Telegram）' : 'Multi-platform support (News, Twitter, Telegram)'),
            ]),
            h('h3', { class: 'text-xl font-semibold text-zinc-200 mt-6 mb-3' },
              uiStore.lang === 'zh' ? '技术栈' : 'Technology Stack'),
            h('ul', { class: 'list-disc list-inside text-zinc-400 space-y-2 mb-4' }, [
              h('li', uiStore.lang === 'zh' ? '前端：Vue 3 + Composition API + Vite' : 'Frontend: Vue 3 + Composition API + Vite'),
              h('li', uiStore.lang === 'zh' ? '后端：Cloudflare Workers + Hono' : 'Backend: Cloudflare Workers + Hono'),
              h('li', uiStore.lang === 'zh' ? '数据库：Cloudflare D1 (SQLite)' : 'Database: Cloudflare D1 (SQLite)'),
              h('li', uiStore.lang === 'zh' ? 'AI：DeepSeek / Claude (OpenRouter)' : 'AI: DeepSeek / Claude (OpenRouter)'),
            ]),
            h('h3', { class: 'text-xl font-semibold text-zinc-200 mt-6 mb-3' },
              uiStore.lang === 'zh' ? '版本信息' : 'Version'),
            h('p', { class: 'text-zinc-400' },
              uiStore.lang === 'zh' ? '当前版本：v1.5' : 'Current Version: v1.5'),
            h('div', { class: 'mt-8 pt-6 border-t border-zinc-700' }, [
              h('p', { class: 'text-sm text-zinc-500' },
                uiStore.lang === 'zh'
                  ? 'Zimmerwald 以 1915 年齐美尔瓦尔德会议命名，该会议标志着国际社会主义运动在第一次世界大战期间的重要转折点。'
                  : 'Zimmerwald is named after the 1915 Zimmerwald Conference, which marked an important turning point for the international socialist movement during World War I.'),
            ]),
          ]),
        }),
      ]),
    });
  },
};

