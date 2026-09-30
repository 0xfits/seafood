import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Card, CardContent } from '../components/ui'
import { TaskCard } from '../components/task/TaskCard'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import ClaimRewardModal from '../components/ClaimRewardModal'
import ActiveTaskModal from '../components/ActiveTaskModal'

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `请求失败 (${response.status})`)
  }

  return data.data
}

const TaskPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
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

  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  const enrichTask = (task, lang) => ({
    ...task,
    title: lang === 'en'
      ? (task.title_en ?? task.title)
      : lang === 'hk'
        ? (task.title_hk ?? task.title)
        : lang === 'vn'
          ? (task.title_vn ?? task.title)
          : task.title,
    note: lang === 'en'
      ? (task.note_en ?? task.note)
      : lang === 'hk'
        ? (task.note_hk ?? task.note)
        : lang === 'vn'
          ? (task.note_vn ?? task.note)
          : task.note,
    description: task.note,
    status: task.is_open ? 'active' : 'inactive',
    statusText: task.is_open ? '进行中' : '已结束',
    type: task.refcode ? 'trade' : 'join',
    participants: task.participants_count || 0,
    actionText: '立即参与',
  })

  const normalizeTaskProgressTask = (taskProgress, task) => ({
    ...task,
    ...taskProgress,
    jID: taskProgress.jID,
    tlistID: taskProgress.jID,
    participants: task.participants || 0,
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const lang = getCurrentLang()
        const storedUser = localStorage.getItem('user')
        const parsedUser = storedUser ? JSON.parse(storedUser) : null
        setCurrentUser(parsedUser)

        const taskRows = await fetchJson('/api/task/all')
        const enrichedTasks = (taskRows || []).map((task) => enrichTask(task, lang))
        const taskMap = new Map(enrichedTasks.map((task) => [task.tID, task]))
        setTasks(enrichedTasks)

        if (!parsedUser) {
          setPendingTasks(enrichedTasks.filter((task) => task.is_open !== false))
          setPendingRewardTasks([])
          setCompletedTasks([])
          setPendingVerificationTasks([])
          return
        }

        const token = parsedUser.token || parsedUser.access_token || localStorage.getItem('token')
        if (!token) {
          setPendingTasks(enrichedTasks.filter((task) => task.is_open !== false))
          return
        }

        const taskProgressItems = await fetchJson('/api/task-progress', {
          headers: { Authorization: `Bearer ${token}` },
        })

        const latestTaskProgressByTask = new Map()
        ;(taskProgressItems || [])
          .sort((left, right) => (left.jID || 0) - (right.jID || 0))
          .forEach((taskProgress) => {
            latestTaskProgressByTask.set(taskProgress.tID, taskProgress)
          })

        const nextPendingRewards = []
        const nextCompleted = []
        const nextVerification = []

        latestTaskProgressByTask.forEach((taskProgress, tID) => {
          const task = taskMap.get(tID)
          if (!task) return

          const merged = normalizeTaskProgressTask(taskProgress, task)
          if (taskProgress.time_claimed) {
            nextCompleted.push({
              ...merged,
              status: 'inactive',
              statusText: '已完成',
              actionText: '已领取',
            })
            return
          }

          if (taskProgress.time_checked) {
            nextPendingRewards.push({
              ...merged,
              status: 'active',
              statusText: '待领取',
              actionText: '领取奖励',
            })
            return
          }

          if (taskProgress.time_submitted || taskProgress.info_input) {
            nextVerification.push({
              ...merged,
              status: 'inactive',
              statusText: '待验证',
              actionText: '审核中',
            })
          }
        })

        const blockedTaskIds = new Set([
          ...nextPendingRewards.map((task) => task.tID),
          ...nextCompleted.map((task) => task.tID),
          ...nextVerification.map((task) => task.tID),
        ])

        const nextPendingTasks = enrichedTasks
          .filter((task) => task.is_open !== false)
          .filter((task) => !blockedTaskIds.has(task.tID))
          .map((task) => {
            const taskProgress = latestTaskProgressByTask.get(task.tID)
            return {
              ...task,
              jID: taskProgress?.jID,
              actionText: taskProgress?.jID ? '继续任务' : '立即参与',
            }
          })

        setPendingTasks(nextPendingTasks)
        setPendingRewardTasks(nextPendingRewards)
        setCompletedTasks(nextCompleted)
        setPendingVerificationTasks(nextVerification)
      } catch (error) {
        console.error('Error loading task page:', error)
        toast.error(`${t('error')}: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [t, location.pathname])

  useEffect(() => {
    if (location.hash !== '#pending-verification') return
    const element = document.getElementById('pending-verification')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash, pendingVerificationTasks.length])

  const handleClaimReward = (task) => {
    setSelectedTask(task)
    setOpenChooseModal(true)
  }

  const handleTaskAction = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载任务..." />
      </ResponsiveContainer>
    )
  }

  const taskStats = {
    available: pendingTasks.length,
    pending: pendingRewardTasks.length,
    completed: completedTasks.length,
    verification: pendingVerificationTasks.length,
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">任务中心</h1>
            <p className="text-xl text-gray-600 mb-8">参与任务，赚取积分，解锁精彩奖励</p>

            {/* 招工线入口条（P4-B4c-ii-a）：列表 = 本页（GET /api/task/all ⇒ 招工）；
                发布 = task/new（POST /api/job）；审核 = task/review（GET /api/tasklist/pending-verification）。
                样式只吃 4c-i 的 token + 栅格层（jobs.css），不按主题改几何。 */}
            <div className="sf-jobs" data-sf-m="jobs-nav">
              <div className="sf-jobs-actions">
                <Link className="sf-btn sf-jobs-btn" to="/task/new" data-sf-m="jobs-nav-publish">{t('jobs.publish')}</Link>
                <Link className="sf-btn sf-jobs-btn" to="/task/review" data-sf-m="jobs-nav-review">{t('jobs.review')}</Link>
                <span className="sf-jobs-status" data-sf-m="jobs-nav-note">{t('jobs.list')}</span>
              </div>
            </div>

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

        <SlideUp delay={200}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">可参与 ({taskStats.available})</TabsTrigger>
              <TabsTrigger value="pending">待领取 ({taskStats.pending})</TabsTrigger>
              <TabsTrigger value="completed">已完成 ({taskStats.completed})</TabsTrigger>
              <TabsTrigger value="verification">待验证 ({taskStats.verification})</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-6">
              {pendingTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {pendingTasks.map((task, index) => (
                      <FadeIn key={task.tID} delay={index * 100}>
                        <TaskCard task={task} onAction={handleTaskAction} showStatus={true} />
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

            <TabsContent value="pending" className="space-y-6">
              {pendingRewardTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {pendingRewardTasks.map((task, index) => (
                      <FadeIn key={task.jID || task.tID} delay={index * 100}>
                        <TaskCard task={task} onAction={handleClaimReward} showStatus={true} />
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
                      <p className="text-sm mt-2">完成任务并通过审核后可在此领取奖励</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-6">
              {completedTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {completedTasks.map((task, index) => (
                      <FadeIn key={task.jID || task.tID} delay={index * 100}>
                        <TaskCard task={task} onAction={() => {}} showStatus={true} />
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

            <TabsContent value="verification" className="space-y-6" id="pending-verification">
              {pendingVerificationTasks.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {pendingVerificationTasks.map((task, index) => (
                      <FadeIn key={task.jID || task.tID} delay={index * 100}>
                        <TaskCard task={task} onAction={() => {}} showStatus={true} />
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
                      <p className="text-sm mt-2">提交的任务审核过程中会显示在这里</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </SlideUp>
      </div>

      {selectedTask && (
        <ActiveTaskModal
          open={openActiveModal}
          onClose={() => setOpenActiveModal(false)}
          task={selectedTask}
        />
      )}

      {selectedTask && (
        <ClaimRewardModal
          open={openChooseModal}
          onClose={() => setOpenChooseModal(false)}
          task={selectedTask}
        />
      )}
    </ResponsiveContainer>
  )
}

export default TaskPage
