import React, { useEffect, useState, useRef } from 'react'

// 用户行为分析系统
class UserAnalytics {
  constructor() {
    this.events = []
    this.sessionStart = Date.now()
    this.pageViews = 0
    this.interactions = 0
    this.scrollDepth = 0
    this.maxScrollDepth = 0
    this.dwellTime = 0
    this.isTracking = process.env.NODE_ENV === 'production'
    this.sessionId = this.generateSessionId()
    this.userId = this.getUserId()
    
    if (this.isTracking) {
      this.initializeTracking()
    }
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

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

  initializeTracking() {
    // 页面访问
    this.trackPageView()
    
    // 用户交互追踪
    this.setupInteractionTracking()
    
    // 滚动深度追踪
    this.setupScrollTracking()
    
    // 停留时间追踪
    this.setupDwellTimeTracking()
    
    // 表单交互追踪
    this.setupFormTracking()
    
    // 页面卸载时发送数据
    window.addEventListener('beforeunload', () => {
      this.flushData(true)
    })

    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTracking()
      } else {
        this.resumeTracking()
      }
    })
  }

  trackPageView(path = null) {
    const pageData = {
      type: 'pageview',
      path: path || window.location.pathname,
      referrer: document.referrer,
      title: document.title,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: screen.width,
        height: screen.height
      }
    }

    this.events.push(pageData)
    this.pageViews++
    
    // 立即发送页面访问事件
    this.sendEvent(pageData)
  }

  trackEvent(eventName, properties = {}) {
    if (!this.isTracking) return

    const eventData = {
      type: 'event',
      name: eventName,
      properties: {
        ...properties,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        path: window.location.pathname
      }
    }

    this.events.push(eventData)
    this.interactions++
    
    // 批量发送事件
    if (this.events.length >= 10) {
      this.flushData()
    }
  }

  setupInteractionTracking() {
    const interactions = [
      { type: 'click', selector: 'button, a, input[type="button"], input[type="submit"]' },
      { type: 'scroll', selector: window },
      { type: 'keydown', selector: document },
      { type: 'touchstart', selector: document }
    ]

    interactions.forEach(({ type, selector }) => {
      const element = selector === window ? window : document
      
      element.addEventListener(type, (event) => {
        const target = event.target
        const elementInfo = this.getElementInfo(target)
        
        this.trackEvent('user_interaction', {
          interactionType: type,
          element: elementInfo,
          coordinates: {
            x: event.clientX,
            y: event.clientY
          },
          timestamp: Date.now()
        })
      }, { passive: true })
    })
  }

  setupScrollTracking() {
    let scrollTimeout
    
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        const scrollTop = window.pageYOffset
        const documentHeight = document.documentElement.scrollHeight
        const windowHeight = window.innerHeight
        const scrollPercentage = Math.round((scrollTop / (documentHeight - windowHeight)) * 100)
        
        this.scrollDepth = scrollPercentage
        this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollPercentage)
        
        // 记录重要的滚动里程碑
        const milestones = [25, 50, 75, 90]
        milestones.forEach(milestone => {
          if (scrollPercentage >= milestone && !this[`scrolled${milestone}`]) {
            this[`scrolled${milestone}`] = true
            this.trackEvent('scroll_milestone', {
              milestone,
              scrollPercentage
            })
          }
        })
      }, 100)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  setupDwellTimeTracking() {
    let startTime = Date.now()
    let totalTime = 0
    
    const updateDwellTime = () => {
      if (!document.hidden) {
        totalTime += Date.now() - startTime
      }
      startTime = Date.now()
      this.dwellTime = totalTime
    }

    setInterval(updateDwellTime, 5000) // 每5秒更新一次
  }

  setupFormTracking() {
    const forms = document.querySelectorAll('form')
    
    forms.forEach(form => {
      // 表单开始
      form.addEventListener('focusin', (event) => {
        const fieldName = event.target.name || event.target.id || 'unknown'
        this.trackEvent('form_start', {
          formId: form.id || 'unknown',
          fieldName
        })
      })

      // 表单提交
      form.addEventListener('submit', (event) => {
        this.trackEvent('form_submit', {
          formId: form.id || 'unknown',
          formAction: form.action || 'unknown'
        })
      })

      // 表单字段验证
      form.addEventListener('invalid', (event) => {
        const fieldName = event.target.name || event.target.id || 'unknown'
        this.trackEvent('form_validation_error', {
          formId: form.id || 'unknown',
          fieldName,
          validationMessage: event.target.validationMessage
        })
      })
    })
  }

  getElementInfo(element) {
    if (!element) return null

    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent ? element.textContent.substring(0, 50) : '',
      attributes: {
        type: element.type,
        name: element.name,
        href: element.href,
        src: element.src
      }
    }
  }

  trackConversion(conversionType, value = null, currency = null) {
    this.trackEvent('conversion', {
      conversionType,
      value,
      currency,
      timestamp: Date.now()
    })
  }

  trackError(error, context = {}) {
    this.trackEvent('error', {
      message: error.message || error,
      stack: error.stack,
      context,
      timestamp: Date.now()
    })
  }

  async sendEvent(event) {
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event)
      })
    } catch (error) {
      // 静默失败，不影响用户体验
    }
  }

  async flushData(isSync = false) {
    if (this.events.length === 0) return

    const data = {
      events: this.events,
      session: {
        id: this.sessionId,
        userId: this.userId,
        startTime: this.sessionStart,
        duration: Date.now() - this.sessionStart,
        pageViews: this.pageViews,
        interactions: this.interactions,
        maxScrollDepth: this.maxScrollDepth,
        dwellTime: this.dwellTime
      },
      timestamp: Date.now()
    }

    if (isSync && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/batch', JSON.stringify(data))
    } else {
      try {
        await fetch('/api/analytics/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        })
      } catch (error) {
        // 静默失败
      }
    }

    this.events = []
  }

  pauseTracking() {
    this.isTracking = false
  }

  resumeTracking() {
    this.isTracking = true
  }

  getSessionStats() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      duration: Date.now() - this.sessionStart,
      pageViews: this.pageViews,
      interactions: this.interactions,
      maxScrollDepth: this.maxScrollDepth,
      dwellTime: this.dwellTime
    }
  }
}

