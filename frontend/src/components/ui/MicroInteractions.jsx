import React, { useState, useEffect } from 'react'
import { cn } from '../../utils'

// 悬浮卡片效果
const HoverCard = ({ children, className, scale = 1.05, shadow = true }) => {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div
      className={cn(
        'transition-all duration-300 ease-out',
        'transform cursor-pointer',
        shadow && 'hover:shadow-xl',
        isHovered && `scale-${scale}`,
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  )
}

// 点击涟漪效果
const RippleButton = ({ children, onClick, className, ...props }) => {
  const [ripples, setRipples] = useState([])
  
  const createRipple = (e) => {
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    
    const newRipple = {
      id: Date.now(),
      x,
      y,
      size
    }
    
    setRipples(prev => [...prev, newRipple])
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id))
    }, 600)
  }
  
  const handleClick = (e) => {
    createRipple(e)
    onClick?.(e)
  }
  
  return (
    <button
      className={cn(
        'relative overflow-hidden',
        'transition-all duration-200',
        'active:scale-95',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white bg-opacity-30 rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            transform: 'scale(0)',
            animation: 'ripple 0.6s ease-out'
          }}
        />
      ))}
    </button>
  )
}

// 磁性吸附按钮
const MagneticButton = ({ children, className, strength = 0.3, ...props }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const buttonRef = React.useRef(null)
  
  const handleMouseMove = (e) => {
    if (!buttonRef.current) return
    
    const rect = buttonRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const deltaX = (e.clientX - centerX) * strength
    const deltaY = (e.clientY - centerY) * strength
    
    setPosition({ x: deltaX, y: deltaY })
  }
  
  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }
  
  return (
    <button
      ref={buttonRef}
      className={cn(
        'transition-transform duration-200 ease-out',
        className
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  )
}

// 打字机效果
const Typewriter = ({ 
  text, 
  speed = 100, 
  delay = 0,
  className,
  onComplete 
}) => {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      } else {
        onComplete?.()
      }
    }, speed)
    
    return () => clearTimeout(timer)
  }, [currentIndex, text, speed, onComplete, delay])
  
  return (
    <span className={cn(className)}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  )
}

// 数字计数动画
const Counter = ({ 
  end, 
  start = 0, 
  duration = 2000, 
  suffix = '',
  prefix = '',
  className 
}) => {
  const [count, setCount] = useState(start)
  
  useEffect(() => {
    const startTime = Date.now()
    const endTime = startTime + duration
    
    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      
      // 使用缓动函数
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentCount = Math.floor(start + (end - start) * easeOutQuart)
      
      setCount(currentCount)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [start, end, duration])
  
  return (
    <span className={cn(className)}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  )
}

// 渐变文字效果
const GradientText = ({ 
  children, 
  gradient = 'from-yellow-400 to-yellow-600',
  className 
}) => (
  <span className={cn(
    'bg-gradient-to-r bg-clip-text text-transparent',
    gradient,
    className
  )}>
    {children}
  </span>
)

// 发光边框效果
const GlowingBorder = ({ 
  children, 
  color = 'yellow',
  intensity = 'medium',
  className 
}) => {
  const intensityClasses = {
    low: 'shadow-sm',
    medium: 'shadow-lg',
    high: 'shadow-2xl'
  }
  
  const colorClasses = {
    yellow: 'shadow-yellow-500/50',
    blue: 'shadow-blue-500/50',
    green: 'shadow-green-500/50',
    red: 'shadow-red-500/50',
    purple: 'shadow-purple-500/50'
  }
  
  return (
    <div className={cn(
      'rounded-xl',
      'transition-all duration-300',
      'hover:shadow-xl',
      intensityClasses[intensity],
      colorClasses[color],
      className
    )}>
      {children}
    </div>
  )
}

// 视差滚动效果
const Parallax = ({ 
  children, 
  speed = 0.5, 
  offset = 0,
  className 
}) => {
  const [scrollY, setScrollY] = useState(0)
  
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  const transform = `translateY(${scrollY * speed + offset}px)`
  
  return (
    <div
      className={cn('will-change-transform', className)}
      style={{ transform }}
    >
      {children}
    </div>
  )
}

// 滚动显示动画
const RevealOnScroll = ({ 
  children, 
  direction = 'up',
  delay = 0,
  className 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = React.useRef(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1 }
    )
    
    if (elementRef.current) {
      observer.observe(elementRef.current)
    }
    
    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
    }
  }, [])
  
  const directionClasses = {
    up: 'translate-y-8 opacity-0',
    down: '-translate-y-8 opacity-0',
    left: 'translate-x-8 opacity-0',
    right: '-translate-x-8 opacity-0'
  }
  
  return (
    <div
      ref={elementRef}
      className={cn(
        'transition-all duration-700 ease-out',
        directionClasses[direction],
        isVisible && 'translate-x-0 translate-y-0 opacity-100',
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// 添加全局动画样式
const GlobalAnimations = () => (
  <style jsx>{`
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `}</style>
)

export {
  HoverCard,
  RippleButton,
  MagneticButton,
  Typewriter,
  Counter,
  GradientText,
  GlowingBorder,
  Parallax,
  RevealOnScroll,
  GlobalAnimations
}
