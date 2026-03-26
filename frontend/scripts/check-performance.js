#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// 性能检查脚本
const reportPath = process.argv[2]

if (!reportPath) {
  console.error('❌ 请提供 Lighthouse 报告路径')
  process.exit(1)
}

try {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const { audits, categories } = report
  
  const performanceScore = categories.performance.score * 100
  const accessibilityScore = categories.accessibility.score * 100
  const bestPracticesScore = categories['best-practices'].score * 100
  const seoScore = categories.seo.score * 100
  
  console.log('\n📊 Lighthouse 性能报告')
  console.log('========================')
  
  console.log(`\n🚀 性能评分: ${performanceScore.toFixed(0)}/100`)
  console.log(`♿ 可访问性: ${accessibilityScore.toFixed(0)}/100`)
  console.log(`📋 最佳实践: ${bestPracticesScore.toFixed(0)}/100`)
  console.log(`🔍 SEO: ${seoScore.toFixed(0)}/100`)
  
  // 关键指标
  const fcp = audits['first-contentful-paint']
  const lcp = audits['largest-contentful-paint']
  const cls = audits['cumulative-layout-shift']
  const fid = audits['max-potential-fid']
  
  console.log('\n⏱️  关键指标')
  console.log('------------------------')
  console.log(`首次内容绘制 (FCP): ${fcp.displayValue}`)
  console.log(`最大内容绘制 (LCP): ${lcp.displayValue}`)
  console.log(`累积布局偏移 (CLS): ${cls.displayValue}`)
  console.log(`首次输入延迟 (FID): ${fid.displayValue}`)
  
  // 检查是否达标
  const thresholds = {
    performance: 90,
    accessibility: 95,
    bestPractices: 90,
    seo: 90,
    fcp: 1800,
    lcp: 2500,
    cls: 0.1,
    fid: 100
  }
  
  let hasIssues = false
  
  console.log('\n✅ 达标检查')
  console.log('------------------------')
  
  if (performanceScore >= thresholds.performance) {
    console.log('✅ 性能评分达标')
  } else {
    console.log(`❌ 性能评分未达标 (需要 ≥${thresholds.performance})`)
    hasIssues = true
  }
  
  if (accessibilityScore >= thresholds.accessibility) {
    console.log('✅ 可访问性达标')
  } else {
    console.log(`❌ 可访问性未达标 (需要 ≥${thresholds.accessibility})`)
    hasIssues = true
  }
  
  if (fcp.numericValue <= thresholds.fcp) {
    console.log('✅ FCP 达标')
  } else {
    console.log(`❌ FCP 未达标 (需要 ≤${thresholds.fcp}ms)`)
    hasIssues = true
  }
  
  if (lcp.numericValue <= thresholds.lcp) {
    console.log('✅ LCP 达标')
  } else {
    console.log(`❌ LCP 未达标 (需要 ≤${thresholds.lcp}ms)`)
    hasIssues = true
  }
  
  if (cls.numericValue <= thresholds.cls) {
    console.log('✅ CLS 达标')
  } else {
    console.log(`❌ CLS 未达标 (需要 ≤${thresholds.cls})`)
    hasIssues = true
  }
  
  // 优化建议
  console.log('\n💡 优化建议')
  console.log('------------------------')
  
  const opportunities = Object.values(audits)
    .filter(audit => audit.scoreDisplayMode === 'numeric' && audit.score < 1)
    .sort((a, b) => a.numericValue - b.numericValue)
  
  if (opportunities.length > 0) {
    opportunities.slice(0, 5).forEach(audit => {
      console.log(`\n🔧 ${audit.title}`)
      console.log(`   影响: ${audit.displayValue}`)
      console.log(`   建议: ${audit.description || '查看详细报告'}`)
    })
  } else {
    console.log('🎉 太棒了！没有明显的优化机会')
  }
  
  // 生成性能报告摘要
  const summary = {
    timestamp: new Date().toISOString(),
    scores: {
      performance: performanceScore,
      accessibility: accessibilityScore,
      bestPractices: bestPracticesScore,
      seo: seoScore
    },
    metrics: {
      fcp: fcp.numericValue,
      lcp: lcp.numericValue,
      cls: cls.numericValue,
      fid: fid.numericValue
    },
    passed: !hasIssues,
    issues: opportunities.length
  }
  
  fs.writeFileSync('performance-summary.json', JSON.stringify(summary, null, 2))
  
  console.log('\n📋 报告已保存到 performance-summary.json')
  
  if (hasIssues) {
    console.log('\n⚠️  存在性能问题，建议优化后再部署')
    process.exit(1)
  } else {
    console.log('\n🎉 性能检查通过！可以安全部署')
  }
  
} catch (error) {
  console.error('❌ 解析 Lighthouse 报告失败:', error.message)
  process.exit(1)
}
