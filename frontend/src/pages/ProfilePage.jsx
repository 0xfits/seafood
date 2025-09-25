import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

const ProfilePage = () => {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [taskStats, setTaskStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0
  })
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState('')

  // 加载用户信息和任务统计
  useEffect(() => {
    const loadUserInfo = async () => {
      setLoading(true)
      try {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)
          // 加载用户任务统计
          await loadTaskStats(parsedUser.uID)
          // 加载用户简介
          // 这里假设bio存储在localStorage中，实际应用中应该从API获取
          const storedBio = localStorage.getItem(`user_${parsedUser.uID}_bio`)
          if (storedBio) {
            setBio(storedBio)
          }
        } else {
          toast.error(t('pleaseLogin'))
        }
      } catch (error) {
        console.error('Error loading user info:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }

    loadUserInfo()
  }, [t])

  // 加载任务统计
  const loadTaskStats = async (uID) => {
    try {
      const response = await fetch(`/api/tasklist/user/${uID}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      })
      const data = await response.json()
      if (data.success) {
        const stats = {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0
        }
        
        // 计算总任务数
        if (data.data.pendingVerification) {
          stats.pendingTasks += data.data.pendingVerification.length
          stats.totalTasks += data.data.pendingVerification.length
        }
        if (data.data.pendingRewards) {
          stats.pendingTasks += data.data.pendingRewards.length
          stats.totalTasks += data.data.pendingRewards.length
        }
        if (data.data.pendingTasks) {
          stats.pendingTasks += data.data.pendingTasks.length
          stats.totalTasks += data.data.pendingTasks.length
        }
        if (data.data.completedTasks) {
          stats.completedTasks += data.data.completedTasks.length
          stats.totalTasks += data.data.completedTasks.length
        }
        
        setTaskStats(stats)
      }
    } catch (error) {
      console.error('Error loading task stats:', error)
      // 静默失败，使用默认统计
    }
  }

  // 保存用户简介
  const handleSaveBio = () => {
    if (user) {
      localStorage.setItem(`user_${user.uID}_bio`, bio)
      setIsEditing(false)
      toast.success(t('profileUpdated'))
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card p-6 text-center">
          <p>{t('pleaseLogin')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('profile')}</h1>
        <p className="text-text-secondary">{t('yourInformation')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 用户信息卡片 */}
        <div className="md:col-span-2">
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">{t('userInfo')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('evmAddress')}
                </label>
                <div className="bg-bg-muted p-3 rounded-lg font-mono text-sm break-all">
                  {user.EVM}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('userID')}
                </label>
                <div className="bg-bg-muted p-3 rounded-lg text-sm">
                  {user.uID}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('bio')}
                  </label>
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="text-primary hover:underline text-sm"
                    >
                      {t('edit')}
                    </button>
                  ) : (
                    <button 
                      onClick={handleSaveBio}
                      className="text-success hover:underline text-sm"
                    >
                      {t('save')}
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('enterBio')}
                    className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                    rows={4}
                  />
                ) : (
                  <div className="bg-bg-muted p-3 rounded-lg text-sm">
                    {bio || t('noBio')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 任务统计卡片 */}
        <div>
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">{t('taskStats')}</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-bg-muted rounded-lg">
                <span className="text-text-secondary">{t('totalTasks')}</span>
                <span className="font-medium">{taskStats.totalTasks}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-bg-muted rounded-lg">
                <span className="text-text-secondary">{t('completedTasks')}</span>
                <span className="font-medium text-success">{taskStats.completedTasks}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-bg-muted rounded-lg">
                <span className="text-text-secondary">{t('pendingTasks')}</span>
                <span className="font-medium text-warning">{taskStats.pendingTasks}</span>
              </div>
            </div>
          </div>

          {/* 快速链接 */}
          <div className="card p-6 mt-6">
            <h2 className="text-xl font-bold mb-4">{t('quickLinks')}</h2>
            
            <div className="space-y-2">
              <a 
                href="/task" 
                className="block p-3 bg-bg-muted rounded-lg hover:bg-bg-hover transition-colors"
              >
                {t('myTasks')}
              </a>
              
              <a 
                href="/reward" 
                className="block p-3 bg-bg-muted rounded-lg hover:bg-bg-hover transition-colors"
              >
                {t('availableRewards')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage