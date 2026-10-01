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
import { getLanguageFromUrl } from '../utils'
import { pickLocalized } from '../i18n-content'

// P6-I18N-LIT-B2：`t` 由调用点传入（`fetchJson` 在模块作用域，无 hook 上下文）；
//   缺 `t` 时兜底为非 CJK 的 `HTTP <status>`。
const fetchJson = async (url, options = {}, t) => {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.success) {
    const fallback = t ? t('taskPage.requestFailed', { status: response.status }) : `HTTP ${response.status}`
    throw new Error(data?.message || fallback)
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

  // P6-I18N-LIT-B2：语言码走 utils 单一来源（原本地 `getCurrentLang` 复刻 ⇒ 删）；
  //   内容本地化收口为共用 `pickLocalized`（`||` 语义、防空串穿透；原三目链（`_en` 配 `??` 兜底）删除）。
  const lang = getLanguageFromUrl(location.pathname)

  const enrichTask = (task) => ({
    ...task,
    title: pickLocalized(task, 'title', lang),
    note: pickLocalized(task, 'note', lang),
    description: pickLocalized(task, 'note', lang),
    status: task.is_open ? 'active' : 'inactive',
    statusText: task.is_open ? t('common.ongoing') : t('common.ended'),
    type: task.refcode ? 'trade' : 'join',
    participants: task.participants_count || 0,
    actionText: t('common.joinNow'),
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
        const storedUser = localStorage.getItem('user')
        const parsedUser = storedUser ? JSON.parse(storedUser) : null
        setCurrentUser(parsedUser)

        const taskRows = await fetchJson('/api/task/all', {}, t)
        const enrichedTasks = (taskRows || []).map((task) => enrichTask(task))
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
              statusText: t('common.completed'),
              actionText: t('common.claimed'),
            })
            return
          }

          if (taskProgress.time_checked) {
            nextPendingRewards.push({
              ...merged,
              status: 'active',
              statusText: t('common.pending'),
              actionText: t('common.claimReward'),
            })
            return
          }

          if (taskProgress.time_submitted || taskProgress.info_input) {
            nextVerification.push({
              ...merged,
              status: 'inactive',
              statusText: t('pendingVerification'),
              actionText: t('common.underReview'),
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
              actionText: taskProgress?.jID ? t('taskPage.continueTask') : t('common.joinNow'),
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
        <LoadingPage message={t('common.loadingTasks')} />
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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('taskPage.title')}</h1>
            <p className="text-xl text-gray-600 mb-8">{t('taskPage.subtitle')}</p>

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
                  <div className="text-sm text-gray-600">{t('common.available')}</div>
                </CardContent>
              </Card>
              <Card variant="warning" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-orange-600">{taskStats.pending}</div>
                  <div className="text-sm text-gray-600">{t('common.pending')}</div>
                </CardContent>
              </Card>
              <Card variant="success" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
                  <div className="text-sm text-gray-600">{t('common.completed')}</div>
                </CardContent>
              </Card>
              <Card variant="secondary" className="text-center">
                <CardContent className="py-4">
                  <div className="text-2xl font-bold text-blue-600">{taskStats.verification}</div>
                  <div className="text-sm text-gray-600">{t('pendingVerification')}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </FadeIn>

        <SlideUp delay={200}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">{t('common.available')} ({taskStats.available})</TabsTrigger>
              <TabsTrigger value="pending">{t('common.pending')} ({taskStats.pending})</TabsTrigger>
              <TabsTrigger value="completed">{t('common.completed')} ({taskStats.completed})</TabsTrigger>
              <TabsTrigger value="verification">{t('pendingVerification')} ({taskStats.verification})</TabsTrigger>
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
                      <p className="text-lg">{t('taskPage.emptyAvailable')}</p>
                      <p className="text-sm mt-2">{t('taskPage.emptyAvailableHint')}</p>
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
                      <p className="text-lg">{t('taskPage.emptyPending')}</p>
                      <p className="text-sm mt-2">{t('taskPage.emptyPendingHint')}</p>
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
                      <p className="text-lg">{t('taskPage.emptyCompleted')}</p>
                      <p className="text-sm mt-2">{t('taskPage.emptyCompletedHint')}</p>
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
                      <p className="text-lg">{t('taskPage.emptyVerification')}</p>
                      <p className="text-sm mt-2">{t('taskPage.emptyVerificationHint')}</p>
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
