import React, { Component, ErrorInfo } from 'react'

// 错误追踪系统
class ErrorTracker {
  constructor() {
    this.errors = []
    this.maxErrors = 100
    this.isOnline = navigator.onLine
    this.setupErrorListeners()
  }

  setupErrorListeners() {
    // 监听网络状态
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushErrors()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    // 监听页面卸载
    window.addEventListener('beforeunload', () => {
      this.flushErrors(true)
    })
  }

  // 捕获错误
  captureError(error, errorInfo = null) {
    const errorData = {
      message: error.message || error,
      stack: error.stack || errorInfo?.componentStack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      buildVersion: process.env.REACT_APP_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    }

    // 添加上下文信息
    if (errorInfo) {
      errorData.componentStack = errorInfo.componentStack
      errorData.errorBoundary = true
    }

    // 添加用户交互信息
    errorData.userInteraction = this.getLastUserInteraction()

    // 添加性能信息
    errorData.performance = this.getPerformanceInfo()

    this.errors.push(errorData)

    // 限制错误数量
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }

    // 如果在线，立即发送
    if (this.isOnline) {
      this.sendErrors()
    }

    // 控制台输出
    console.error('Error captured:', errorData)
  }

  // 捕获 Promise 拒绝
  captureUnhandledRejection(event) {
    this.captureError(event.reason || 'Unhandled Promise Rejection')
  }

  // 发送错误到服务器
  async sendErrors() {
    if (this.errors.length === 0) return

    try {
      const response = await fetch('/api/analytics/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors: this.errors,
          timestamp: Date.now(),
          source: 'frontend'
        })
      })

      if (response.ok) {
        this.errors = []
      }
    } catch (error) {
      console.warn('Failed to send errors:', error)
    }
  }

  // 强制发送错误（用于页面卸载）
  flushErrors(isSync = false) {
    if (this.errors.length === 0) return

    const data = JSON.stringify({
      errors: this.errors,
      timestamp: Date.now(),
      source: 'frontend'
    })

    if (isSync && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/errors', data)
    } else {
      fetch('/api/analytics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true
      }).catch(() => {
        // 静默失败
      })
    }

    this.errors = []
  }

  // 获取用户ID
  getUserId() {
    try {
      const user = localStorage.getItem('user')
      if (user) {
        const parsedUser = JSON.parse(user)
        return parsedUser.uID || 'anonymous'
      }
    } catch (error) {
      // 忽略错误
    }
    return 'anonymous'
  }

  // 获取会话ID
  getSessionId() {
    let sessionId = sessionStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      sessionStorage.setItem('sessionId', sessionId)
    }
    return sessionId
  }

  // 获取最后的用户交互
  getLastUserInteraction() {
    const interactions = [
      'click',
      'scroll',
      'keydown',
      'touchstart'
    ]

    // 这里可以实现更复杂的交互追踪
    return {
      type: 'unknown',
      timestamp: Date.now() - 5000 // 假设5秒内有交互
    }
  }

  // 获取性能信息
  getPerformanceInfo() {
    try {
      const navigation = performance.getEntriesByType('navigation')[0]
      const memory = performance.memory

      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        memoryUsed: memory ? memory.usedJSHeapSize : null,
        memoryTotal: memory ? memory.totalJSHeapSize : null
      }
    } catch (error) {
      return null
    }
  }

  // 清除错误
  clearErrors() {
    this.errors = []
  }

  // 获取错误统计
  getErrorStats() {
    return {
      total: this.errors.length,
      recent: this.errors.filter(e => Date.now() - e.timestamp < 3600000).length, // 最近1小时
      critical: this.errors.filter(e => e.message.includes('Critical')).length
    }
  }
}

// 全局错误追踪实例
const errorTracker = new ErrorTracker()

// React 错误边界组件
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    errorTracker.captureError(error, errorInfo)

    // 调用自定义错误处理
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              出现了一些问题
            </h1>
            
            <p className="text-gray-600 mb-6">
              应用程序遇到了意外错误。我们已经记录了这个问题，请稍后再试。
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新加载
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                返回首页
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 pt-6 border-t border-gray-200">
                <summary className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  显示错误详情
                </summary>
                
                <div className="mt-4 text-left">
                  <div className="bg-gray-100 rounded p-3 mb-3">
                    <h3 className="font-semibold text-sm mb-2">错误信息:</h3>
                    <pre className="text-xs text-red-600 overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  
                  {this.state.errorInfo && (
                    <div className="bg-gray-100 rounded p-3">
                      <h3 className="font-semibold text-sm mb-2">组件堆栈:</h3>
                      <pre className="text-xs text-gray-600 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for error tracking
export const useErrorTracker = () => {
  const reportError = (error, context = {}) => {
    errorTracker.captureError(error, context)
  }

  const reportUserAction = (action, data = {}) => {
    // 可以扩展为用户行为追踪
    console.log('User action:', action, data)
  }

  const getErrorStats = () => {
    return errorTracker.getErrorStats()
  }

  return {
    reportError,
    reportUserAction,
    getErrorStats
  }
}

// 初始化错误追踪
export const initializeErrorTracking = () => {
  // 监听未处理的错误
  window.addEventListener('error', (event) => {
    errorTracker.captureError(event.error || new Error(event.message))
  })

  // 监听未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    errorTracker.captureUnhandledRejection(event)
  })

  // 页面卸载时发送错误
  window.addEventListener('beforeunload', () => {
    errorTracker.flushErrors(true)
  })

  console.log('Error tracking initialized')
}

export default errorTracker
