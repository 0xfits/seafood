import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RewardPage = () => {
  const { t } = useTranslation()
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [journey, setJourney] = useState(null)
  const [taskDetail, setTaskDetail] = useState(null)
  const [claiming, setClaiming] = useState(false)

  // 初始化用户
  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)) } catch {}
    }
  }, [])

  // 检查是否为旅程详情模式（通过查询参数）
  const params = new URLSearchParams(location.search)
  const q_jID = params.get('jID')
  const q_uID = params.get('uID')
  const isJourneyMode = !!q_jID

  // 加载旅程详情或奖励列表
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (isJourneyMode) {
          // 加载旅程详情
          const resp = await fetch(`/api/journey/${Number(q_jID)}`)
          const data = await resp.json()
          if (data.success && data.data) {
            setJourney(data.data)
            // 加载任务详情以获取积分
            const tResp = await fetch(`/api/task/${Number(data.data.tID)}`)
            const tData = await tResp.json()
            if (tData.success) setTaskDetail(tData.data)
          } else {
            toast.error(t('error') + ': ' + (data.error || '加载旅程失败'))
          }
        } else {
          // 奖励列表模式
          const response = await fetch('/api/gift/all')
          const data = await response.json()
          if (data.success) {
            setGifts(data.data)
          } else {
            toast.error(t('error') + ': ' + (data.error || '加载奖励失败'))
          }
        }
      } catch (error) {
        console.error('Error loading:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, isJourneyMode, q_jID])

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 构建带语言前缀的路径
  const buildPath = (path) => {
    const currentLang = getCurrentLang()
    if (currentLang === 'zh') {
      return path === '' ? '/' : `/${path}`
    }
    return `/${currentLang}/${path}`
  }

  const handleCancel = () => {
    navigate(buildPath('task'))
  }

  const handleClaim = async () => {
    if (!currentUser || !currentUser.token) {
      toast.error(t('error') + ': ' + '请先登录')
      return
    }
    setClaiming(true)
    try {
      const resp = await fetch(`/api/journey/claim/${Number(q_jID)}` , {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ uID: Number(q_uID || currentUser.uID) })
      })
      const data = await resp.json()
      if (resp.ok && data.success) {
        setJourney(data.data)
        const pts = (data.data && (data.data.reward_points || data.data.points_claimed)) || (taskDetail?.points || 0)
        toast.success(`成功领取 ${pts} points`)
      } else {
        toast.error(t('error') + ': ' + (data.error || '领取失败'))
      }
    } catch (e) {
      console.error('Claim error:', e)
      toast.error(t('error') + ': ' + e.message)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-64">
        <div className="flex flex-col items-center">
          <div className="loading-spinner mr-2"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {!isJourneyMode ? (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('rewardsList')}</h1>
          <p className="text-text-secondary">{t('welcome')}</p>
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Journey Detail</h1>
          <p className="text-text-secondary">jID: {q_jID} · uID: {q_uID || currentUser?.uID}</p>
        </div>
      )}
      
      {!isJourneyMode ? (
        gifts.length === 0 ? (
        <div className="card p-8 text-center">
          <p>{t('noData')}</p>
        </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gifts.map((gift) => (
            <div key={gift.gID} className="card p-6">
              <h3 className="text-xl font-bold mb-3">{gift.gift_name || gift.title}</h3>
              <p className="text-text-secondary mb-4">{gift.gift_description || gift.note}</p>
              <div className="flex justify-between items-center">
                <div className="text-sm text-text-muted">
                  {(gift.time_start ? new Date(gift.time_start).toLocaleDateString() : '-')}
                  {` - `}
                  {(gift.time_end ? new Date(gift.time_end).toLocaleDateString() : '-')}
                </div>
                <Link
                  to={buildPath('task')}
                  className="btn btn-proceed"
                >
                  {t('viewDetails')}
                </Link>
              </div>
            </div>
          ))}
        </div>
        )
      ) : (
        <div className="card p-6">
          {!journey ? (
            <p className="text-text-secondary">No Journey</p>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">Task ID: {journey.tID}</div>
              <div className="text-sm">User ID: {journey.uID}</div>
              <div className="text-sm">Created: {journey.time_created ? new Date(journey.time_created * 1000).toLocaleString() : '-'}</div>
              <div className="text-sm">Checked: {journey.time_checked ? new Date(journey.time_checked * 1000).toLocaleString() : '-'}</div>
              <div className="text-sm">Claimed: {journey.time_claimed ? new Date(journey.time_claimed * 1000).toLocaleString() : '-'}</div>
              <div className="text-sm">Points: {taskDetail?.points ?? 0}</div>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button className="btn btn-primary" onClick={handleClaim} disabled={claiming || (journey && journey.time_claimed)}>
              {claiming ? 'Claiming...' : (journey && journey.time_claimed ? 'Claimed' : '领取')}
            </button>
            <button className="btn btn-inactive" onClick={handleCancel}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RewardPage