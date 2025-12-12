# 前端部署说明

## 当前状态

Worker 已部署并返回新的 Vite 前端 HTML，但静态资源（JS/CSS）需要单独部署。

## 部署选项

### 方案 A：Cloudflare Pages（推荐）

1. **在 Cloudflare Dashboard 创建 Pages 项目**
   - 项目名称：`zimmerwald-frontend`
   - 构建命令：`cd frontend && npm install && npm run build`
   - 输出目录：`frontend/dist`
   - 根目录：`frontend`

2. **配置环境变量**
   - `VITE_API_BASE`: 设置为你的 Worker URL（例如：`https://zimmerwald.leelooloo8091.workers.dev`）

3. **部署**
   - 连接 GitHub 仓库，自动部署
   - 或使用 `wrangler pages deploy frontend/dist`

### 方案 B：手动部署到 Cloudflare Pages

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=zimmerwald-frontend
```

### 方案 C：使用其他 CDN/静态托管

将 `frontend/dist` 目录部署到任何静态托管服务（Vercel、Netlify 等），并设置 `VITE_API_BASE` 环境变量指向 Worker URL。

## 当前 Worker URL

- Worker: https://zimmerwald.leelooloo8091.workers.dev
- API 端点: https://zimmerwald.leelooloo8091.workers.dev/api/*

## 注意事项

- `VITE_API_BASE` 环境变量：如果前端和 Worker 在同一域名下，可以留空（使用相对路径）
- 如果前端部署在 Pages，Worker 在 Workers，需要设置 `VITE_API_BASE` 为 Worker 的完整 URL

