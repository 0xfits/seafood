import React, { useEffect, useState } from 'react'
import { ErrorBoundary } from './ErrorTracker'
import PerformanceMonitor from './PerformanceMonitor'
import { initializeUserAnalytics, useUserAnalytics } from './UserAnalytics'

// 监控上下文
const MonitoringContext = React.createContext({
  trackEvent: () => {},
  trackError: () => {},
  trackConversion: () => {},
  getSessionStats: () => ({})
})

export const useMonitoring = () => React.useContext(MonitoringContext)

// 监控提供者组件
export const MonitoringProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const analytics = useUserAnalytics()

  useEffect(() => {
    // 初始化监控系统
    const initMonitoring = async () => {
      try {
        // 初始化用户分析
        initializeUserAnalytics()
        
        // 初始化错误追踪
        if (typeof window !== 'undefined') {
          // 设置全局错误处理
          window.addEventListener('error', (event) => {
            analytics.trackError(event.error || new Error(event.message))
          })

          window.addEventListener('unhandledrejection', (event) => {
            analytics.trackError(event.reason || 'Unhandled Promise Rejection')
          })
        }

        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize monitoring:', error)
      }
    }

    initMonitoring()
  }, [analytics])

  const contextValue = {
    trackEvent: analytics.trackEvent,
    trackError: analytics.trackError,
    trackConversion: analytics.trackConversion,
    getSessionStats: analytics.getSessionStats
  }

  return (
    <MonitoringContext.Provider value={contextValue}>
      <ErrorBoundary>
        {children}
        <PerformanceMonitor />
        {isInitialized && <MonitoringDebug />}
      </ErrorBoundary>
    </MonitoringContext.Provider>
  )
}

// 开发环境调试组件
const MonitoringDebug = () => {
  const { getSessionStats } = useMonitoring()
  const [isVisible, setIsVisible] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        setStats(getSessionStats())
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [getSessionStats])

  if (process.env.NODE_ENV !== 'development' || !stats) return null

  return (
    <div className="fixed top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="flex items-center gap-2 mb-2">
        <span>监控数据</span>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-400 hover:text-white"
        >
          {isVisible ? '隐藏' : '显示'}
        </button>
      </div>
      
      {isVisible && (
        <div className="space-y-1">
          <div>会话ID: {stats.sessionId.substring(0, 8)}...</div>
          <div>用户ID: {stats.userId}</div>
          <div>持续时间: {Math.round(stats.duration / 1000)}s</div>
          <div>页面访问: {stats.pageViews}</div>
          <div>交互次数: {stats.interactions}</div>
          <div>滚动深度: {stats.maxScrollDepth}%</div>
          <div>停留时间: {Math.round(stats.dwellTime / 1000)}s</div>
        </div>
      )}
    </div>
  )
}

// 业务追踪 Hook
export const useBusinessTracking = () => {
  const { trackEvent, trackConversion } = useMonitoring()

  const trackTaskAction = (action, taskId, properties = {}) => {
    trackEvent('task_action', {
      action,
      taskId,
      ...properties
    })
  }

  const trackRewardAction = (action, rewardId, properties = {}) => {
    trackEvent('reward_action', {
      action,
      rewardId,
      ...properties
    })
  }

  const trackUserEngagement = (type, properties = {}) => {
    trackEvent('user_engagement', {
      type,
      ...properties
    })
  }

  const trackFeatureUsage = (feature, properties = {}) => {
    trackEvent('feature_usage', {
      feature,
      ...properties
    })
  }

  const trackTaskCompletion = (taskId, pointsEarned) => {
    trackEvent('task_completed', {
      taskId,
      pointsEarned
    })
    
    trackConversion('task_completion', pointsEarned, 'points')
  }

  const trackRewardClaim = (rewardId, pointsSpent) => {
    trackEvent('reward_claimed', {
      rewardId,
      pointsSpent
    })
    
    trackConversion('reward_claim', pointsSpent, 'points')
  }

  const trackUserRegistration = (userId, method) => {
    trackEvent('user_registered', {
      userId,
      method
    })
    
    trackConversion('user_registration', 1, 'user')
  }

  const trackUserLogin = (userId, method) => {
    trackEvent('user_login', {
      userId,
      method
    })
  }

  return {
    trackTaskAction,
    trackRewardAction,
    trackUserEngagement,
    trackFeatureUsage,
    trackTaskCompletion,
    trackRewardClaim,
    trackUserRegistration,
    trackUserLogin
  }
}

// 性能追踪 Hook
export const usePerformanceTracking = () => {
  const { trackEvent } = useMonitoring()

  const trackPageLoad = () => {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0]
      
      trackEvent('page_load_performance', {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        resources: performance.getEntriesByType('resource').length
      })
    }
  }

  const trackComponentRender = (componentName, renderTime) => {
    trackEvent('component_render', {
      componentName,
      renderTime
    })
  }

  const trackApiCall = (endpoint, duration, success) => {
    trackEvent('api_call', {
      endpoint,
      duration,
      success
    })
  }

  const trackUserInteraction = (interactionType, element, duration) => {
    trackEvent('user_interaction_performance', {
      interactionType,
      element,
      duration
    })
  }

  return {
    trackPageLoad,
    trackComponentRender,
    trackApiCall,
    trackUserInteraction
  }
}

// 错误追踪 Hook
export const useErrorTracking = () => {
  const { trackError } = useMonitoring()

  const trackApiError = (endpoint, error, context = {}) => {
    trackError(error, {
      type: 'api_error',
      endpoint,
      ...context
    })
  }

  const trackValidationError = (field, value, rule) => {
    trackError(new Error(`Validation failed for ${field}`), {
      type: 'validation_error',
      field,
      value,
      rule
    })
  }

  const trackNetworkError = (url, error) => {
    trackError(error, {
      type: 'network_error',
      url
    })
  }

  return {
    trackApiError,
    trackValidationError,
    trackNetworkError
  }
}

// 自动追踪高阶组件
export const withAutoTracking = (WrappedComponent, trackingConfig = {}) => {
  return (props) => {
    const { trackEvent, trackPageLoad } = useMonitoring()
    const [renderStartTime] = useState(Date.now())

    useEffect(() => {
      // 页面加载追踪
      trackPageLoad()
      
      // 组件渲染追踪
      const renderTime = Date.now() - renderStartTime
      trackEvent('component_auto_tracked', {
        component: WrappedComponent.name || 'Anonymous',
        renderTime,
        ...trackingConfig
      })
    }, [trackEvent, trackPageLoad, renderStartTime, trackingConfig])

    return <WrappedComponent {...props} />
  }
}

export default MonitoringProvider
