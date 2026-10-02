import React from 'react'
import { cn } from '../../utils'

const Container = React.forwardRef(({ 
  className, 
  children, 
  size = 'default',
  ...props 
}, ref) => {
  const sizeClasses = {
    sm: 'max-w-4xl',
    default: 'max-w-6xl',
    lg: 'max-w-7xl',
    xl: 'max-w-full px-4'
  }

  return (
    <div
      ref={ref}
      className={cn(
        'mx-auto w-full',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Container.displayName = 'Container'

export { Container }
