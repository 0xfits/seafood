import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

// 新的 UI 组件
import { Container, Grid } from '../components/layout'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { TaskCard } from '../components/task/TaskCard'
import { LoadingPage, LoadingCard } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'

// 原有模态框组件
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
  const [activeTab, setActiveTab] = useState('available')
  const location = useLocation()

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

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

        // 加载所有任务
        try {
          const tasksResponse = await fetch('/api/task/all')
          if (tasksResponse.ok) {
            const contentType = tasksResponse.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              const tasksData = await tasksResponse.json()
              if (tasksData.success) {
                const lang = getCurrentLang()
                const enrichedTasks = (tasksData.data || []).map(task => ({
                  ...task,
                  title: lang === 'en' ? (task.title_en ?? task.title) : 
                         lang === 'hk' ? (task.title_hk ?? task.title) : 
                         lang === 'vn' ? (task.title_vn ?? task.title) : task.title,
                  note: lang === 'en' ? (task.note_en ?? task.note) : 
                        lang === 'hk' ? (task.note_hk ?? task.note) : 
                        lang === 'vn' ? (task.note_vn ?? task.note) : task.note,
                  status: task.is_open ? 'active' : 'inactive',
                  statusText: task.is_open ? '进行中' : '已结束',
                  type: task.refcode ? 'trade' : 'join',
                  participants: Math.floor(Math.random() * 100),
                  actionText: '立即参与'
                }))
                setTasks(enrichedTasks)
                window.tasksData = enrichedTasks
              }
            }
          }
        } catch (e) {
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
    
    if (!location.hash) {
      scrollToPendingVerification()
    }
  }, [location.hash])

  // 处理选择奖励
  const handleClaimReward = (task) => {
    setSelectedTask(task)
    setOpenChooseModal(true)
  }

  // 处理任务操作
  const handleTaskAction = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

  // 如果正在加载，显示加载页面
  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载任务..." />
      </ResponsiveContainer>
    )
  }

  // 任务统计
  const taskStats = {
    available: pendingTasks.length,
    pending: pendingRewardTasks.length,
    completed: completedTasks.length,
    verification: pendingVerificationTasks.length
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        {/* 页面标题 */}
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              任务中心
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              参与任务，赚取积分，解锁精彩奖励
            </p>
            
            {/* 任务统计 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <Card variant="primary" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-yellow-600">{taskStats.available}</div>
                  <div className="text-sm text-gray-600">可参与</div>
                </CardContent>
              </Card>
              <Card variant="warning" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-orange-600">{taskStats.pending}</div>
                  <div className="text-sm text-gray-600">待领取</div>
                </CardContent>
              </Card>
              <Card variant="success" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
                  <div className="text-sm text-gray-600">已完成</div>
                </CardContent>
              </Card>
              <Card variant="secondary" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-blue-600">{taskStats.verification}</div>
                  <div className="text-sm text-gray-600">待验证</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </FadeIn>

        {/* 任务标签页 */}
        <SlideUp delay={200}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">可参与 ({taskStats.available})</TabsTrigger>
              <TabsTrigger value="pending">待领取 ({taskStats.pending})</TabsTrigger>
              <TabsTrigger value="completed">已完成 ({taskStats.completed})</TabsTrigger>
              <TabsTrigger value="verification">待验证 ({taskStats.verification})</TabsTrigger>
            </TabsList>

            {/* 可参与任务 */}
            <TabsContent value="available" className="space-y-6">
              {pendingTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {pendingTasks.map((task, index) => (
                      <FadeIn key={task.tID} delay={index * 100}>
                        <TaskCard 
                          task={task} 
                          onAction={handleTaskAction}
                          showStatus={true}
                        />
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">📋</div>
                      <p className="text-lg">暂无可用任务</p>
                      <p className="text-sm mt-2">请稍后再来查看</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 待领取任务 */}
            <TabsContent value="pending" className="space-y-6">
              {pendingRewardTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {pendingRewardTasks.map((task, index) => (
                      <FadeIn key={task.tID} delay={index * 100}>
                        <TaskCard 
                          task={{
                            ...task,
                            status: 'pending',
                            statusText: '待领取',
                            actionText: '领取奖励'
                          }} 
                          onAction={handleClaimReward}
                          showStatus={true}
                        />
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">⏳</div>
                      <p className="text-lg">暂无待领取任务</p>
                      <p className="text-sm mt-2">完成任务后可在此领取奖励</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 已完成任务 */}
            <TabsContent value="completed" className="space-y-6">
              {completedTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {completedTasks.map((task, index) => (
                      <FadeIn key={task.tID} delay={index * 100}>
                        <TaskCard 
                          task={{
                            ...task,
                            status: 'completed',
                            statusText: '已完成',
                            actionText: '查看详情'
                          }} 
                          onAction={() => {}}
                          showStatus={true}
                        />
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">✅</div>
                      <p className="text-lg">暂无已完成任务</p>
                      <p className="text-sm mt-2">开始参与任务赚取积分吧</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 待验证任务 */}
            <TabsContent value="verification" className="space-y-6" id="pending-verification">
              {pendingVerificationTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {pendingVerificationTasks.map((task, index) => (
                      <FadeIn key={task.tID} delay={index * 100}>
                        <TaskCard 
                          task={{
                            ...task,
                            status: 'verification',
                            statusText: '待验证',
                            actionText: '查看进度'
                          }} 
                          onAction={() => {}}
                          showStatus={true}
                        />
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">🔍</div>
                      <p className="text-lg">暂无待验证任务</p>
                      <p className="text-sm mt-2">提交的任务审核通过后会显示在这里</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </SlideUp>
      </div>

      {/* 模态框 */}
      {selectedTask && (
        <ActiveTaskModal
          isOpen={openActiveModal}
          onClose={() => setOpenActiveModal(false)}
          task={selectedTask}
        />
      )}
      
      <ClaimRewardModal
        isOpen={openChooseModal}
        onClose={() => setOpenChooseModal(false)}
        tasks={pendingRewardTasks}
      />
    </ResponsiveContainer>
  )
}

export default TaskPage
