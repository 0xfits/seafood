import React, { Component, useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { cn } from '../../utils'

// 错误边界组件
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // 记录错误到控制台或错误报告服务
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // 可以在这里添加错误报告逻辑
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          showDetails={this.props.showDetails}
        />
      )
    }

    return this.props.children
  }
}

// 错误回退组件
const ErrorFallback = ({ 
  error, 
  errorInfo, 
  onReset, 
  showDetails = false 
}) => {
  const [showErrorDetails, setShowErrorDetails] = useState(showDetails)
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-8 h-8 text-red-600" />
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
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700"
            >
              <Bug className="w-4 h-4" />
              {showErrorDetails ? '隐藏' : '显示'} 错误详情
            </button>
            
            {showErrorDetails && (
              <div className="mt-4 text-left">
                <div className="bg-gray-100 rounded p-3 mb-3">
                  <h3 className="font-semibold text-sm mb-2">错误信息:</h3>
                  <pre className="text-xs text-red-600 overflow-auto">
                    {error?.toString()}
                  </pre>
                </div>
                
                {errorInfo && (
                  <div className="bg-gray-100 rounded p-3">
                    <h3 className="font-semibold text-sm mb-2">组件堆栈:</h3>
                    <pre className="text-xs text-gray-600 overflow-auto">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 网络错误处理组件
const NetworkErrorHandler = ({ 
  children, 
  retryCount = 3, 
  onRetry 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [retryAttempts, setRetryAttempts] = useState(0)
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  const handleRetry = () => {
    if (retryAttempts < retryCount) {
      setRetryAttempts(prev => prev + 1)
      onRetry?.()
    }
  }
  
  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            网络连接异常
          </h1>
          
          <p className="text-gray-600 mb-6">
            请检查您的网络连接，然后重试。
          </p>
          
          <button
            onClick={handleRetry}
            disabled={retryAttempts >= retryCount}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试 {retryAttempts > 0 && `(${retryAttempts}/${retryCount})`}
          </button>
        </div>
      </div>
    )
  }
  
  return children
}

// API 错误处理 Hook
const useErrorHandler = () => {
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const handleError = (error) => {
    console.error('API Error:', error)
    
    // 根据错误类型设置不同的错误信息
    let errorMessage = '发生未知错误'
    
    if (error.response) {
      // 服务器响应错误
      const status = error.response.status
      switch (status) {
        case 400:
          errorMessage = '请求参数错误'
          break
        case 401:
          errorMessage = '未授权访问'
          break
        case 403:
          errorMessage = '权限不足'
          break
        case 404:
          errorMessage = '请求的资源不存在'
          break
        case 500:
          errorMessage = '服务器内部错误'
          break
        default:
          errorMessage = `服务器错误 (${status})`
      }
    } else if (error.request) {
      // 网络错误
      errorMessage = '网络连接失败'
    } else {
      // 其他错误
      errorMessage = error.message || '发生未知错误'
    }
    
    setError({
      message: errorMessage,
      originalError: error,
      timestamp: new Date().toISOString()
    })
  }
  
  const clearError = () => {
    setError(null)
  }
  
  const executeWithErrorHandling = async (asyncFunction) => {
    try {
      setIsLoading(true)
      clearError()
      return await asyncFunction()
    } catch (error) {
      handleError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeWithErrorHandling
  }
}

// 错误提示组件
const ErrorToast = ({ error, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm bg-red-50 border-2 border-red-200 rounded-lg shadow-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-800">错误</h3>
          <p className="text-red-700 text-sm mt-1">{error?.message}</p>
          {process.env.NODE_ENV === 'development' && error?.originalError && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer">详细信息</summary>
              <pre className="text-xs text-red-600 mt-1 overflow-auto">
                {error.originalError.toString()}
              </pre>
            </details>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// 404 错误页面
const NotFoundPage = ({ onGoHome }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="text-6xl font-bold text-gray-300 mb-4">404</div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          页面未找到
        </h1>
        
        <p className="text-gray-600 mb-6">
          您访问的页面不存在或已被移动。
        </p>
        
        <button
          onClick={onGoHome}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
        >
          <Home className="w-4 h-4" />
          返回首页
        </button>
      </div>
    </div>
  )
}

// 加载状态组件
const LoadingFallback = ({ message = '加载中...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }
  
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={cn(
        'animate-spin rounded-full border-2 border-gray-300 border-t-yellow-500',
        sizeClasses[size]
      )} />
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  )
}

export {
  ErrorBoundary,
  ErrorFallback,
  NetworkErrorHandler,
  useErrorHandler,
  ErrorToast,
  NotFoundPage,
  LoadingFallback
}
