#!/bin/bash

# Node.js 安装脚本 for macOS

echo "🚀 开始安装 Node.js..."

# 检查系统架构
ARCH=$(uname -m)
echo "系统架构: $ARCH"

# 设置 Node.js 版本和下载URL
NODE_VERSION="18.19.0"
if [ "$ARCH" = "arm64" ]; then
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz"
    echo "检测到 Apple Silicon (M1/M2)"
else
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz"
    echo "检测到 Intel Mac"
fi

# 下载 Node.js
echo "📥 下载 Node.js v${NODE_VERSION}..."
curl -L $NODE_URL -o node.tar.gz

# 检查下载是否成功
if [ $? -ne 0 ]; then
    echo "❌ 下载失败，请检查网络连接"
    exit 1
fi

# 创建安装目录
echo "📁 创建安装目录..."
sudo mkdir -p /usr/local

# 解压并安装
echo "📦 解压并安装 Node.js..."
sudo tar -xzf node.tar.gz -C /usr/local --strip-components=1

# 清理下载文件
rm node.tar.gz

# 创建符号链接（如果需要）
echo "🔗 创建符号链接..."
sudo ln -sf /usr/local/bin/node /usr/bin/node
sudo ln -sf /usr/local/bin/npm /usr/bin/npm
sudo ln -sf /usr/local/bin/npx /usr/bin/npx

# 验证安装
echo "✅ 验证安装..."
if command -v node &> /dev/null; then
    NODE_VERSION_INSTALLED=$(node --version)
    echo "Node.js 版本: $NODE_VERSION_INSTALLED"
else
    echo "❌ Node.js 安装失败"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "npm 版本: $NPM_VERSION"
else
    echo "❌ npm 安装失败"
    exit 1
fi

# 设置 npm 镜像（可选，提高下载速度）
echo "🔄 设置 npm 镜像..."
npm config set registry https://registry.npmmirror.com

# 更新 PATH
echo "🛣️  更新 PATH..."
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bash_profile

# 重新加载 shell 配置
source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null

echo ""
echo "🎉 Node.js 安装完成！"
echo ""
echo "📋 安装信息:"
echo "   - Node.js: $NODE_VERSION_INSTALLED"
echo "   - npm: $NPM_VERSION"
echo "   - 安装路径: /usr/local/bin"
echo ""
echo "🔄 请重新启动终端或运行以下命令："
echo "   source ~/.zshrc"
echo ""
echo "🚀 然后可以运行："
echo "   npm --version"
echo "   node --version"
echo ""
