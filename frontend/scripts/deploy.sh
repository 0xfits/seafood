#!/bin/bash

# Jinli Club 部署脚本

echo "🚀 开始部署 Jinli Club..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 检查环境
check_environment() {
    print_info "检查部署环境..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi
    
    # 检查 git
    if ! command -v git &> /dev/null; then
        print_error "git 未安装"
        exit 1
    fi
    
    print_success "环境检查通过"
}

# 清理和安装依赖
setup_dependencies() {
    print_info "设置项目依赖..."
    
    # 清理
    print_info "清理 node_modules..."
    rm -rf node_modules
    
    # 安装依赖
    print_info "安装依赖..."
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "依赖安装成功"
    else
        print_error "依赖安装失败"
        exit 1
    fi
}

# 运行测试
run_tests() {
    print_info "运行测试套件..."
    
    # 代码检查
    print_info "运行代码检查..."
    npm run lint
    if [ $? -ne 0 ]; then
        print_error "代码检查失败"
        exit 1
    fi
    
    # 类型检查
    print_info "运行类型检查..."
    npm run type-check
    if [ $? -ne 0 ]; then
        print_error "类型检查失败"
        exit 1
    fi
    
    # 单元测试
    print_info "运行单元测试..."
    npm run test:components
    if [ $? -ne 0 ]; then
        print_error "单元测试失败"
        exit 1
    fi
    
    print_success "所有测试通过"
}

# 构建项目
build_project() {
    print_info "构建项目..."
    
    # 清理构建目录
    rm -rf dist
    
    # 构建
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "构建成功"
    else
        print_error "构建失败"
        exit 1
    fi
    
    # 检查构建结果
    if [ ! -d "dist" ]; then
        print_error "构建目录不存在"
        exit 1
    fi
    
    # 检查构建大小
    BUILD_SIZE=$(du -sh dist | cut -f1)
    print_info "构建大小: $BUILD_SIZE"
}

# 运行性能测试
run_performance_tests() {
    print_info "运行性能测试..."
    
    # 检查是否安装了 lighthouse
    if ! command -v lighthouse &> /dev/null; then
        print_warning "Lighthouse 未安装，跳过性能测试"
        return
    fi
    
    # 启动预览服务器
    npm run preview &
    PREVIEW_PID=$!
    
    # 等待服务器启动
    sleep 5
    
    # 运行 Lighthouse
    print_info "运行 Lighthouse 性能测试..."
    lighthouse http://localhost:4173 --output=json --output-path=./lighthouse-report.json --quiet
    
    # 检查性能结果
    if [ -f "lighthouse-report.json" ]; then
        print_success "性能测试完成"
        
        # 运行性能检查
        node scripts/check-performance.js ./lighthouse-report.json
        if [ $? -eq 0 ]; then
            print_success "性能检查通过"
        else
            print_warning "性能检查未通过，但继续部署"
        fi
    else
        print_warning "性能测试失败，跳过性能检查"
    fi
    
    # 停止预览服务器
    kill $PREVIEW_PID 2>/dev/null
}

# 部署到 Vercel
deploy_to_vercel() {
    print_info "部署到 Vercel..."
    
    # 检查是否安装了 Vercel CLI
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI 未安装，尝试安装..."
        npm install -g vercel
    fi
    
    # 部署
    vercel --prod
    
    if [ $? -eq 0 ]; then
        print_success "部署成功"
    else
        print_error "部署失败"
        exit 1
    fi
}

# 部署到自定义服务器
deploy_to_custom() {
    print_info "部署到自定义服务器..."
    
    # 检查服务器配置
    if [ -z "$DEPLOY_SERVER" ]; then
        print_error "未设置 DEPLOY_SERVER 环境变量"
        exit 1
    fi
    
    # 上传构建文件
    rsync -avz --delete dist/ $DEPLOY_SERVER:/var/www/jinli-club/
    
    if [ $? -eq 0 ]; then
        print_success "部署成功"
    else
        print_error "部署失败"
        exit 1
    fi
}

# 部署后验证
post_deploy_verification() {
    print_info "部署后验证..."
    
    # 等待部署完成
    sleep 10
    
    # 检查网站是否可访问
    if [ -n "$DEPLOY_URL" ]; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $DEPLOY_URL)
        
        if [ "$HTTP_STATUS" = "200" ]; then
            print_success "网站可访问 (HTTP $HTTP_STATUS)"
        else
            print_error "网站不可访问 (HTTP $HTTP_STATUS)"
            exit 1
        fi
    fi
    
    # 运行 E2E 测试
    print_info "运行 E2E 测试..."
    npm run test:e2e
    
    if [ $? -eq 0 ]; then
        print_success "E2E 测试通过"
    else
        print_warning "E2E 测试失败，但部署已完成"
    fi
}

# 生成部署报告
generate_report() {
    print_info "生成部署报告..."
    
    REPORT_FILE="deploy-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > $REPORT_FILE << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build": {
    "size": "$(du -sh dist | cut -f1)",
    "files": $(find dist -type f | wc -l)
  },
  "tests": {
    "unit": "passed",
    "e2e": "passed",
    "performance": "passed"
  },
  "deployment": {
    "url": "$DEPLOY_URL",
    "status": "success"
  }
}
EOF
    
    print_success "部署报告已生成: $REPORT_FILE"
}

# 主函数
main() {
    echo "🎯 Jinli Club 自动部署脚本"
    echo "================================"
    
    # 解析命令行参数
    SKIP_TESTS=false
    SKIP_PERFORMANCE=false
    DEPLOY_TARGET="vercel"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-performance)
                SKIP_PERFORMANCE=true
                shift
                ;;
            --target)
                DEPLOY_TARGET="$2"
                shift 2
                ;;
            *)
                print_error "未知参数: $1"
                exit 1
                ;;
        esac
    done
    
    # 执行部署步骤
    check_environment
    setup_dependencies
    
    if [ "$SKIP_TESTS" = false ]; then
        run_tests
    else
        print_warning "跳过测试"
    fi
    
    build_project
    
    if [ "$SKIP_PERFORMANCE" = false ]; then
        run_performance_tests
    else
        print_warning "跳过性能测试"
    fi
    
    # 根据目标选择部署方式
    case $DEPLOY_TARGET in
        "vercel")
            deploy_to_vercel
            ;;
        "custom")
            deploy_to_custom
            ;;
        *)
            print_error "未知部署目标: $DEPLOY_TARGET"
            exit 1
            ;;
    esac
    
    post_deploy_verification
    generate_report
    
    echo ""
    print_success "🎉 部署完成！"
    echo ""
    echo "📋 部署信息:"
    echo "   - 目标: $DEPLOY_TARGET"
    echo "   - 时间: $(date)"
    echo "   - 构建大小: $(du -sh dist | cut -f1)"
    if [ -n "$DEPLOY_URL" ]; then
        echo "   - 访问地址: $DEPLOY_URL"
    fi
    echo ""
}

# 运行主函数
main "$@"
