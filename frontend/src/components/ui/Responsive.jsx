import React, { useState, useEffect } from 'react'
import { cn } from '../../utils'

const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState('lg')

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width < 640) setBreakpoint('sm')
      else if (width < 768) setBreakpoint('md')
      else if (width < 1024) setBreakpoint('lg')
      else if (width < 1280) setBreakpoint('xl')
      else setBreakpoint('2xl')
    }

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  return breakpoint
}

const ResponsiveGrid = ({ 
  children, 
  className,
  sm = 1,
  md = 2,
  lg = 3,
  xl = 4,
  gap = 6 
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6'
  }

  const gapClasses = {
    2: 'gap-2',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  }

  return (
    <div
      className={cn(
        'grid',
        gridClasses[sm],
        md >= 2 && `md:${gridClasses[md]}`,
        lg >= 3 && `lg:${gridClasses[lg]}`,
        xl >= 4 && `xl:${gridClasses[xl]}`,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  )
}

const ResponsiveContainer = ({ 
  children, 
  className,
  padding = true 
}) => {
  return (
    <div
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8',
        padding && 'py-4 sm:py-6 lg:py-8',
        className
      )}
    >
      {children}
    </div>
  )
}

const ResponsiveText = ({ 
  children,
  className,
  sm = 'base',
  md = 'lg',
  lg = 'xl' 
}) => {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl'
  }

  return (
    <span
      className={cn(
        sizeClasses[sm],
        md !== sm && `md:${sizeClasses[md]}`,
        lg !== md && `lg:${sizeClasses[lg]}`,
        className
      )}
    >
      {children}
    </span>
  )
}

const MobileMenu = ({ 
  children, 
  isOpen, 
  onClose,
  className 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <>
      {/* 背景遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* 移动端菜单 */}
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <div className="p-4">
          {children}
        </div>
      </div>
    </>
  )
}

export {
  useBreakpoint,
  ResponsiveGrid,
  ResponsiveContainer,
  ResponsiveText,
  MobileMenu
}
