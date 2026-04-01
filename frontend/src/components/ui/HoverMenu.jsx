import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../../utils'
import './HoverMenu.css'

const HoverMenu = ({ 
  trigger, 
  children, 
  className,
  position = 'bottom-right',
  delay = 100
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef(null)
  const menuRef = useRef(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 50)
  }

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const positionClasses = {
    'bottom-right': 'top-full left-0 mt-2',
    'bottom-left': 'top-full right-0 mt-2',
    'top-right': 'bottom-full left-0 mb-2',
    'top-left': 'bottom-full right-0 mb-2'
  }

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {trigger}
      
      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-48',
            positionClasses[position],
            className
          )}
          onMouseEnter={() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
            }
            setIsOpen(true)
          }}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default HoverMenu
