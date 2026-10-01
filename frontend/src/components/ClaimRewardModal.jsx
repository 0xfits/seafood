import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

const ClaimRewardModal = ({ open, isOpen, onClose, task }) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [taskProgress, setTaskProgress] = useState(null)
  const visible = typeof open === 'boolean' ? open : Boolean(isOpen)

  useEffect(() => {
    if (visible && task && (task.tlistID || task.jID)) {
      loadTaskProgressDetail(task.jID || task.tlistID)
    }
  }, [visible, task])

  const loadTaskProgressDetail = async (jID) => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/task-progress/${jID}`)
      const data = await resp.json()
      if (data && data.success) {
        setTaskProgress(data.data || null)
      } else {
        toast.error(t('error') + ': ' + ((data && (data.error || data.message)) || '加载任务进度失败'))
      }
    } catch (error) {
      toast.error(t('error') + ': ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // P6-B5-CLAIM（批 5 = sunset）：`POST /api/task-progress/claim/:jID` 已退役（后端恒 `410` + `details.reason='CLAIM_RETIRED'`）。
  // ⇒ 前端**零调用**该端点（判据 = §9.B「弃用面前端零调用」；与 `shard/redeem` / `chest` 同先例）。
  // 处置 = **删调用 + 就地显示「已下线」**（不整页删）；奖励/积分发放唯一路径 = A1 管理员调分（已接账本 `mint`/`burn`）。

  if (!visible || !task) return null

  const displayTitle = task.title || (taskProgress && taskProgress.title) || ''
  const displayNote = task.note || (taskProgress && taskProgress.note) || ''
  const infoInput = taskProgress && taskProgress.info_input
  const uid = (taskProgress && taskProgress.uID) || (task && task.uID)
  const tid = (taskProgress && taskProgress.tID) || (task && task.tID)
  const points = typeof task?.points === 'number' ? task.points : (task?.points ? Number(task.points) : undefined)

  return (
    <div className="modal-overlay modal-overlay--dim fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-container claim-modal aqua-bg rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-bold">{t('claimReward') || '领取奖励'}</h3>
          <button className="modal-close text-text-muted hover:text-text-primary transition-colors" onClick={onClose}>✕</button>
        </div>
        <div className="p-6">
          <div className="text-sm text-text-muted">jID: {(task && (task.jID || task.tlistID)) || (taskProgress && taskProgress.jID)}</div>
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
          <div className="mr-auto self-center text-sm text-text-secondary">{t('claimRetiredNotice')}</div>
          <button className="btn btn-inactive" onClick={onClose}>{t('cancel') || '取消'}</button>
        </div>
      </div>
    </div>
  )
}

export default ClaimRewardModal
