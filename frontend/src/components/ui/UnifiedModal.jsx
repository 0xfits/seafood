import React, { createContext, useContext, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '../../utils'

// 模态框类型
const MODAL_TYPES = {
  INFO: 'info',
  SUCCESS: 'success', 
  WARNING: 'warning',
  ERROR: 'error',
  DEFAULT: 'default'
}

// 统一的模态框上下文
const ModalContext = createContext({
  isOpen: false,
  onClose: () => {},
  type: MODAL_TYPES.DEFAULT,
  title: '',
  message: ''
})

const UnifiedModal = ({ 
  isOpen, 
  onClose, 
  children, 
  type = MODAL_TYPES.DEFAULT,
  title,
  size = 'md',
  closeOnOverlay = true,
  showCloseButton = true,
  className,
  showIcon = true
}) => {
  const modalRef = useRef(null)
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose()
    }
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  }

  const typeConfig = {
    [MODAL_TYPES.INFO]: {
      icon: Info,
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50',
      titleColor: 'text-blue-900'
    },
    [MODAL_TYPES.SUCCESS]: {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      borderColor: 'border-green-200',
      bgColor: 'bg-green-50',
      titleColor: 'text-green-900'
    },
    [MODAL_TYPES.WARNING]: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      borderColor: 'border-yellow-200',
      bgColor: 'bg-yellow-50',
      titleColor: 'text-yellow-900'
    },
    [MODAL_TYPES.ERROR]: {
      icon: AlertCircle,
      iconColor: 'text-red-500',
      borderColor: 'border-red-200',
      bgColor: 'bg-red-50',
      titleColor: 'text-red-900'
    },
    [MODAL_TYPES.DEFAULT]: {
      icon: null,
      iconColor: 'text-gray-500',
      borderColor: 'border-gray-200',
      bgColor: 'bg-white',
      titleColor: 'text-gray-900'
    }
  }

  const config = typeConfig[type] || typeConfig[MODAL_TYPES.DEFAULT]
  const IconComponent = config.icon

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleOverlayClick}
      />
      
      {/* 模态框内容 */}
      <div 
        ref={modalRef}
        className={cn(
          'relative w-full rounded-2xl shadow-2xl border transition-all',
          'bg-white dark:bg-gray-800',
          'transform scale-100 opacity-100',
          sizeClasses[size],
          config.borderColor,
          className
        )}
      >
        {/* 模态框头部 */}
        {(title || showCloseButton) && (
          <div className={cn(
            'flex items-center justify-between p-6 border-b',
            config.bgColor,
            'dark:border-gray-700'
          )}>
            <div className="flex items-center gap-3">
              {showIcon && IconComponent && (
                <IconComponent className={cn('w-5 h-5', config.iconColor)} />
              )}
              {title && (
                <h3 className={cn('text-lg font-semibold', config.titleColor, 'dark:text-white')}>
                  {title}
                </h3>
              )}
            </div>
            
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        
        {/* 模态框内容 */}
        <div className="p-6">
          <ModalContext.Provider value={{ isOpen, onClose, type, title, message: '' }}>
            {children}
          </ModalContext.Provider>
        </div>
      </div>
    </div>,
    document.body
  )
}

// 模态框头部组件
export const ModalHeader = ({ children, className }) => {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  )
}

// 模态框内容组件
export const ModalContent = ({ children, className }) => {
  return (
    <div className={cn('text-gray-700 dark:text-gray-300', className)}>
      {children}
    </div>
  )
}

// 模态框底部组件
export const ModalFooter = ({ children, className }) => {
  return (
    <div className={cn(
      'flex items-center justify-end gap-3 mt-6 pt-4 border-t',
      'border-gray-200 dark:border-gray-700',
      className
    )}>
      {children}
    </div>
  )
}

// 使用模态框上下文的Hook
export const useModal = () => {
  return useContext(ModalContext)
}

// 导出类型常量
export { MODAL_TYPES }

export default UnifiedModal
