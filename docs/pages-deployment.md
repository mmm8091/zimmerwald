# Cloudflare Pages 部署配置指南

## 版本管理策略

项目使用分支策略管理版本：
- **`main` 分支**: 稳定版本，用于生产环境
- **`dev` 分支**: 开发版本，用于频繁部署和测试

建议配置两个 Pages 项目：
1. **生产环境**：部署 `main` 分支
2. **开发环境**：部署 `dev` 分支

## GitHub 集成配置步骤

### 1. 配置开发环境（dev 分支）

1. 访问 Cloudflare Dashboard → Workers & Pages
2. 点击 "Create Application" → "Pages" → "Connect to Git"
3. 选择 "Continue with GitHub"
4. 授权 Cloudflare 访问你的 GitHub 仓库
5. 选择仓库：`Zimmerwald`（或你的仓库名）
6. 选择分支：`dev`
7. 项目名称：`zimmerwald-frontend-dev`

### 2. 配置生产环境（main 分支，可选）

当代码稳定后，可以创建生产环境：
1. 重复上述步骤
2. 选择分支：`main`
3. 项目名称：`zimmerwald-frontend`

### 2. 构建设置

在 Cloudflare Pages 项目设置中配置：

- **项目名称**：`zimmerwald-frontend`
- **生产分支**：`main`
- **构建设置**：
  - **框架预设**：`Vite`
  - **构建命令**：`cd frontend && npm install && npm run build`
  - **构建输出目录**：`frontend/dist`
  - **根目录**：留空（或填写项目根目录）

### 3. 环境变量配置

在 Pages 项目设置 → Environment variables 中添加：

- **变量名**：`VITE_API_BASE`
- **值**：`https://zimmerwald.leelooloo8091.workers.dev`
- **环境**：Production, Preview, Development（全部勾选）

### 4. 自定义域名（可选）

如果需要自定义域名：
1. 在 Pages 项目设置 → Custom domains 中添加域名
2. 按照提示配置 DNS 记录

## 部署流程

配置完成后，每次 push 代码到 `main` 分支：
1. Cloudflare Pages 自动检测到新的 commit
2. 自动运行构建命令
3. 自动部署到生产环境
4. 可以在 Dashboard 查看部署状态和日志

## 回退版本

### 方法 1：在 Cloudflare Dashboard 回退

1. 进入 Pages 项目 → Deployments
2. 找到要回退的部署版本
3. 点击 "..." → "Retry deployment" 或 "Rollback to this deployment"

### 方法 2：通过 Git 回退

1. 在 GitHub 上找到要回退的 commit
2. 创建 revert commit 或直接 reset 到之前的 commit
3. Push 到 GitHub
4. Cloudflare Pages 会自动部署回退后的版本

## 预览部署

- 每个 Pull Request 会自动创建预览部署
- 预览部署的 URL 会在 PR 中显示
- 可以用于测试和代码审查

## 注意事项

1. **构建时间**：首次构建可能需要 2-3 分钟，后续构建通常更快
2. **构建日志**：可以在 Dashboard 查看详细的构建日志
3. **构建失败**：如果构建失败，不会部署新版本，旧版本继续运行
4. **环境变量**：确保所有必要的环境变量都已配置

