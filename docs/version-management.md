# 版本管理策略

## 分支策略

### 主要分支

- **`main`**: 稳定版本分支
  - 只包含已测试、稳定的代码
  - 每个稳定版本通过 Git tag 标记（如 `v1.4.0`, `v1.5.0`）
  - 用于生产环境部署

- **`dev`**: 开发分支
  - 用于日常开发和频繁部署
  - 可以包含未完成的特性
  - 用于测试和预览部署

### 工作流程

1. **开发阶段**
   ```bash
   # 在 dev 分支开发
   git checkout dev
   git add .
   git commit -m "feat: 迁移前端到 Cloudflare Pages"
   git push origin dev
   ```

2. **发布稳定版本**
   ```bash
   # 合并到 main
   git checkout main
   git merge dev
   
   # 更新版本号
   # 编辑 package.json: "version": "1.5.0"
   
   # 打 tag
   git tag -a v1.5.0 -m "Release v1.5.0: 前端迁移到 Cloudflare Pages"
   git push origin main --tags
   ```

3. **回退版本**

   **回退到稳定版本（通过 tag）**：
   ```bash
   # 查看所有 tag
   git tag -l
   
   # 回退到特定版本
   git checkout v1.4.0
   # 或创建新分支
   git checkout -b hotfix-v1.4.0 v1.4.0
   ```

   **回退开发版本（通过 commit）**：
   ```bash
   # 查看 commit 历史
   git log --oneline
   
   # 回退到特定 commit
   git revert <commit-hash>
   # 或重置（谨慎使用）
   git reset --hard <commit-hash>
   ```

## Cloudflare Pages 配置

### 开发环境（dev 分支）

- **项目名称**: `zimmerwald-frontend-dev`
- **生产分支**: `dev`
- **环境变量**: 
  - `VITE_API_BASE` = `https://zimmerwald.leelooloo8091.workers.dev`
  - 环境：Development, Preview

### 生产环境（main 分支）

- **项目名称**: `zimmerwald-frontend`
- **生产分支**: `main`
- **环境变量**: 
  - `VITE_API_BASE` = `https://zimmerwald.leelooloo8091.workers.dev`
  - 环境：Production

## 版本号管理

版本号遵循 [语义化版本](https://semver.org/)：

- **主版本号**（1.x.x）：不兼容的 API 修改
- **次版本号**（x.5.x）：向下兼容的功能性新增
- **修订号**（x.x.0）：向下兼容的问题修正

### 版本号更新位置

1. `package.json`: `"version": "1.5.0"`
2. `README.md`: 标题和描述
3. `docs/Zimmerwald v1.5 架构设计规范.md`: 文档标题
4. Git tag: `v1.5.0`

## 部署策略

### 开发部署（dev 分支）

- 自动部署：每次 push 到 `dev` 分支自动部署
- 预览 URL: `zimmerwald-frontend-dev.pages.dev`
- 用途：测试新功能、频繁迭代

### 生产部署（main 分支）

- 自动部署：每次 push 到 `main` 分支自动部署
- 生产 URL: `zimmerwald-frontend.pages.dev`（或自定义域名）
- 用途：稳定版本，用户访问

### 回退部署

1. **在 Cloudflare Dashboard 回退**
   - 进入项目 → Deployments
   - 找到要回退的部署
   - 点击 "Rollback to this deployment"

2. **通过 Git 回退**
   - 回退到稳定版本：`git checkout v1.4.0`
   - 回退开发版本：`git revert <commit-hash>`
   - Push 后自动重新部署

## 当前状态

- **当前版本**: v1.4.0（稳定版本，在 main 分支）
- **开发版本**: v1.5.0-dev（开发中，在 dev 分支）
- **下一步**: 完成前端迁移后，合并到 main 并发布 v1.5.0

