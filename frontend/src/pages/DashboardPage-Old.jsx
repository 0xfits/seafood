import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

const DashboardPage = () => {
  const { t } = useTranslation()
  const [pendingVerificationTasks, setPendingVerificationTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // 加载数据和验证管理员身份
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // 加载用户信息
        const user = localStorage.getItem('user')
        if (!user) {
          toast.error(t('pleaseLogin'))
          setLoading(false)
          return
        }

        const parsedUser = JSON.parse(user)
        setCurrentUser(parsedUser)

        // 验证管理员身份（这里假设从API获取管理员状态，实际应用中应该从后端验证）
        // 简单示例：检查特定的EVM地址作为管理员
        const adminAddresses = ['0x1234567890123456789012345678901234567890'] // 示例管理员地址
        const isAdminUser = adminAddresses.includes(parsedUser.EVM)
        setIsAdmin(isAdminUser)

        if (isAdminUser) {
          // 加载所有待验证的任务
          await loadPendingVerificationTasks()
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [t])

  // 加载所有待验证的任务
  const loadPendingVerificationTasks = async () => {
    try {
      const response = await fetch('/api/tasklist/pending-verification', {
        headers: {
          'Authorization': `Bearer ${currentUser?.token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setPendingVerificationTasks(data.data || [])
      } else {
        toast.error(t('error') + ': ' + (data.error || '加载任务失败'))
      }
    } catch (error) {
      console.error('Error loading pending verification tasks:', error)
      toast.error(t('error') + ': ' + error.message)
    }
  }

  // 验证任务
  const handleVerifyTask = async (tlistID) => {
    try {
      const response = await fetch(`/api/tasklist/${tlistID}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        // 刷新任务列表
        await loadPendingVerificationTasks()
        toast.success(t('successVerifyTask'))
      } else {
        toast.error(t('error') + ': ' + (data.error || '验证失败'))
      }
    } catch (error) {
      console.error('Error verifying task:', error)
      toast.error(t('error') + ': ' + error.message)
    }
  }

  // 拒绝任务
  const handleRejectTask = async (tlistID) => {
    const isConfirmed = window.confirm(t('confirmRejectTask'))
    if (!isConfirmed) return

    try {
      const response = await fetch(`/api/tasklist/${tlistID}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        // 刷新任务列表
        await loadPendingVerificationTasks()
        toast.success(t('successRejectTask'))
      } else {
        toast.error(t('error') + ': ' + (data.error || '拒绝失败'))
      }
    } catch (error) {
      console.error('Error rejecting task:', error)
      toast.error(t('error') + ': ' + error.message)
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

  if (!currentUser || !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card p-6 text-center">
          <h2 className="text-xl font-bold mb-4">{t('unauthorizedAccess')}</h2>
          <p>{t('adminOnly')}</p>
          <Link 
            to="/" 
            className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            {t('goToHome')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 简单导航栏 */}
      <div className="mb-8">
        <nav className="flex items-center justify-between p-4 bg-bg-muted rounded-lg">
          <div>
            <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
          </div>
          <div>
            <Link 
              to="/" 
              className="text-primary hover:underline flex items-center"
            >
              <span className="mr-1">←</span> {t('backToHome')}
            </Link>
          </div>
        </nav>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">{t('pendingVerification')}</h2>
        <p className="text-text-secondary">{t('verifyUserTasks')}</p>
      </div>

      {pendingVerificationTasks.length === 0 ? (
        <div className="card p-6 text-center">
          <p>{t('noPendingTasks')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-muted">
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {t('task')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {t('user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {t('submittedInfo')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-bg-dark divide-y divide-border">
              {pendingVerificationTasks.map((task) => (
                <tr key={task.tlistID} className="hover:bg-bg-hover transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-sm text-text-secondary">{task.tID}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">{task.uID}</div>
                    <div className="text-xs text-text-secondary font-mono break-all max-w-xs">{task.EVM}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm bg-bg-muted p-3 rounded-lg max-w-md">{task.info_input}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleVerifyTask(task.tlistID)}
                      className="text-green-600 hover:text-green-800 mr-4"
                    >
                      {t('verify')}
                    </button>
                    <button
                      onClick={() => handleRejectTask(task.tlistID)}
                      className="text-red-600 hover:text-red-800"
                    >
                      {t('reject')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DashboardPage