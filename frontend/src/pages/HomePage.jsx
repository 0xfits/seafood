import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import { Button, Card, CardContent } from '../components/ui'
import { TaskCard } from '../components/task/TaskCard'
import { RewardCard } from '../components/reward/RewardCard'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import ActiveTaskModal from '../components/ActiveTaskModal'
import { fetchApiJson, getAuthHeaders } from '../auth'
import { useAuth } from '../auth-context'
import { pickLocalized } from '../i18n-content'
import { PLACEHOLDER_IMAGE } from '../assets/placeholder'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'

const HomePage = () => {
  const HOME_TASK_LIMIT = 6
  const HOME_REWARD_LIMIT = 8
  const navigate = useNavigate()
  const location = useLocation()
  // P6-MISC-FIX ②：站内链接统一走唯一构造器（当前语言前缀），本单补齐 5 处硬编码绝对路径
  const lang = getLanguageFromUrl(location.pathname)
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()
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

  // ★ P6-I18N-LIT-B5 必做②（D7 最后一项）：首页的**旧三目链**（语言后缀 + 空值合并运算符）收口为共用
  //   `pickLocalized`（`src/i18n-content.js`），与其余 8 处已接页一致。
  //   语义差异是实质修复：后端「未翻译时有值且等于原文、但字段可能缺省 / 误给空串」⇒
  //   空值合并运算符只在 `null`/`undefined` 时回落，**空串会穿透**；`pickLocalized` 用 `||`，空串回落原文。
  const mapTasksForHome = (taskRows, lang) => (
    (taskRows || []).map((task) => ({
      ...task,
      title: pickLocalized(task, 'title', lang),
      note: pickLocalized(task, 'note', lang),
      description: task.note,
      status: task.is_open ? 'active' : 'inactive',
      statusText: task.is_open ? t('common.ongoing') : t('common.ended'),
      participants: task.participants_count || 0,
      type: task.refcode ? 'trade' : 'join',
      actionText: t('common.joinNow'),
    }))
  )

  const mapRewardsForHome = (prizeRows, lang, claimedPrizeIds = new Set()) => (
    (prizeRows || []).map((prize) => {
      const isClaimed = claimedPrizeIds.has(prize.bID)
      const storesCount = prize.stores_count || 0
      return {
        ...prize,
        title: pickLocalized(prize, 'name', lang),
        description: pickLocalized(prize, 'description', lang),
        points_required: prize.points || 0,
        status: isClaimed ? 'claimed' : storesCount > 0 ? 'available' : 'locked',
        statusText: isClaimed ? t('common.redeemed') : storesCount > 0 ? t('common.redeemable') : t('common.outOfStock'),
        rarity: prize.points > 5000 ? 'epic' : prize.points > 2000 ? 'rare' : 'common',
        image: prize.image_url || prize.url_image || PLACEHOLDER_IMAGE, // P6-MISC-FIX ⑤：原 '/placeholder.jpg' 仓库内不存在
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
          toast.error(t('homePage.loadFailed', { message: error.message }))
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
      toast.error(t('pleaseLogin'))
      navigate(buildLocalizedPath(lang, '/login'), { state: { from: location } })
      return
    }

    if (reward.status === 'claimed') {
      toast(t('homePage.rewardAlreadyClaimed'))
      return
    }

    if (reward.status !== 'available') {
      toast.error(t('homePage.rewardOutOfStock'))
      return
    }

    if (userPoints < reward.points_required) {
      toast.error(t('homePage.notEnoughPoints'))
      return
    }

    toast(t('homePage.redeemComingSoon'))
    navigate(buildLocalizedPath(lang, '/reward'))
  }

  if (loading) {
    return (
      <ResponsiveContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-gray-600">{t('homePage.loading')}</div>
        </div>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        <FadeIn>
          <section className="bg-gradient-to-r from-yellow-50 to-blue-50 rounded-2xl p-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('homePage.welcome')}</h1>
            <p className="text-xl text-gray-600 mb-6">
              {t('homePage.heroLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>{t('homePage.heroTail')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={isAuthenticated ? '/task' : '/register'}>
                <Button variant="primary" size="lg">
                  {isAuthenticated ? t('homePage.continueTask') : t('homePage.registerNow')}
                </Button>
              </Link>
              <Link to={buildLocalizedPath(lang, '/reward')}>
                <Button variant="secondary" size="lg">{t('homePage.browseRewards')}</Button>
              </Link>
            </div>
          </section>
        </FadeIn>

        <SlideUp delay={200}>
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('homePage.hotTasks')}</h2>
                <p className="text-gray-600">{t('homePage.hotTasksLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span></p>
              </div>
              <Link to={buildLocalizedPath(lang, '/task')}>
                <Button variant="proceed">{t('common.viewAll')}</Button>
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
                  <p className="text-gray-500">{t('homePage.noTasks')}</p>
                </CardContent>
              </Card>
            )}
          </section>
        </SlideUp>

        <SlideUp delay={400}>
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('homePage.featuredRewards')}</h2>
                <p className="text-gray-600">{t('homePage.featuredLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>{t('homePage.featuredTail')}</p>
              </div>
              <Link to={buildLocalizedPath(lang, '/reward')}>
                <Button variant="proceed">{t('common.viewAll')}</Button>
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
                  <p className="text-gray-500">{t('homePage.noRewards')}</p>
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
