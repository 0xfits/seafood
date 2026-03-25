#!/bin/bash

# Jinli Club 页面切换脚本
# 用于切换到新的优化页面

echo "🔄 切换到新的优化页面..."

# 备份原始页面
echo "📦 备份原始页面..."
cd src/pages

# 备份原始文件
if [ -f "HomePage.jsx" ]; then
    cp HomePage.jsx HomePage-Old.jsx
    echo "✅ HomePage.jsx 已备份"
fi

if [ -f "TaskPage.jsx" ]; then
    cp TaskPage.jsx TaskPage-Old.jsx
    echo "✅ TaskPage.jsx 已备份"
fi

if [ -f "RewardPage.jsx" ]; then
    cp RewardPage.jsx RewardPage-Old.jsx
    echo "✅ RewardPage.jsx 已备份"
fi

if [ -f "ProfilePage.jsx" ]; then
    cp ProfilePage.jsx ProfilePage-Old.jsx
    echo "✅ ProfilePage.jsx 已备份"
fi

if [ -f "DashboardPage.jsx" ]; then
    cp DashboardPage.jsx DashboardPage-Old.jsx
    echo "✅ DashboardPage.jsx 已备份"
fi

# 切换到新页面
echo "🎨 切换到新页面..."

if [ -f "HomePage-New.jsx" ]; then
    cp HomePage-New.jsx HomePage.jsx
    echo "✅ HomePage 已切换到新版本"
fi

if [ -f "TaskPage-New.jsx" ]; then
    cp TaskPage-New.jsx TaskPage.jsx
    echo "✅ TaskPage 已切换到新版本"
fi

if [ -f "RewardPage-New.jsx" ]; then
    cp RewardPage-New.jsx RewardPage.jsx
    echo "✅ RewardPage 已切换到新版本"
fi

if [ -f "ProfilePage-New.jsx" ]; then
    cp ProfilePage-New.jsx ProfilePage.jsx
    echo "✅ ProfilePage 已切换到新版本"
fi

if [ -f "DashboardPage-New.jsx" ]; then
    cp DashboardPage-New.jsx DashboardPage.jsx
    echo "✅ DashboardPage 已切换到新版本"
fi

echo ""
echo "🎉 页面切换完成！"
echo ""
echo "📋 操作说明："
echo "   - 新页面已启用，包含优化的 UI 组件和交互"
echo "   - 原始页面已备份为 *-Old.jsx"
echo "   - 如需回退，运行: ./restore-old-pages.sh"
echo ""
echo "🚀 启动开发服务器查看效果："
echo "   npm run dev"
echo ""
