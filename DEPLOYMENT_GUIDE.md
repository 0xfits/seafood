# Vercel 部署指南

## 1. 准备 Supabase 数据库

### 1.1 创建 Supabase 项目
1. 访问 https://supabase.com
2. 点击 "New Project"
3. 选择组织，输入项目名称（如：jinli-club）
4. 设置数据库密码（记住这个密码！）
5. 等待项目创建完成（约 1-2 分钟）

### 1.2 获取数据库连接信息
1. 进入项目 Dashboard
2. 点击左侧菜单 "Settings" → "Database"
3. 找到 "Connection string" 部分
4. 选择 "URI" 标签
5. 复制连接字符串，格式如下：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
   ```

## 2. 部署后端到 Vercel

### 2.1 安装 Vercel CLI（如果还没有）
```bash
npm i -g vercel
```

### 2.2 登录 Vercel
```bash
vercel login
```

### 2.3 部署后端
```bash
cd backend
vercel --prod
```

按照提示操作：
- Set up and deploy ".../jinli/backend"? [Y/n] → 输入 Y
- Which scope do you want to deploy to? → 选择你的账户
- Link to existing project? [y/N] → 输入 N（首次部署）
- What's your project name? → 输入 jinli-api

### 2.4 配置环境变量
部署完成后，配置环境变量：

**方式一：通过 Vercel Dashboard（推荐）**
1. 访问 https://vercel.com/dashboard
2. 找到你的项目 `jinli-api`
3. 点击 "Settings" → "Environment Variables"
4. 添加以下变量：

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
SECRET_KEY=your-strong-secret-key-at-least-32-characters-long
```

**方式二：通过 CLI**
```bash
vercel env add DATABASE_URL
# 粘贴你的 Supabase 连接字符串

vercel env add SECRET_KEY
# 输入一个强密钥（至少 32 个字符）

vercel --prod
```

## 3. 数据库迁移

### 3.1 安装依赖
```bash
cd backend
pip install -r requirements.txt
```

### 3.2 设置本地环境变量
创建 `.env` 文件：
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
SECRET_KEY=your-strong-secret-key
```

### 3.3 创建数据库表
```bash
cd backend
python -c "
from app.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
print('✅ 数据库表创建成功')
"
```

### 3.4 迁移数据（可选）
如果你需要迁移旧数据：
```bash
# 从 SQLite 导出数据
sqlite3 jinli.db ".dump" > backup.sql

# 使用 psql 导入到 PostgreSQL
# 注意：需要修改 backup.sql 中的语法以兼容 PostgreSQL
```

**更简单的方法**：使用 Supabase Dashboard 的 SQL Editor
1. 进入 Supabase Dashboard
2. 点击 "SQL Editor"
3. 新建查询
4. 粘贴 `backup.sql` 中的 INSERT 语句
5. 执行

## 4. 配置域名

### 4.1 添加自定义域名
1. 在 Vercel Dashboard 中打开项目
2. 点击 "Settings" → "Domains"
3. 输入 `api.jinlibenli.com`
4. 按照提示配置 DNS

### 4.2 DNS 配置
在你的域名服务商（如 Cloudflare/GoDaddy）添加记录：

```
Type: CNAME
Name: api
Value: cname.vercel-dns.com
TTL: Auto
```

## 5. 验证部署

### 5.1 测试健康检查
```bash
curl https://api.jinlibenli.com/health
```

应该返回：
```json
{"status": "healthy", "version": "1.0.0"}
```

### 5.2 查看 API 文档
访问：https://api.jinlibenli.com/docs

### 5.3 测试登录
```bash
curl -X POST "https://api.jinlibenli.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "evm_address": "0x59f9f640d15ebb053c94a816232cf8ce91b209b0",
    "signature": "test-signature"
  }'
```

## 6. 前端配置更新

### 6.1 更新 API 地址
在前端项目中，更新 `.env.production`：
```
REACT_APP_API_URL=https://api.jinlibenli.com
```

### 6.2 重新部署前端
```bash
cd frontend
vercel --prod
```

## 7. 故障排除

### 问题 1：数据库连接失败
**检查**：
- DATABASE_URL 是否正确
- Supabase 项目是否处于活动状态
- 是否允许所有 IP 访问（Supabase Settings → Database → Network Restrictions）

### 问题 2：CORS 错误
**解决**：检查 `app/main.py` 中的 CORS 配置是否包含你的前端域名

### 问题 3：JWT 认证失败
**检查**：
- SECRET_KEY 是否设置
- 前后端 SECRET_KEY 是否一致

## 8. 重要提醒

⚠️ **生产环境 checklist**:
- [ ] 使用强 SECRET_KEY（至少 32 位随机字符串）
- [ ] 启用 Supabase 的 Row Level Security (RLS)
- [ ] 配置 Vercel 的 Analytics
- [ ] 设置 Supabase 的备份策略
- [ ] 配置域名 SSL（Vercel 自动处理）

## 9. 后续维护

### 更新部署
```bash
cd backend
git pull origin main  # 获取最新代码
vercel --prod         # 重新部署
```

### 数据库迁移
当修改模型后：
```bash
cd backend
alembic revision --autogenerate -m "描述"
alembic upgrade head
```

---

**需要帮助？**
- Vercel 文档: https://vercel.com/docs
- Supabase 文档: https://supabase.com/docs
- FastAPI 文档: https://fastapi.tiangolo.com
