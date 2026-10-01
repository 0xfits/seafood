import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils'

const LoadingSpinner = ({ 
  size = 'md',
  className 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  return (
    <div 
      className={cn(
        'animate-spin rounded-full border-2 border-gray-300 border-t-yellow-500',
        sizeClasses[size],
        className
      )}
    />
  )
}

const LoadingSkeleton = ({ 
  lines = 3,
  className 
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i}
          className={cn(
            'h-4 bg-gray-200 rounded animate-pulse',
            i === lines - 1 && 'w-3/4'
          )}
        />
      ))}
    </div>
  )
}

const LoadingCard = ({ 
  count = 1,
  className 
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className="bg-white rounded-xl border-2 border-gray-200 p-6 animate-pulse"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-3/4" />
            </div>
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}

const LoadingPage = ({ 
  message,
  className 
}) => {
  const { t } = useTranslation()

  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] space-y-4',
        className
      )}
    >
      <LoadingSpinner size="xl" />
      {/* P6-I18N-LIT-B5：默认文案改走 locale（既有键 `loading`），调用方显式传入优先 */}
      <p className="text-gray-500 text-lg">{message ?? t('loading')}</p>
    </div>
  )
}

export { 
  LoadingSpinner, 
  LoadingSkeleton, 
  LoadingCard, 
  LoadingPage 
}
