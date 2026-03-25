import React from 'react'
import { cn } from '../../utils'

const cardVariants = {
  variant: {
    default: 'bg-white border-gray-200 shadow-sm',
    primary: 'bg-yellow-50 border-yellow-200 shadow-yellow-100',
    secondary: 'bg-blue-50 border-blue-200 shadow-blue-100',
    success: 'bg-green-50 border-green-200 shadow-green-100',
    warning: 'bg-red-50 border-red-200 shadow-red-100',
    inactive: 'bg-gray-50 border-gray-200 shadow-gray-100'
  },
  hover: {
    none: '',
    lift: 'hover:shadow-lg hover:-translate-y-1',
    glow: 'hover:shadow-xl hover:ring-2 hover:ring-yellow-200'
  }
}

const Card = React.forwardRef(({ 
  className, 
  variant = 'default',
  hover = 'lift',
  children, 
  ...props 
}, ref) => {
  const baseClasses = [
    'rounded-xl',
    'border-2',
    'p-6',
    'transition-all',
    'duration-300'
  ]

  const variantClasses = cardVariants.variant[variant]
  const hoverClasses = cardVariants.hover[hover]

  return (
    <div
      ref={ref}
      className={cn(
        ...baseClasses,
        variantClasses,
        hoverClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

const CardHeader = React.forwardRef(({ 
  className, 
  children, 
  ...props 
}, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  >
    {children}
  </div>
))

const CardTitle = React.forwardRef(({ 
  className, 
  children, 
  ...props 
}, ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold text-lg leading-none tracking-tight', className)}
    {...props}
  >
    {children}
  </h3>
))

const CardContent = React.forwardRef(({ 
  className, 
  children, 
  ...props 
}, ref) => (
  <div
    ref={ref}
    className={cn('pt-0', className)}
    {...props}
  >
    {children}
  </div>
))

Card.displayName = 'Card'
CardHeader.displayName = 'CardHeader'
CardTitle.displayName = 'CardTitle'
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }
