import React, { createContext, useContext, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils'

const ModalContext = createContext({
  isOpen: false,
  onClose: () => {}
})

const Modal = ({ 
  isOpen, 
  onClose, 
  children, 
  size = 'md',
  closeOnOverlay = true,
  showCloseButton = true,
  className 
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

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleOverlayClick}
      />
      
      {/* 模态框内容 */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative bg-white rounded-xl shadow-2xl transform transition-all duration-300',
          'max-h-[90vh] overflow-y-auto',
          sizeClasses[size],
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          className
        )}
      >
        {/* 关闭按钮 */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        {/* 内容 */}
        <div className="p-6">
          <ModalContext.Provider value={{ isOpen, onClose }}>
            {children}
          </ModalContext.Provider>
        </div>
      </div>
    </div>,
    document.body
  )
}

const ModalHeader = ({ children, className }) => (
  <div className={cn('mb-4', className)}>
    {children}
  </div>
)

const ModalTitle = ({ children, className }) => (
  <h2 className={cn('text-xl font-semibold text-gray-900', className)}>
    {children}
  </h2>
)

const ModalContent = ({ children, className }) => (
  <div className={cn('text-gray-600', className)}>
    {children}
  </div>
)

const ModalFooter = ({ children, className }) => (
  <div className={cn('mt-6 flex justify-end gap-3', className)}>
    {children}
  </div>
)

export { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter }
