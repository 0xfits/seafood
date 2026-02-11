#!/bin/bash
# Vercel 快速部署脚本

echo "🚀 Jinli Club API 部署脚本"
echo "=========================="

# 检查 vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 未安装 Vercel CLI，正在安装..."
    npm install -g vercel
fi

# 检查是否在 backend 目录
if [ ! -f "app/main.py" ]; then
    echo "❌ 请在 backend 目录下运行此脚本"
    exit 1
fi

echo ""
echo "📋 部署前检查清单："
echo "1. 已在 Supabase 创建项目"
echo "2. 已获取 DATABASE_URL"
echo "3. 已准备好 SECRET_KEY"
echo ""

read -p "是否继续部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消部署"
    exit 1
fi

echo ""
echo "🔧 步骤 1/3: 配置环境变量"
echo "------------------------"

# 检查是否已有 .env 文件
if [ -f ".env" ]; then
    echo "✅ 发现 .env 文件"
    read -p "是否使用现有配置? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm .env
    fi
fi

# 如果没有 .env，提示输入
if [ ! -f ".env" ]; then
    echo "请输入 Supabase 数据库连接字符串:"
    echo "格式: postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres"
    read -p "DATABASE_URL: " db_url
    
    echo ""
    echo "请输入 JWT Secret Key (至少 32 个字符):"
    read -p "SECRET_KEY: " secret_key
    
    # 写入 .env
    echo "DATABASE_URL=$db_url" > .env
    echo "SECRET_KEY=$secret_key" >> .env
    echo "✅ 环境变量已保存到 .env"
fi

echo ""
echo "🚀 步骤 2/3: 部署到 Vercel"
echo "------------------------"

# 登录检查
vercel whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "请先登录 Vercel:"
    vercel login
fi

# 部署
echo "正在部署..."
vercel --prod

echo ""
echo "⚙️ 步骤 3/3: 配置环境变量到 Vercel"
echo "--------------------------------"

# 读取 .env 并设置到 Vercel
export $(grep -v '^#' .env | xargs)

# 设置 DATABASE_URL
vercel env add DATABASE_URL <<< "$DATABASE_URL"

# 设置 SECRET_KEY
vercel env add SECRET_KEY <<< "$SECRET_KEY"

echo ""
echo "🎉 部署完成！"
echo "============="
echo ""
echo "下一步："
echo "1. 访问 Vercel Dashboard 添加自定义域名"
echo "2. 测试 API: https://your-domain.vercel.app/health"
echo "3. 查看文档: https://your-domain.vercel.app/docs"
echo ""
echo "数据库迁移（如果需要）："
echo "  python -c \"from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)\""
echo ""
