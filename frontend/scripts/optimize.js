#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 性能优化脚本
console.log('🚀 开始性能优化...')

// 1. 检查包大小
console.log('\n📦 检查包大小...')
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const dependencies = packageJson.dependencies || {}
  
  const largePackages = Object.entries(dependencies)
    .filter(([name]) => {
      const largePackages = ['moment', 'lodash', 'axios', 'react-router-dom']
      return largePackages.some(large => name.includes(large))
    })
  
  if (largePackages.length > 0) {
    console.log('⚠️  发现可能的大包:')
    largePackages.forEach(([name, version]) => {
      console.log(`   - ${name}@${version}`)
    })
    console.log('💡 建议使用更小的替代品')
  } else {
    console.log('✅ 未发现明显的大包')
  }
} catch (error) {
  console.log('❌ 检查包大小失败:', error.message)
}

// 2. 分析构建大小
console.log('\n📊 分析构建大小...')
try {
  if (fs.existsSync('dist')) {
    execSync('du -sh dist', { stdio: 'inherit' })
  } else {
    console.log('📁 构建目录不存在，先构建...')
    execSync('npm run build', { stdio: 'inherit' })
    execSync('du -sh dist', { stdio: 'inherit' })
  }
} catch (error) {
  console.log('❌ 分析构建大小失败:', error.message)
}

// 3. 检查未使用的依赖
console.log('\n🔍 检查未使用的依赖...')
try {
  execSync('npx depcheck', { stdio: 'inherit' })
} catch (error) {
  console.log('⚠️  depcheck 检查完成，可能存在未使用的依赖')
}

// 4. 运行代码检查
console.log('\n🔍 运行代码检查...')
try {
  execSync('npm run lint', { stdio: 'inherit' })
} catch (error) {
  console.log('⚠️  代码检查发现问题')
}

// 5. 运行类型检查
console.log('\n📝 运行类型检查...')
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' })
} catch (error) {
  console.log('⚠️  类型检查发现问题')
}

// 6. 生成性能报告
console.log('\n📈 生成性能报告...')
try {
  const report = {
    timestamp: new Date().toISOString(),
    buildSize: getBuildSize(),
    bundleAnalysis: analyzeBundle(),
    recommendations: generateRecommendations()
  }
  
  fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2))
  console.log('✅ 性能报告已生成: performance-report.json')
} catch (error) {
  console.log('❌ 生成性能报告失败:', error.message)
}

function getBuildSize() {
  try {
    if (!fs.existsSync('dist')) return null
    
    const stats = fs.statSync('dist')
    return {
      size: stats.size,
      sizeHuman: formatBytes(stats.size)
    }
  } catch (error) {
    return null
  }
}

function analyzeBundle() {
  // 这里可以集成 webpack-bundle-analyzer 或类似工具
  return {
    note: '需要集成 bundle analyzer 进行详细分析'
  }
}

function generateRecommendations() {
  const recommendations = []
  
  // 检查是否有性能优化机会
  if (fs.existsSync('src/components/ui')) {
    recommendations.push({
      type: 'optimization',
      message: '考虑使用 React.memo 优化组件渲染'
    })
  }
  
  if (fs.existsSync('src/pages')) {
    recommendations.push({
      type: 'optimization',
      message: '考虑使用 React.lazy 进行代码分割'
    })
  }
  
  recommendations.push({
    type: 'testing',
    message: '添加更多单元测试以提高代码质量'
  })
  
  recommendations.push({
    type: 'accessibility',
    message: '定期进行可访问性审计'
  })
  
  return recommendations
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

console.log('\n🎉 性能优化完成！')
