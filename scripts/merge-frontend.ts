/**
 * 合并前端文件脚本
 * 将所有拆分的前端文件合并成一个 hybrid-html.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function readAndClean(filePath: string): string {
  const content = readFileSync(join(rootDir, filePath), 'utf-8');
  // 移除 TypeScript 导入和导出语句
  return content
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
}

// 读取所有文件
const files = {
  apiClient: readAndClean('src/frontend/api/client.ts'),
  useQuery: readAndClean('src/frontend/utils/useQuery.ts'),
  filterStore: readAndClean('src/frontend/stores/filterStore.ts'),
  uiStore: readAndClean('src/frontend/stores/uiStore.ts'),
  Button: readAndClean('src/frontend/components/ui/Button.ts'),
  Badge: readAndClean('src/frontend/components/ui/Badge.ts'),
  Card: readAndClean('src/frontend/components/ui/Card.ts'),
  AppSidebar: readAndClean('src/frontend/components/layout/AppSidebar.ts'),
  TopBriefing: readAndClean('src/frontend/components/layout/TopBriefing.ts'),
  MainLayout: readAndClean('src/frontend/components/layout/MainLayout.ts'),
  ScoreHistogram: readAndClean('src/frontend/components/layout/ScoreHistogram.ts'),
};

// 生成合并后的代码
const mergedCode = `/**
 * Zimmerwald v1.5 混合方案前端 HTML（自动生成）
 * 此文件由 scripts/merge-frontend.ts 自动生成，请勿手动编辑
 * 编辑源文件后运行: npm run build:frontend
 */

export function generateHybridHTML(): string {
  return \`<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zimmerwald Intelligence</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
    .dark { color-scheme: dark; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js",
        "vue-router": "https://unpkg.com/vue-router@4/dist/vue-router.esm-browser.js"
      }
    }
  </script>
  <script type="module">
    // CDN 引入依赖
    import { createApp, ref, computed, onMounted, watch, h, reactive, provide, inject } from 'vue';
    import { createRouter, createWebHashHistory, useRouter, useRoute, RouterView } from 'vue-router';

    // ==================== API 客户端 ====================
    ${files.apiClient}

    // ==================== 工具函数 ====================
    ${files.useQuery}

    // ==================== 状态管理 ====================
    ${files.filterStore}
    ${files.uiStore}

    // ==================== UI 组件 ====================
    ${files.Button}
    ${files.Badge}
    ${files.Card}

    // ==================== 布局组件 ====================
    ${files.AppSidebar}
    ${files.TopBriefing}
    ${files.MainLayout}
    ${files.ScoreHistogram}

    // TODO: 页面组件需要从原 hybrid-html.ts 提取
    // 暂时保留原文件中的页面组件代码

    // ==================== 应用初始化 ====================
    // 路由和应用初始化代码需要从原文件提取
  </script>
</head>
<body class="bg-zinc-900 text-zinc-100">
  <div id="app"></div>
</body>
</html>\`;
}
`;

writeFileSync(join(rootDir, 'src/frontend/hybrid-html.ts'), mergedCode);
console.log('✅ Frontend files merged successfully!');