// React Hook for user analytics
export const useUserAnalytics = () => {
  const [analytics] = useState(() => new UserAnalytics())
  const sessionStatsRef = useRef(null)

  useEffect(() => {
    // 定期更新会话统计
    const interval = setInterval(() => {
      sessionStatsRef.current = analytics.getSessionStats()
    }, 1000)

    return () => clearInterval(interval)
  }, [analytics])

  const trackEvent = (eventName, properties = {}) => {
    analytics.trackEvent(eventName, properties)
  }

  const trackPageView = (path) => {
    analytics.trackPageView(path)
  }

  const trackConversion = (type, value, currency) => {
    analytics.trackConversion(type, value, currency)
  }

  const trackError = (error, context) => {
    analytics.trackError(error, context)
  }

  const getSessionStats = () => {
    return sessionStatsRef.current || analytics.getSessionStats()
  }

  return {
    trackEvent,
    trackPageView,
    trackConversion,
    trackError,
    getSessionStats
  }
}

// 高阶组件用于页面追踪
export const withPageTracking = (WrappedComponent, pageName) => {
  return (props) => {
    const { trackPageView } = useUserAnalytics()

    useEffect(() => {
      trackPageView(pageName || window.location.pathname)
    }, [trackPageView, pageName])

    return <WrappedComponent {...props} />
  }
}

// 初始化用户分析
export const initializeUserAnalytics = () => {
  const analytics = new UserAnalytics()
  
  // 全局错误追踪
  window.addEventListener('error', (event) => {
    analytics.trackError(event.error || new Error(event.message))
  })

  console.log('User analytics initialized')
  return analytics
}

export default UserAnalytics
