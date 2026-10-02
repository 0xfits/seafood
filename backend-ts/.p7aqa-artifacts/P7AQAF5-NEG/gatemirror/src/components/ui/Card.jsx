import React from 'react'
import { cn } from '../../utils'

// P6-UI-CONSIST-B（成套形状收敛，变体 B）：卡片基础件形状收敛到按钮口径 —— 去静置阴影（扁平）、
// 描边 2px→1px（.border = --sf-st-stroke-w-thin）、圆角 12px→8px（.rounded-lg = 0.5rem = --sf-st-radius-btna）。
// 色板类（bg-*/border-*-200）与既有交互反馈类（hover:shadow-lg / transition-shadow）一字未动。
const cardVariants = {
  variant: {
    default: 'bg-white border-gray-200',
    primary: 'bg-yellow-50 border-yellow-200',
    secondary: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-red-50 border-red-200',
    inactive: 'bg-gray-50 border-gray-200'
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
    'rounded-lg',
    'border',
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
