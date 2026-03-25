# Jinli Club 部署指南

## 🚨 Vercel 部署权限问题

当前遇到的问题：`Deployment Blocked - The Deployment was blocked because the commit author does not have contributing access to the project on Vercel.`

这是因为 Vercel 的 Hobby 计划不支持团队协作。

## 🔧 解决方案

### 方案一：升级 Vercel 计划（推荐）

1. **升级到 Pro 计划**:
   - 登录 [Vercel 控制台](https://vercel.com/dashboard)
   - 进入 Jinli Club 项目
   - 点击 Settings → Billing
   - 升级到 Pro 计划 ($20/月)

2. **添加团队成员**:
   - 在项目设置中点击 "Members"
   - 添加团队成员的邮箱
   - 设置权限为 "Contributor" 或更高

3. **重新部署**:
   - 团队成员推送代码后会自动触发部署
   - 或手动点击 "Redeploy"

### 方案二：转移项目所有权

1. **项目转移**:
   - 当前项目所有者在 Vercel 中
   - 进入项目设置 → "Transfer Project"
   - 转移到有部署权限的账户

2. **更新 Git 配置**:
   ```bash
   # 确保提交者信息正确
   git config user.name "Your Name"
   git config user.email "your-email@example.com"
   
   # 重新提交（如果需要）
   git commit --amend --reset-author
   git push --force-with-lease
   ```

### 方案三：使用其他部署平台

如果 Vercel 升级不可行，可以考虑：

1. **Netlify**:
   - 免费计划支持团队协作
   - 类似的功能和性能

2. **Railway**:
   - 支持全栈部署
   - 更好的后端集成

3. **自建服务器**:
   - 使用提供的 `deploy.sh` 脚本
   - 完全控制部署环境

## 🛠️ 临时解决方案

### 手动部署

如果需要立即部署，可以：

1. **项目所有者手动部署**:
   - 有权限的成员在 Vercel 点击 "Redeploy"
   - 或推送新的 commit

2. **本地构建测试**:
   ```bash
   # 在本地测试构建
   cd frontend
   npm install
   npm run build
   
   # 预览构建结果
   npm run preview
   ```

## 📋 部署检查清单

在解决权限问题后，确保：

- [ ] Vercel 项目设置正确
- [ ] 团队成员有部署权限
- [ ] 环境变量配置完整
- [ ] 域名设置正确
- [ ] 构建配置无误

## 🔄 CI/CD 配置

### GitHub Actions（可选）

如果需要更复杂的 CI/CD，可以添加 GitHub Actions：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd frontend
          npm install
          
      - name: Build
        run: |
          cd frontend
          npm run build
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./frontend
```

## 📞 联系支持

如果问题持续存在：

1. **Vercel 支持**: support@vercel.com
2. **文档**: https://vercel.com/docs/concepts/projects/teams
3. **社区**: https://vercel.com/discord

---

**注意**: 长期来看，建议升级到 Vercel Pro 计划以获得更好的团队协作功能和更高的资源限制。
