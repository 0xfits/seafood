#!/bin/bash

# Jinli Club 测试脚本

echo "🧪 开始运行测试套件..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数定义
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. 单元测试
echo "\n🔬 运行单元测试..."
if npm run test:unit; then
    print_success "单元测试通过"
else
    print_error "单元测试失败"
    exit 1
fi

# 2. 组件测试
echo "\n🧩 运行组件测试..."
if npm run test:components; then
    print_success "组件测试通过"
else
    print_error "组件测试失败"
    exit 1
fi

# 3. 性能测试
echo "\n⚡ 运行性能测试..."
if npm run test:performance; then
    print_success "性能测试通过"
else
    print_error "性能测试失败"
    exit 1
fi

# 4. 可访问性测试
echo "\n♿ 运行可访问性测试..."
if npm run test:accessibility; then
    print_success "可访问性测试通过"
else
    print_error "可访问性测试失败"
    exit 1
fi

# 5. E2E 测试
echo "\n🌐 运行 E2E 测试..."
if npm run test:e2e; then
    print_success "E2E 测试通过"
else
    print_error "E2E 测试失败"
    exit 1
fi

# 6. 代码覆盖率
echo "\n📊 生成代码覆盖率..."
if npm run test:coverage; then
    print_success "代码覆盖率报告已生成"
else
    print_warning "代码覆盖率生成失败"
fi

# 7. 类型检查
echo "\n📝 运行类型检查..."
if npx tsc --noEmit; then
    print_success "类型检查通过"
else
    print_error "类型检查失败"
    exit 1
fi

# 8. 代码检查
echo "\n🔍 运行代码检查..."
if npm run lint; then
    print_success "代码检查通过"
else
    print_error "代码检查失败"
    exit 1
fi

echo "\n🎉 所有测试通过！"
echo "\n📋 测试报告位置:"
echo "   - 单元测试: coverage/unit/index.html"
echo "   - 组件测试: coverage/components/index.html"
echo "   - E2E 测试: playwright-report/index.html"
echo "   - 性能报告: performance-report.json"

echo "\n🚀 可以安全部署了！"
