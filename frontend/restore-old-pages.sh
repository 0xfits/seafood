#!/bin/bash

# Jinli Club 页面恢复脚本
# 用于恢复到原始页面

echo "🔄 恢复到原始页面..."

cd src/pages

# 恢复原始页面
if [ -f "HomePage-Old.jsx" ]; then
    cp HomePage-Old.jsx HomePage.jsx
    echo "✅ HomePage 已恢复"
else
    echo "❌ HomePage-Old.jsx 不存在"
fi

if [ -f "TaskPage-Old.jsx" ]; then
    cp TaskPage-Old.jsx TaskPage.jsx
    echo "✅ TaskPage 已恢复"
else
    echo "❌ TaskPage-Old.jsx 不存在"
fi

if [ -f "RewardPage-Old.jsx" ]; then
    cp RewardPage-Old.jsx RewardPage.jsx
    echo "✅ RewardPage 已恢复"
else
    echo "❌ RewardPage-Old.jsx 不存在"
fi

if [ -f "ProfilePage-Old.jsx" ]; then
    cp ProfilePage-Old.jsx ProfilePage.jsx
    echo "✅ ProfilePage 已恢复"
else
    echo "❌ ProfilePage-Old.jsx 不存在"
fi

if [ -f "DashboardPage-Old.jsx" ]; then
    cp DashboardPage-Old.jsx DashboardPage.jsx
    echo "✅ DashboardPage 已恢复"
else
    echo "❌ DashboardPage-Old.jsx 不存在"
fi

echo ""
echo "🎉 页面恢复完成！"
echo ""
echo "📋 已恢复到原始页面版本"
echo "🚀 重启开发服务器查看效果："
echo "   npm run dev"
echo ""
