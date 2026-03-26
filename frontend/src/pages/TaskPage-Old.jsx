import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import ClaimRewardModal from '../components/ClaimRewardModal'
import ActiveTaskModal from '../components/ActiveTaskModal'

const TaskPage = () => {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState([])
  const [pendingRewardTasks, setPendingRewardTasks] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [pendingVerificationTasks, setPendingVerificationTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [openChooseModal, setOpenChooseModal] = useState(false)
  const [openActiveModal, setOpenActiveModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const location = useLocation()

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // 加载用户信息
        const user = localStorage.getItem('user')
        if (user) {
          setCurrentUser(JSON.parse(user))
        }
        // 加载所有任务（用于差集计算）
        try {
          const tasksResponse = await fetch('/api/task/all')
          if (tasksResponse.ok) {
            const contentType = tasksResponse.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              const tasksData = await tasksResponse.json()
              if (tasksData.success) {
                setTasks(tasksData.data)
                window.tasksData = tasksData.data
              }
            }
          }
        } catch (e) {
          // 失败时不影响后续逻辑，使用已有 state/window.tasksData
          console.warn('Failed to load tasks for TaskPage:', e)
        }
        
        // 加载用户任务清单
        if (currentUser) {
          const tasklistResponse = await fetch(`/api/tasklist/`, {
            headers: { 'Authorization': `Bearer ${currentUser?.token}` }
          })
          const tasklistData = await tasklistResponse.json()
          if (tasklistData.success) {
            setPendingVerificationTasks(tasklistData.data.pendingVerification || [])
            const pendingRewards = tasklistData.data.pendingRewards || []
            const completed = tasklistData.data.completedTasks || []
            setPendingRewardTasks(pendingRewards)
            setCompletedTasks(completed)
            // 差集：所有任务 - （待领取 + 已领取）
            const allTasks = Array.isArray(window.tasksData) ? window.tasksData : tasks
            const toClaimIDs = new Set(pendingRewards.map(t => t.tID || (t.task && t.task.tID)).filter(Boolean))
            const completedIDs = new Set(completed.map(t => t.tID || (t.task && t.task.tID)).filter(Boolean))
            const pending = (allTasks || []).filter(t => !toClaimIDs.has(t.tID) && !completedIDs.has(t.tID))
            setPendingTasks(pending)
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [t, currentUser])

  // 页面加载后滚动到待验证部分
  useEffect(() => {
    const scrollToPendingVerification = () => {
      const element = document.getElementById('pending-verification')
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
    
    // 只有在页面加载时滚动
    if (!location.hash) {
      scrollToPendingVerification()
    }
  }, [location.hash])

  // 处理选择奖励
  const handleClaimReward = (task) => {
    setSelectedTask(task)
    setOpenChooseModal(true)
  }

  // 处理完成任务
  const handleCompleteTask = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

  // 处理验证任务（仅管理员可见，此处预览）
  const handleVerifyTask = async (tlistID) => {
    try {
      const response = await fetch(`/api/tasklist/check/${tlistID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        }
      })
      
      const data = await response.json()
      if (data.success) {
        // 刷新任务列表（使用当前用户端点，需要认证）
        const tasklistResponse = await fetch(`/api/tasklist/`, {
          headers: { 'Authorization': `Bearer ${currentUser?.token}` }
        })
        const tasklistData = await tasklistResponse.json()
        if (tasklistData.success) {
          setPendingVerificationTasks(tasklistData.data.pendingVerification || [])
          setPendingRewardTasks(tasklistData.data.pendingRewards || [])
          setPendingTasks(tasklistData.data.pendingTasks || [])
          setCompletedTasks(tasklistData.data.completedTasks || [])
        }
        toast.success(t('successVerifyTask'))
      } else {
        toast.error(t('error') + ': ' + (data.error || '验证失败'))
      }
    } catch (error) {
      console.error('Error verifying task:', error)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('tasks')}</h1>
        <p className="text-text-secondary">{t('welcome')}</p>
      </div>
      
      {/* 待验证的任务清单 */}
      <div id="pending-verification" className="mb-12">
        <h2 className="text-2xl font-bold mb-6">{t('pendingVerification')}</h2>
        {pendingVerificationTasks.length === 0 ? (
          <div className="card p-6 text-center">
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingVerificationTasks.map((task) => (
              <div key={task.tlistID} className="card p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                  <div className="flex-grow">
                    <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                    <p className="text-text-secondary text-sm mb-4">{task.note}</p>
                    <div className="bg-bg-muted p-4 rounded-lg mb-4">
                      <p className="text-sm">{t('info_input')}: {task.info_input}</p>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-6">
                    <button
                      onClick={() => handleVerifyTask(task.tlistID)}
                      className="btn btn-success"
                    >
                      {t('verify')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 待领取奖励的任务 */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">{t('tasksToClaimReward')}</h3>
        {pendingRewardTasks.length === 0 ? (
          <div className="card p-6 text-center">
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRewardTasks.map((task) => (
              <div key={task.tlistID} className="card p-6 relative card--badge-space">
                {/* 积分徽章（蓝色）：显示待领取奖励的积分 */}
                {typeof task.points !== 'undefined' && (
                  <div
                    className="badge badge-proceed"
                    title={`+${typeof task.points === 'number' ? task.points : (task.points ? Number(task.points) : 0)} ${t('points')}`}
                  >
                    <svg className="badge__star" viewBox="0 0 24 24" aria-hidden="true">
                      <defs>
                        <linearGradient id="earnedStarGradientProceedTaskPage" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#93C5FD" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#earnedStarGradientProceedTaskPage)" stroke="#FFFFFF" strokeWidth="0.8" strokeLinejoin="round" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div>
                    <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                    <p className="text-text-secondary text-sm">{task.note}</p>
                  </div>
                  <button
                    onClick={() => handleClaimReward(task)}
                    className="btn btn-primary mt-4 md:mt-0"
                  >
                    {t('claimReward')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 待完成的任务 */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">{t('tasksToComplete')}</h3>
        {pendingTasks.length === 0 ? (
          <div className="card p-6 text-center">
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.map((task) => (
              <div key={task.tID} className="card p-6 relative card--badge-space">
                {/* 积分徽章（黄色）：显示任务可获得积分 */}
                {typeof task.points !== 'undefined' && (
                  <div
                    className="badge badge-primary"
                    title={`+${typeof task.points === 'number' ? task.points : (task.points ? Number(task.points) : 0)} ${t('points')}`}
                  >
                    <svg className="badge__star" viewBox="0 0 24 24" aria-hidden="true">
                      <defs>
                        <linearGradient id="earnedStarGradientPrimaryTaskPage" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFF39A" />
                          <stop offset="100%" stopColor="#FFC107" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#earnedStarGradientPrimaryTaskPage)" stroke="#FFFFFF" strokeWidth="0.8" strokeLinejoin="round" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div>
                    <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                    <p className="text-text-secondary text-sm">{task.note}</p>
                    {task.linkA && (
                      <a href={task.linkA} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm mt-2 inline-block">
                        {t('viewDetails')}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleCompleteTask(task)}
                    className="btn btn-proceed mt-4 md:mt-0"
                  >
                    {t('goComplete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 已领取奖励的任务 */}
      <div>
        <h3 className="text-xl font-semibold mb-4">{t('tasksClaimed')}</h3>
        {completedTasks.length === 0 ? (
          <div className="card p-6 text-center">
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedTasks.map((task) => (
              <div key={task.tlistID} className="card p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div>
                    <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                    <p className="text-text-secondary text-sm">{task.note}</p>
                    <div className="flex items-center mt-2">
                      <span className="text-success text-sm">{t('success')}: </span>
                      <span className="text-sm ml-1">{task.giftTitle}</span>
                    </div>
                  </div>
                  <div className="text-sm text-text-muted mt-2 md:mt-0">
                    {new Date(task.time_actived).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 模态框 */}
      <ClaimRewardModal
        open={openChooseModal}
        onClose={() => setOpenChooseModal(false)}
        task={selectedTask}
      />
      
      <ActiveTaskModal
        open={openActiveModal}
        onClose={() => setOpenActiveModal(false)}
        task={selectedTask}
      />
    </div>
  )
}

export default TaskPage
