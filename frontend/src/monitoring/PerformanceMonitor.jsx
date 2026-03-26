import React, { useEffect, useState } from 'react'

// 性能监控组件
const PerformanceMonitor = ({ enabled = process.env.NODE_ENV === 'production' }) => {
  const [metrics, setMetrics] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return

    // 监控 Web Vitals
    const monitorWebVitals = () => {
      // FCP - First Contentful Paint
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            sendMetric('FCP', entry.startTime)
          }
        }
      })
      observer.observe({ entryTypes: ['paint'] })

      // LCP - Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        sendMetric('LCP', lastEntry.startTime)
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // CLS - Cumulative Layout Shift
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        }
        sendMetric('CLS', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })

      // FID - First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          sendMetric('FID', entry.processingStart - entry.startTime)
        }
      })
      fidObserver.observe({ entryTypes: ['first-input'] })
    }

    // 发送指标到分析服务
    const sendMetric = (name, value) => {
      const metric = {
        name,
        value,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }

      // 发送到分析服务（示例）
      if (window.gtag) {
        window.gtag('event', 'web_vital', {
          event_category: 'Web Vitals',
          event_label: name,
          value: Math.round(name === 'CLS' ? value * 1000 : value),
          non_interaction: true
        })
      }

      // 或者发送到自定义端点
      fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      }).catch(() => {
        // 静默失败，不影响用户体验
      })
    }

    // 监控错误
    const handleError = (event) => {
      const error = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
        url: window.location.href
      }

      sendError(error)
    }

    // 监控未处理的 Promise 拒绝
    const handleUnhandledRejection = (event) => {
      const error = {
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        timestamp: Date.now(),
        url: window.location.href
      }

      sendError(error)
    }

    // 发送错误到错误追踪服务
    const sendError = (error) => {
      // 发送到错误追踪服务（如 Sentry）
      if (window.Sentry) {
        window.Sentry.captureException(error)
      }

      // 或者发送到自定义端点
      fetch('/api/analytics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      }).catch(() => {
        // 静默失败
      })
    }

    // 监控资源加载
    const monitorResources = () => {
      const resources = performance.getEntriesByType('resource')
      const slowResources = resources.filter(resource => 
        resource.duration > 2000 // 超过2秒的资源
      )

      slowResources.forEach(resource => {
        sendMetric('slow_resource', {
          name: resource.name,
          duration: resource.duration,
          size: resource.transferSize
        })
      })
    }

    // 监控用户交互
    const monitorInteractions = () => {
      const interactions = ['click', 'scroll', 'keydown']
      
      interactions.forEach(eventType => {
        document.addEventListener(eventType, () => {
          const metric = {
            type: 'user_interaction',
            event: eventType,
            timestamp: Date.now(),
            url: window.location.href
          }

          sendMetric('user_interaction', metric)
        }, { passive: true })
      })
    }

    // 启动监控
    monitorWebVitals()
    monitorResources()
    monitorInteractions()

    // 错误监听
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // 页面卸载时发送最终指标
    const handleUnload = () => {
      const pageData = {
        type: 'page_unload',
        duration: performance.now(),
        timestamp: Date.now(),
        url: window.location.href
      }

      navigator.sendBeacon('/api/analytics/page', JSON.stringify(pageData))
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [enabled])

  // 开发环境下显示性能指标
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const updateMetrics = () => {
        const navigation = performance.getEntriesByType('navigation')[0]
        
        setMetrics({
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
          resources: performance.getEntriesByType('resource').length
        })
      }

      // 页面加载完成后更新指标
      if (document.readyState === 'complete') {
        updateMetrics()
      } else {
        window.addEventListener('load', updateMetrics)
      }

      return () => window.removeEventListener('load', updateMetrics)
    }
  }, [])

  if (!enabled || !metrics) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono">
      <div className="flex items-center gap-2 mb-2">
        <span>性能指标</span>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-400 hover:text-white"
        >
          {isVisible ? '隐藏' : '显示'}
        </button>
      </div>
      
      {isVisible && (
        <div className="space-y-1">
          <div>加载时间: {metrics.loadTime.toFixed(0)}ms</div>
          <div>DOM完成: {metrics.domContentLoaded.toFixed(0)}ms</div>
          <div>首次绘制: {metrics.firstPaint.toFixed(0)}ms</div>
          <div>资源数量: {metrics.resources}</div>
        </div>
      )}
    </div>
  )
}

// 自定义 Hook 用于性能监控
export const usePerformanceMonitor = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [connectionType, setConnectionType] = useState('unknown')

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 检测网络类型
    if (navigator.connection) {
      const connection = navigator.connection
      setConnectionType(connection.effectiveType || 'unknown')
      
      const handleConnectionChange = () => {
        setConnectionType(connection.effectiveType || 'unknown')
      }

      connection.addEventListener('change', handleConnectionChange)
      
      return () => {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    connectionType,
    reportPerformance: (name, value) => {
      if (window.gtag) {
        window.gtag('event', 'performance', {
          event_category: 'Custom Metrics',
          event_label: name,
          value: Math.round(value)
        })
      }
    }
  }
}

export default PerformanceMonitor
