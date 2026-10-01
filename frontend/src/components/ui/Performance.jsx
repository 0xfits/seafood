import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils'
import { PLACEHOLDER_IMAGE } from '../../assets/placeholder'

// 虚拟滚动列表
const VirtualList = ({ 
  items, 
  itemHeight = 50, 
  containerHeight = 400,
  renderItem,
  className 
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef(null)
  
  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  )
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleStart, visibleEnd).map((item, index) => ({
      item,
      index: visibleStart + index
    }))
  }, [items, visibleStart, visibleEnd])
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop)
  }, [])
  
  const totalHeight = items.length * itemHeight
  
  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// 图片懒加载组件
const LazyImage = ({ 
  src, 
  alt, 
  placeholder = PLACEHOLDER_IMAGE, // P6-MISC-FIX ⑤：仓库内不存在 '/placeholder.jpg'
  className,
  onLoad,
  onError 
}) => {
  const { t } = useTranslation()
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1 }
    )
    
    if (imgRef.current) {
      observer.observe(imgRef.current)
    }
    
    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current)
      }
    }
  }, [])
  
  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }
  
  const handleError = () => {
    setHasError(true)
    onError?.()
  }
  
  return (
    <div ref={imgRef} className={cn('relative', className)}>
      {/* 占位符 */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
      
      {/* 实际图片 */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
        />
      )}
      
      {/* 错误状态 */}
      {hasError && (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded">
          <span className="text-gray-500">{t('uiCommon.loadFailed')}</span>
        </div>
      )}
    </div>
  )
}

// 防抖输入组件
const DebouncedInput = ({ 
  value: controlledValue, 
  onChange, 
  delay = 300,
  className,
  ...props 
}) => {
  const [value, setValue] = useState(controlledValue || '')
  const timeoutRef = useRef(null)
  
  useEffect(() => {
    setValue(controlledValue || '')
  }, [controlledValue])
  
  const handleChange = (e) => {
    const newValue = e.target.value
    setValue(newValue)
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue)
    }, delay)
  }
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return (
    <input
      value={value}
      onChange={handleChange}
      className={cn('w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-yellow-500', className)}
      {...props}
    />
  )
}

// 节流按钮组件
const ThrottledButton = ({ 
  onClick, 
  delay = 1000,
  children,
  className,
  ...props 
}) => {
  const { t } = useTranslation()
  const [isThrottled, setIsThrottled] = useState(false)
  const timeoutRef = useRef(null)
  
  const handleClick = (e) => {
    if (isThrottled) return
    
    onClick?.(e)
    setIsThrottled(true)
    
    timeoutRef.current = setTimeout(() => {
      setIsThrottled(false)
    }, delay)
  }
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return (
    <button
      onClick={handleClick}
      disabled={isThrottled}
      className={cn(
        'px-4 py-2 bg-yellow-500 text-white rounded-lg',
        'transition-all duration-200',
        'hover:bg-yellow-600 disabled:bg-gray-400',
        'disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {isThrottled ? t('uiCommon.pleaseWait') : children}
    </button>
  )
}

// 无限滚动组件
const InfiniteScroll = ({ 
  children, 
  onLoadMore, 
  hasMore, 
  loading,
  className 
}) => {
  const { t } = useTranslation()
  const triggerRef = useRef(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )
    
    if (triggerRef.current) {
      observer.observe(triggerRef.current)
    }
    
    return () => {
      if (triggerRef.current) {
        observer.unobserve(triggerRef.current)
      }
    }
  }, [hasMore, loading, onLoadMore])
  
  return (
    <div className={cn('space-y-4', className)}>
      {children}
      
      {/* 加载触发器 */}
      <div ref={triggerRef} className="h-1" />
      
      {/* 加载状态 */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
        </div>
      )}
      
      {/* 没有更多数据 */}
      {!hasMore && !loading && (
        <div className="text-center py-4 text-gray-500">
          {t('uiCommon.noMoreData')}
        </div>
      )}
    </div>
  )
}

// 缓存组件
const MemoizedComponent = React.memo(({ 
  data, 
  renderItem,
  className 
}) => {
  const memoizedItems = useMemo(() => {
    return data.map((item, index) => renderItem(item, index))
  }, [data, renderItem])
  
  return (
    <div className={cn('space-y-2', className)}>
      {memoizedItems}
    </div>
  )
})

// 性能监控组件
const PerformanceMonitor = ({ children }) => {
  const { t } = useTranslation()
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    memoryUsage: 0
  })
  
  useEffect(() => {
    const startTime = performance.now()
    
    // 监控渲染时间
    const renderTime = performance.now() - startTime
    
    // 监控内存使用（如果支持）
    const memoryUsage = performance.memory ? 
      Math.round(performance.memory.usedJSHeapSize / 1048576) : 0
    
    setMetrics({ renderTime, memoryUsage })
  }, [])
  
  // 在开发环境中显示性能指标
  if (process.env.NODE_ENV === 'development') {
    return (
      <div>
        {children}
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs">
          <div>{t('uiCommon.renderTime')}: {metrics.renderTime.toFixed(2)}ms</div>
          <div>{t('uiCommon.memoryUsage')}: {metrics.memoryUsage}MB</div>
        </div>
      </div>
    )
  }
  
  return children
}

// 代码分割加载组件
const LazyComponent = ({ 
  componentLoader, 
  fallback,
  className 
}) => {
  const { t } = useTranslation()
  const [Component, setComponent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    const loadComponent = async () => {
      try {
        setIsLoading(true)
        const loadedComponent = await componentLoader()
        setComponent(() => loadedComponent.default || loadedComponent)
      } catch (err) {
        setError(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadComponent()
  }, [componentLoader])
  
  if (isLoading) {
    return <div className={cn('text-center py-4', className)}>{fallback ?? <div>{t('loading')}</div>}</div>
  }
  
  if (error) {
    return (
      <div className={cn('text-center py-4 text-red-500', className)}>
        {t('uiCommon.loadFailed')}: {error.message}
      </div>
    )
  }
  
  return Component ? <Component /> : null
}

export {
  VirtualList,
  LazyImage,
  DebouncedInput,
  ThrottledButton,
  InfiniteScroll,
  MemoizedComponent,
  PerformanceMonitor,
  LazyComponent
}
