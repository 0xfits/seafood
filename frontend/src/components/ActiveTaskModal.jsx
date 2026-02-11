import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const ActiveTaskModal = ({ open, onClose, task }) => {
  const { t } = useTranslation()
  const [infoInput, setInfoInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  // 重置表单
  React.useEffect(() => {
    if (open && task) {
      setInfoInput('')
    }
  }, [open, task])

  // 处理表单提交
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!task || !infoInput.trim()) return

    setSubmitting(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      const token = user?.token
      
      // 验证 token 格式
      if (!token) {
        toast.error('未找到登录凭证，请重新登录')
        navigate('/login')
        return
      }
      
      // JWT token 应该包含三个部分（header.payload.signature）
      const tokenParts = token.split('.')
      if (tokenParts.length !== 3) {
        console.error('Invalid token format:', token)
        toast.error('登录凭证格式错误，请重新登录')
        localStorage.removeItem('user')
        navigate('/login')
        return
      }
      
      console.log('Sending request with token:', token.substring(0, 50) + '...')
      
      const response = await fetch(`/api/journey/${task.jID || task.tID}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          info_input: infoInput.trim()
        })
      })

      if (response.status === 401) {
        // Token 过期或无效，需要重新登录
        toast.error(t('sessionExpired') || '登录已过期，请重新登录')
        localStorage.removeItem('user')
        navigate('/login')
        return
      }
      
      const data = await response.json()
      if (data.success) {
        toast.success(t('successSubmitTask'))
        onClose()
        // 重定向到任务页面并滚动到待验证部分
        navigate(`/task#pending-verification`)
      } else {
        toast.error(t('error') + ': ' + (data.message || '提交任务失败'))
      }
    } catch (error) {
      console.error('Error submitting task:', error)
      toast.error(t('error') + ': ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 如果模态框关闭或没有任务，不显示
  if (!open || !task) return null

  return (
    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="modal-container bg-white dark:bg-bg-dark rounded-lg shadow-xl w-full max-w-md">
        <div className="modal-header p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-bold">{t('completeTask')}</h3>
          <button 
            className="modal-close text-text-muted hover:text-text-primary transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body p-6">
          <h4 className="text-lg font-medium mb-4">{task.title}</h4>
          <p className="text-text-secondary mb-6">{task.note}</p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="infoInput" className="block text-sm font-medium mb-2">
                {t('submitInfo')}
              </label>
              <textarea
                id="infoInput"
                value={infoInput}
                onChange={(e) => setInfoInput(e.target.value)}
                placeholder={t('enterTaskInfo')}
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                rows={6}
                required
              />
            </div>
            
            {task.linkA && (
              <div className="mb-6">
                <p className="text-sm text-text-secondary mb-2">{t('taskLink')}:</p>
                <a 
                  href={task.linkA} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline text-sm inline-flex items-center"
                >
                  {task.linkA}
                  <span className="ml-1">↗</span>
                </a>
              </div>
            )}
            
            <div className="flex justify-end space-x-4">
              <button 
                type="button"
                className="btn btn-inactive"
                onClick={onClose}
                disabled={submitting}
              >
                {t('cancel')}
              </button>
              <button 
                type="submit"
                className="btn btn-proceed"
                disabled={submitting || !infoInput.trim()}
              >
                {submitting ? (
                  <span className="flex items-center">
                    <div className="loading-spinner mr-2 h-4 w-4"></div>
                    {t('submitting')}
                  </span>
                ) : (
                  t('submitInfo')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ActiveTaskModal