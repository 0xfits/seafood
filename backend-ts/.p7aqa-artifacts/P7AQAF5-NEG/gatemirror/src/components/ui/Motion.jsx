import React from 'react'
import { cn } from '../../utils'

const FadeIn = ({ 
  children, 
  delay = 0,
  duration = 300,
  className 
}) => {
  return (
    <div
      className={cn(
        'animate-fade-in',
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  )
}

const SlideUp = ({ 
  children, 
  delay = 0,
  duration = 400,
  className 
}) => {
  return (
    <div
      className={cn(
        'animate-slide-up',
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  )
}

const ScaleIn = ({ 
  children, 
  delay = 0,
  duration = 200,
  className 
}) => {
  return (
    <div
      className={cn(
        'animate-scale-in',
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  )
}

const StaggerContainer = ({ 
  children, 
  staggerDelay = 100,
  className 
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {React.Children.map(children, (child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  )
}

export { FadeIn, SlideUp, ScaleIn, StaggerContainer }
