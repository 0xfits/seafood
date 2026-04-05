import React from 'react'
import { cn } from '../../utils'

// variant → CSS class（来自 styles.css 的 .btn-* 系列，含切角与宝石光泽）
const variantClass = {
  primary:   'btn-primary bg-yellow-500 text-white',
  secondary: 'btn-proceed bg-blue-500 text-white',  // secondary 语义等同 proceed（蓝色）
  proceed:   'btn-proceed bg-blue-500 text-white',
  success:   'btn-success bg-green-500 text-white',
  warning:   'btn-warning bg-red-500 text-white',
  inactive:  'btn-inactive bg-gray-400 text-white',
  outline:   'btn-outline bg-white border border-blue-600 text-blue-600',
  ghost:     'btn-ghost text-gray-600',
  info:      'btn-info bg-blue-600 text-white',
}

const sizeClass = {
  sm: 'btn-sm px-3 py-1.5 text-sm',
  md: 'btn-md px-4 py-2 text-base',
  lg: 'btn-lg px-8 py-3 text-lg',
}

const Button = React.forwardRef(({
  as: Component = 'button',
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  ...props
}, ref) => {
  return (
    <Component
      className={cn(
        'btn',
        variantClass[variant] ?? 'btn-primary',
        sizeClass[size] ?? sizeClass.md,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      ref={ref}
      disabled={Component === 'button' ? disabled : undefined}
      aria-disabled={disabled || undefined}
      {...props}
    >
      {children}
    </Component>
  )
})

Button.displayName = 'Button'

export { Button }
