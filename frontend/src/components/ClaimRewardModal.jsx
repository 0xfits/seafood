import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

const ClaimRewardModal = ({ open, onClose, task }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [journey, setJourney] = useState(null)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (open && task && (task.tlistID || task.jID)) {
      loadJourneyDetail(task.jID || task.tlistID)
    }
  }, [open, task])

  const loadJourneyDetail = async (jID) => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/journey/${jID}`)
      const data = await resp.json()
      if (data && data.success) {
        setJourney(data.data || null)
      } else {
        toast.error(t('error') + ': ' + ((data && (data.error || data.message)) || '加载任务进度失败'))
      }
    } catch (error) {
      toast.error(t('error') + ': ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async () => {
    const jID = (task && (task.jID || task.tlistID)) || (journey && journey.jID)
    if (!jID) return
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      if (!user?.token) {
        toast.error(t('pleaseLogin') || '请先登录')
        navigate('/login', { state: { from: location } })
        return
      }
      const resp = await fetch(`/api/journey/claim/${jID}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      const data = await resp.json()
      if (data && data.success) {
        const pts = (data.data && (data.data.reward_points ?? data.data.points_claimed)) || (task && task.points) || 0
        setCelebrate(true)
        toast.success(`${t('success')}: 成功领取 ${pts} points`)
        setTimeout(() => {
          onClose()
          window.location.reload()
        }, 800)
      } else {
        if (resp.status === 401) {
          toast.error(t('pleaseLogin') || '请先登录')
          navigate('/login', { state: { from: location } })
        } else {
          toast.error(t('error') + ': ' + ((data && (data.error || data.message)) || '领取失败'))
        }
      }
    } catch (error) {
      toast.error(t('error') + ': ' + error.message)
    }
  }

  if (!open || !task) return null

  const displayTitle = task.title || (journey && journey.title) || ''
  const displayNote = task.note || (journey && journey.note) || ''
  const infoInput = journey && journey.info_input
  const uid = (journey && journey.uID) || (task && task.uID)
  const tid = (journey && journey.tID) || (task && task.tID)
  const points = typeof task?.points === 'number' ? task.points : (task?.points ? Number(task.points) : undefined)

  return (
    <div className="modal-overlay modal-overlay--dim fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-container claim-modal aqua-bg rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-bold">{t('claimReward') || '领取奖励'}</h3>
          <button className="modal-close text-text-muted hover:text-text-primary transition-colors" onClick={onClose}>✕</button>
        </div>
        <div className="p-6">
          <div className="text-sm text-text-muted">jID: {(task && (task.jID || task.tlistID)) || (journey && journey.jID)}</div>
          {uid && <div className="text-sm text-text-muted">uID: {uid}</div>}
          {tid && <div className="text-sm text-text-muted">tID: {tid}</div>}
          <h4 className="text-lg font-medium mt-2 mb-2">{displayTitle}</h4>
          {displayNote && <p className="text-text-secondary mb-4">{displayNote}</p>}
          {typeof points !== 'undefined' && (
            <div className="mb-4 text-sm">
              <span className="font-semibold">+{points}</span> points
            </div>
          )}
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="loading-spinner mr-2"></div>
              <p>{t('loading')}</p>
            </div>
          ) : (
            infoInput ? (
              <div className="bg-bg-muted p-4 rounded">
                <div className="text-sm">{t('info_input')}: {infoInput}</div>
              </div>
            ) : null
          )}
          <div className="text-sm text-text-secondary mt-4">在水域的奇遇中收集宝石，完成探索后领取奖励。</div>
        </div>
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button className="btn btn-primary gem-pulse" onClick={handleClaim}>{t('claimReward') || '领取'}</button>
          <button className="btn btn-inactive" onClick={onClose}>{t('cancel') || '取消'}</button>
        </div>
        {celebrate && (
          <div className="celebrate-burst">
            <div className="burst-circle"></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClaimRewardModal
