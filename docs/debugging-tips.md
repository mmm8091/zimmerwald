# 调试技巧：如何查看所有 JavaScript 错误

## 问题

浏览器通常只显示第一个语法错误，因为后续代码可能无法解析。这导致需要多次修复才能发现所有错误。

## 解决方案

### 1. 使用语法检查脚本（推荐）

我们已经添加了 `npm run check:syntax` 命令，可以在部署前检查语法错误：

```bash
npm run check:syntax
```

这个脚本会：
- 提取生成的 JavaScript 代码
- 使用 Node.js 的 `vm` 模块检查语法
- 显示所有发现的语法错误

### 2. 浏览器开发者工具技巧

#### 方法 A：使用 Source Maps（如果可用）
1. 打开浏览器开发者工具（F12）
2. 转到 Sources 标签
3. 查看原始源文件（而不是生成的代码）

#### 方法 B：逐段注释代码
1. 打开浏览器开发者工具
2. 在 Console 中，找到第一个错误
3. 修复后，刷新页面
4. 重复直到没有错误

#### 方法 C：使用 ESLint 或 TypeScript 编译器
在构建脚本中添加语法检查：

```bash
# 使用 ESLint
npx eslint src/frontend/**/*.ts

# 使用 TypeScript 编译器（只检查语法）
npx tsc --noEmit --skipLibCheck
```

### 3. 构建时自动检查

`package.json` 中的 `deploy` 命令已经包含了语法检查：

```json
{
  "scripts": {
    "deploy": "npm run build:frontend && npm run check:syntax && wrangler deploy"
  }
}
```

这样在部署前会自动检查语法错误。

### 4. 使用在线工具

- **ESLint Playground**: https://eslint.org/play/
- **TypeScript Playground**: https://www.typescriptlang.org/play
- **Babel REPL**: https://babeljs.io/repl

### 5. 浏览器扩展

- **Error Lens** (VS Code 扩展): 在编辑器中高亮显示所有错误
- **ESLint** (VS Code 扩展): 实时检查代码错误

## 为什么浏览器只显示第一个错误？

JavaScript 引擎在遇到语法错误时会停止解析，因为：
1. 后续代码可能依赖于前面的代码
2. 无法确定后续代码的上下文
3. 继续解析可能会产生误导性的错误信息

## 最佳实践

1. **开发时**：使用 TypeScript 或 ESLint 在编辑器中实时检查
2. **构建时**：运行 `npm run check:syntax` 检查语法
3. **部署前**：确保所有检查都通过

## 当前项目的检查流程

```bash
# 1. 构建前端代码
npm run build:frontend

# 2. 检查语法
npm run check:syntax

# 3. 部署（会自动运行前两步）
npm run deploy
```

