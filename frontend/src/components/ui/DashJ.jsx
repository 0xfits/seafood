import React from 'react'
import { cn } from '../../utils'

// dashJ 符号组件 - 类似美元符号和字母S的关系
// J 字母加上横划线，表示社区积分
const DashJ = ({ 
  size = 'md', 
  className = '',
  showText = false,
  amount = null 
}) => {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl'
  }

  // dashJ 符号 - J 字母 + 横划线
  const symbol = (
    <span 
      className={cn(
        'inline-flex items-center font-bold text-yellow-600 dark:text-yellow-400',
        sizeClasses[size],
        className
      )}
      title="dashJ 社区积分"
    >
      <span className="relative">
        <span className="font-serif">J</span>
        <span className="absolute top-1/2 left-0 w-full h-0.5 bg-current transform -translate-y-1/2"></span>
      </span>
    </span>
  )

  if (showText && amount !== null) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span className="text-gray-900 dark:text-white font-medium">
          {amount.toLocaleString()}
        </span>
        {symbol}
      </span>
    )
  }

  return symbol
}

export default DashJ
