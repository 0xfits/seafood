import React, { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '../../utils'

const ToastContext = createContext({
  toast: () => {}
})

const toastVariants = {
  success: {
    icon: CheckCircle,
    className: 'bg-green-50 border-green-200 text-green-800'
  },
  error: {
    icon: XCircle,
    className: 'bg-red-50 border-red-200 text-red-800'
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  },
  info: {
    icon: Info,
    className: 'bg-blue-50 border-blue-200 text-blue-800'
  }
}

const ToastItem = ({ toast, onRemove }) => {
  const { icon: Icon, className } = toastVariants[toast.type] || toastVariants.info
  
  React.useEffect(() => {
    if (toast.duration !== Infinity) {
      const timer = setTimeout(() => {
        onRemove(toast.id)
      }, toast.duration || 5000)
      
      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onRemove])

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg border shadow-lg',
        'transform transition-all duration-300 ease-in-out',
        'max-w-md w-full',
        className,
        toast.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{toast.title}</p>
        {toast.description && (
          <p className="text-sm opacity-90 mt-1">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

const ToastContainer = () => {
  const { toasts, removeToast } = useToast()
  
  if (toasts.length === 0) return null
  
  return createPortal(
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>,
    document.body
  )
}

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  
  const toast = useCallback(({ type = 'info', title, description, duration = 5000 }) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      type,
      title,
      description,
      duration,
      visible: false
    }
    
    setToasts(prev => [...prev, newToast])
    
    // 触发动画
    setTimeout(() => {
      setToasts(prev => 
        prev.map(t => t.id === id ? { ...t, visible: true } : t)
      )
    }, 50)
  }, [])
  
  const removeToast = useCallback((id) => {
    setToasts(prev => 
      prev.map(t => t.id === id ? { ...t, visible: false } : t)
    )
    
    // 等待动画完成后移除
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])
  
  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// 便捷方法
export const toast = {
  success: (title, description, duration) => {
    const { toast } = useToast()
    return toast({ type: 'success', title, description, duration })
  },
  error: (title, description, duration) => {
    const { toast } = useToast()
    return toast({ type: 'error', title, description, duration })
  },
  warning: (title, description, duration) => {
    const { toast } = useToast()
    return toast({ type: 'warning', title, description, duration })
  },
  info: (title, description, duration) => {
    const { toast } = useToast()
    return toast({ type: 'info', title, description, duration })
  }
}

export { ToastProvider, useToast, ToastContainer }
