import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button, Card, CardContent } from '../components/ui'
import { TaskCard } from '../components/task/TaskCard'
import { RewardCard } from '../components/reward/RewardCard'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import DashJ from '../components/ui/DashJ'
import ActiveTaskModal from '../components/ActiveTaskModal'
import { fetchApiJson, getAuthHeaders } from '../auth'
import { useAuth } from '../auth-context'

const HomePage = () => {
  const HOME_TASK_LIMIT = 6
  const HOME_REWARD_LIMIT = 8
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const [tasks, setTasks] = useState([])
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const [selectedTask, setSelectedTask] = useState(null)
  const [openActiveModal, setOpenActiveModal] = useState(false)

  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  const mapTasksForHome = (taskRows, lang) => (
    (taskRows || []).map((task) => ({
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
      participants: task.participants_count || 0,
      type: task.refcode ? 'trade' : 'join',
      actionText: '立即参与',
    }))
  )

  const mapRewardsForHome = (prizeRows, lang, claimedPrizeIds = new Set()) => (
    (prizeRows || []).map((prize) => {
      const isClaimed = claimedPrizeIds.has(prize.bID)
      const storesCount = prize.stores_count || 0
      return {
        ...prize,
        title: lang === 'en'
          ? (prize.name_en ?? prize.name)
          : lang === 'hk'
            ? (prize.name_hk ?? prize.name)
            : lang === 'vn'
              ? (prize.name_vn ?? prize.name)
              : prize.name,
        description: lang === 'en'
          ? (prize.description_en ?? prize.description)
          : lang === 'hk'
            ? (prize.description_hk ?? prize.description)
            : lang === 'vn'
              ? (prize.description_vn ?? prize.description)
              : prize.description,
        points_required: prize.points || 0,
        status: isClaimed ? 'claimed' : storesCount > 0 ? 'available' : 'locked',
        statusText: isClaimed ? '已兑换' : storesCount > 0 ? '可兑换' : '库存不足',
        rarity: prize.points > 5000 ? 'epic' : prize.points > 2000 ? 'rare' : 'common',
        image: prize.image_url || prize.url_image || '/placeholder.jpg',
        claimed: prize.claims_count || 0,
        total: (prize.claims_count || 0) + storesCount,
        limited: Boolean(prize.gift_limit || prize.time_end),
        brand: {
          name: prize.name,
          logo: prize.image_url || prize.url_image || '',
        },
      }
    })
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const { signal } = controller

    const loadLegacyHomePayload = async () => {
      const [taskRows, prizeRows] = await Promise.all([
        fetchApiJson(`/api/task/all?limit=${HOME_TASK_LIMIT}`, { signal }),
        fetchApiJson(`/api/prize/all?limit=${HOME_REWARD_LIMIT}`, { signal }),
      ])

      if (!isAuthenticated || !user?.uID) {
        return {
          tasks: taskRows,
          prizes: prizeRows,
          claimed_prize_ids: [],
          user_points: 0,
        }
      }

      const [claimedPrizeItems, asset] = await Promise.all([
        fetchApiJson('/api/prize-item', { headers: getAuthHeaders(user), signal }).catch(() => []),
        fetchApiJson(`/api/user/asset/${user.uID}`, { signal }).catch(() => ({ points: 0 })),
      ])

      return {
        tasks: taskRows,
        prizes: prizeRows,
        claimed_prize_ids: (claimedPrizeItems || []).map((prizeItem) => prizeItem.bID),
        user_points: asset?.points || 0,
      }
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const lang = getCurrentLang()
        const headers = isAuthenticated ? getAuthHeaders(user) : undefined
        let homePayload

        try {
          homePayload = await fetchApiJson(
            `/api/home?task_limit=${HOME_TASK_LIMIT}&prize_limit=${HOME_REWARD_LIMIT}`,
            { headers, signal },
          )
        } catch (homeError) {
          console.warn('Home aggregate endpoint failed, falling back to legacy requests:', homeError)
          homePayload = await loadLegacyHomePayload()
        }

        if (cancelled) return

        const taskRows = homePayload?.tasks || []
        const prizeRows = homePayload?.prizes || []
        const claimedPrizeIds = new Set(homePayload?.claimed_prize_ids || [])
        setTasks(mapTasksForHome(taskRows, lang))
        setRewards(mapRewardsForHome(prizeRows, lang, claimedPrizeIds))
        setUserPoints(homePayload?.user_points || 0)
      } catch (error) {
        if (!cancelled) {
          console.error('Load data error:', error)
          toast.error(`加载首页失败: ${error.message}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isAuthenticated, location.pathname, user?.uID, user?.token, user?.access_token])

  const handleTaskAction = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

  const handleRewardClaim = (reward) => {
    if (!isAuthenticated) {
      toast.error('请先登录')
      navigate('/login', { state: { from: location } })
      return
    }

    if (reward.status === 'claimed') {
      toast('这个奖励你已经兑换过了')
      return
    }

    if (reward.status !== 'available') {
      toast.error('当前奖励库存不足')
      return
    }

    if (userPoints < reward.points_required) {
      toast.error('积分不足')
      return
    }

    toast('奖品兑换入口即将上线，请先前往奖励中心查看详情')
    navigate('/reward')
  }

  if (loading) {
    return (
      <ResponsiveContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-gray-600">正在加载精彩内容...</div>
        </div>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        <FadeIn>
          <section className="bg-gradient-to-r from-yellow-50 to-blue-50 rounded-2xl p-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">欢迎来到 Jinli Club</h1>
            <p className="text-xl text-gray-600 mb-6">
              参与任务，赚取<DashJ size="sm" />，兑换精彩奖励
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={isAuthenticated ? '/task' : '/register'}>
                <Button variant="primary" size="lg">
                  {isAuthenticated ? '继续任务' : '立即注册'}
                </Button>
              </Link>
              <Link to="/reward">
                <Button variant="secondary" size="lg">查看奖励</Button>
              </Link>
            </div>
          </section>
        </FadeIn>

        <SlideUp delay={200}>
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">热门任务</h2>
                <p className="text-gray-600">参与任务赚取<DashJ size="sm" /></p>
              </div>
              <Link to="/task">
                <Button variant="proceed">查看全部</Button>
              </Link>
            </div>

            {tasks.length > 0 ? (
              <StaggerContainer>
                <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                  {tasks.slice(0, 6).map((task, index) => (
                    <FadeIn key={task.tID} delay={index * 100}>
                      <TaskCard task={task} onAction={handleTaskAction} showStatus={true} />
                    </FadeIn>
                  ))}
                </ResponsiveGrid>
              </StaggerContainer>
            ) : (
              <Card variant="inactive">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">暂无可用任务</p>
                </CardContent>
              </Card>
            )}
          </section>
        </SlideUp>

        <SlideUp delay={400}>
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">精选奖励</h2>
                <p className="text-gray-600">用<DashJ size="sm" />兑换精彩礼品</p>
              </div>
              <Link to="/reward">
                <Button variant="proceed">查看全部</Button>
              </Link>
            </div>

            {rewards.length > 0 ? (
              <StaggerContainer>
                <ResponsiveGrid sm={1} md={2} lg={4} gap={6}>
                  {rewards.map((reward, index) => (
                    <FadeIn key={reward.bID} delay={index * 100}>
                      <RewardCard
                        reward={reward}
                        onClaim={handleRewardClaim}
                        userPoints={userPoints}
                        showStatus={true}
                      />
                    </FadeIn>
                  ))}
                </ResponsiveGrid>
              </StaggerContainer>
            ) : (
              <Card variant="inactive">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">暂无可用奖励</p>
                </CardContent>
              </Card>
            )}
          </section>
        </SlideUp>
      </div>

      {selectedTask && (
        <ActiveTaskModal
          open={openActiveModal}
          onClose={() => setOpenActiveModal(false)}
          task={selectedTask}
        />
      )}
    </ResponsiveContainer>
  )
}

export default HomePage
