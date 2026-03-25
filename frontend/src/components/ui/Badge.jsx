import React from 'react'
import { cn } from '../../utils'

const badgeVariants = {
  variant: {
    default: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    primary: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    secondary: 'bg-blue-100 text-blue-800 border-blue-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-red-100 text-red-800 border-red-200',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200'
  },
  size: {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base'
  }
}

const Badge = React.forwardRef(({ 
  className, 
  variant = 'default',
  size = 'md',
  children, 
  ...props 
}, ref) => {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'rounded-full',
    'border',
    'font-medium',
    'transition-colors'
  ]

  const variantClasses = badgeVariants.variant[variant]
  const sizeClasses = badgeVariants.size[size]

  return (
    <div
      ref={ref}
      className={cn(
        ...baseClasses,
        variantClasses,
        sizeClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Badge.displayName = 'Badge'

export { Badge, badgeVariants }
