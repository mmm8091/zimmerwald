// 主应用入口
import { createApp, provide } from 'vue';
import { router } from './router';
import App from './App.vue';
import { filterStore } from './stores/filterStore';
import { uiStore } from './stores/uiStore';
import './style.css';

// 初始化 UI Store
uiStore.init();

const app = createApp(App);

// 提供全局状态
provide('filterStore', filterStore);
provide('uiStore', uiStore);

app.use(router);
app.mount('#app');
