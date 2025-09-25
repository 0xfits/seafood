import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

const ChooseRewardModal = ({ open, onClose, task }) => {
  const { t } = useTranslation()
  const [availableRewards, setAvailableRewards] = useState([])
  const [loading, setLoading] = useState(false)

  // 加载可用奖励
  useEffect(() => {
    if (open && task) {
      loadAvailableRewards()
    }
  }, [open, task])

  const loadAvailableRewards = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/gifts/all')
      const data = await response.json()
      if (data.success) {
        setAvailableRewards(data.data || [])
      } else {
        toast.error(t('error') + ': ' + (data.error || '加载奖励失败'))
      }
    } catch (error) {
      console.error('Error loading rewards:', error)
      toast.error(t('error') + ': ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 确认选择奖励
  const confirmReward = async (reward) => {
    if (!task) return

    const isConfirmed = window.confirm(t('confirmChooseReward') + ': ' + reward.title)
    if (!isConfirmed) return

    try {
      const user = JSON.parse(localStorage.getItem('user'))
      const response = await fetch(`/api/tasklist/${task.tlistID}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          gID: reward.gID
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(t('successClaimReward') + ': ' + reward.title)
        onClose()
        // 刷新父组件的数据
        window.location.reload()
      } else {
        toast.error(t('error') + ': ' + (data.error || '领取奖励失败'))
      }
    } catch (error) {
      console.error('Error claiming reward:', error)
      toast.error(t('error') + ': ' + error.message)
    }
  }

  // 如果模态框关闭或没有任务，不显示
  if (!open || !task) return null

  return (
    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="modal-container bg-white dark:bg-bg-dark rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="modal-header p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-bold">{t('chooseReward')}</h3>
          <button 
            className="modal-close text-text-muted hover:text-text-primary transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body p-6">
          <h4 className="text-lg font-medium mb-4">{t('task')}: {task.title}</h4>
          <p className="text-text-secondary mb-6">{task.note}</p>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="loading-spinner mr-2"></div>
              <p>{t('loading')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableRewards.length === 0 ? (
                <div className="col-span-full p-6 text-center">
                  <p>{t('noRewardsAvailable')}</p>
                </div>
              ) : (
                availableRewards.map((reward) => (
                  <div 
                    key={reward.gID} 
                    className="reward-card p-4 border border-border rounded-lg cursor-pointer hover:bg-bg-muted transition-colors"
                    onClick={() => confirmReward(reward)}
                  >
                    <div className="reward-image h-32 bg-bg-muted rounded-md mb-4 flex items-center justify-center">
                      {/* 图片占位 */}
                      <span className="text-text-secondary">📦</span>
                    </div>
                    <h5 className="font-medium mb-2">{reward.title}</h5>
                    <p className="text-text-secondary text-sm mb-2">{reward.note}</p>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>{t('validFrom')}: {new Date(reward.time_start).toLocaleDateString()}</span>
                      <span>{t('validTo')}: {new Date(reward.time_end).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer p-6 border-t border-border flex justify-end">
          <button 
            className="btn btn-secondary mr-4"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChooseRewardModal