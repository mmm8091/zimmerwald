// 路由配置
import { createRouter, createWebHashHistory } from 'vue-router';
import { Dashboard } from '../views/Dashboard';
import { Sources } from '../views/Sources';
import { Briefings } from '../views/Briefings';
import { About } from '../views/About';

const routes = [
  { path: '/', component: Dashboard },
  { path: '/sources', component: Sources },
  { path: '/briefings', component: Briefings },
  { path: '/about', component: About },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

