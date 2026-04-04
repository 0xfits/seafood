import React from 'react'
import { cn } from '../../utils'

// variant → CSS class（来自 styles.css 的 .btn-* 系列，含切角与宝石光泽）
const variantClass = {
  primary:   'btn-primary',
  secondary: 'btn-proceed',  // secondary 语义等同 proceed（蓝色）
  proceed:   'btn-proceed',
  success:   'btn-success',
  warning:   'btn-warning',
  inactive:  'btn-inactive',
}

const sizeClass = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

const Button = React.forwardRef(({
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  ...props
}, ref) => {
  return (
    <button
      className={cn(
        'btn',
        variantClass[variant] ?? 'btn-primary',
        sizeClass[size] ?? sizeClass.md,
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

export { Button }
