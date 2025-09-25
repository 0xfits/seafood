import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

const RewardPage = () => {
  const { t } = useTranslation()
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  // 加载奖励数据
  useEffect(() => {
    const loadGifts = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/gifts/all')
        const data = await response.json()
        if (data.success) {
          setGifts(data.data)
        } else {
          toast.error(t('error') + ': ' + (data.error || '加载奖励失败'))
        }
      } catch (error) {
        console.error('Error loading gifts:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadGifts()
  }, [t])

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('rewardsList')}</h1>
        <p className="text-text-secondary">{t('welcome')}</p>
      </div>
      
      {gifts.length === 0 ? (
        <div className="card p-8 text-center">
          <p>{t('noData')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gifts.map((gift) => (
            <div key={gift.gID} className="card p-6">
              <h3 className="text-xl font-bold mb-3">{gift.title}</h3>
              <p className="text-text-secondary mb-4">{gift.note}</p>
              <div className="flex justify-between items-center">
                <div className="text-sm text-text-muted">
                  {new Date(gift.time_start).toLocaleDateString()} - {new Date(gift.time_end).toLocaleDateString()}
                </div>
                <Link
                  to={buildPath('task')}
                  className="btn btn-primary"
                >
                  {t('viewDetails')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RewardPage