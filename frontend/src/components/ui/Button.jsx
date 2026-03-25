import React from 'react'
import { cn } from '../../utils'

const buttonVariants = {
  variant: {
    primary: 'bg-yellow-400 text-black hover:bg-yellow-300 border-yellow-400',
    secondary: 'bg-blue-600 text-white hover:bg-blue-500 border-blue-600',
    proceed: 'bg-blue-500 text-white hover:bg-blue-400 border-blue-500',
    success: 'bg-green-500 text-white hover:bg-green-400 border-green-500',
    warning: 'bg-red-500 text-white hover:bg-red-400 border-red-500',
    inactive: 'bg-gray-300 text-gray-600 cursor-not-allowed border-gray-300'
  },
  size: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
}

const Button = React.forwardRef(({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  children, 
  ...props 
}, ref) => {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'border-2',
    'transition-all',
    'duration-200',
    'transform',
    'hover:scale-105',
    'active:scale-95',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2'
  ]

  const variantClasses = buttonVariants.variant[variant]
  const sizeClasses = buttonVariants.size[size]

  return (
    <button
      className={cn(
        ...baseClasses,
        variantClasses,
        sizeClasses,
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
        className
      )}
      ref={ref}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export { Button, buttonVariants }
