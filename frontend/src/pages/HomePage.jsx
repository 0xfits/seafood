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

// ============================================================================
// 首页（**2026-10-11 合并单** · Kevin 追加裁定）
//   ★ 首页 = **唯一的「闲置物品」列表面**（原 `ListingsPage` 的列表渲染已删 —— 两者本就取同一份 feed
//     `/api/prize/all`，见下方 `loadLegacyHomePayload` / `/api/home` 聚合读口 ⇒ 「不要两份实现」）。
//   并入自 `RewardPage`（已删）的两项能力：① 「我的积分」展示；② 分类筛选（限量版 / 高价值 / 已兑换）。
//     分类筛选的数据面依据（`/api/prize/all` 实际字段，现取，见报告 §筛选判据）：
//       · 限量版   ← `gift_limit` / `time_end`（字段在响应内，本页 `limited` 已派生）
//       · 高价值   ← `points`（字段在响应内，本页 `rarity==='epic'` 已派生，阈值 >5000 承 `RewardPage`）
//       · 已兑换   ← `/api/prize-item`（本页已取，`claimed_prize_ids`）⇒ 三档**均可筛**，故保留（非「永远筛不动」控件）。
//   「我的订单」整块（列表 + 退款/发货/收货 + 空态）**已于 2026-10-14（D7 变更）移出首页**：
//     渲染点迁至 /profile 我的交易-我买到的（组件 `./item/MyOrdersPanel` 保留复用，三写动作仍可达）。
//   ★ 原 `/reward`、`/listing*` 路由已随本单**硬删**（不 301）；卡片动作由「领取」改为「查看详情」（`item.viewDetail`）。
// ============================================================================
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
  // 分类筛选（并入自 `RewardPage`）：all / limited / highValue / claimed
  const [itemFilter, setItemFilter] = useState('all')

  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // ★ P6-I18N-LIT-B5 必做②（D7 最后一项）：首页的**旧三目链**（语言后缀 + 空值合并运算符）收口为共用
  //   `pickLocalized`（`src/i18n-content.js`），与其余 8 处已接页一致。
  const mapTasksForHome = (taskRows, lang) => (
    (taskRows || []).map((task) => ({
      ...task,
      title: pickLocalized(task, 'title', lang),
      note: pickLocalized(task, 'note', lang),
      description: task.note,
      status: task.is_open ? 'active' : 'inactive',
      statusText: task.is_open ? t('common.ongoing') : t('common.ended'),
      participants: task.participants_count || 0,
      headcount: task.headcount || 1,
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
          // 2026-10-11 合并单：品牌行改用**当前语言**的商品名（原 `prize.name` 会把中文原名带进 en/hk/vn 档）
          name: pickLocalized(prize, 'name', lang),
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

  // ★ 合并单：卡片动作 = 「查看该闲置物品详情」（原 `/reward` 已硬删）。
  //   `RewardCard` 的 `actionLabelKey='item.viewDetail'` 同时**解禁**按钮（查看不受积分门槛约束）。
  const handleRewardAction = (reward) => {
    const id = reward?.bID ?? reward?.listing_id ?? reward?.id
    if (id == null || id === '') return
    navigate(buildLocalizedPath(lang, `/item/${id}`))
  }

  // ★ v1.20 §22 `T112`（整卡可点击）：卡片链接目标 —— 与 `handleRewardAction` 同一 id 口径，
  //   仍走**唯一构造器** `buildLocalizedPath`（`utils.js:115`）；id 缺失 ⇒ 不传 `to`（卡片回落非链接容器）。
  const rewardPath = (reward) => {
    const id = reward?.bID ?? reward?.listing_id ?? reward?.id
    return id == null || id === '' ? undefined : buildLocalizedPath(lang, '/item/' + id)
  }

  const FILTERS = [
    { key: 'all', labelKey: 'item.filterAll', count: rewards.length },
    { key: 'limited', labelKey: 'item.filterLimited', count: rewards.filter((r) => r.limited).length },
    { key: 'highValue', labelKey: 'item.filterHighValue', count: rewards.filter((r) => r.rarity === 'epic').length },
    { key: 'claimed', labelKey: 'item.filterClaimed', count: rewards.filter((r) => r.status === 'claimed').length },
  ]
  const filteredRewards = rewards.filter((r) => {
    if (itemFilter === 'limited') return r.limited
    if (itemFilter === 'highValue') return r.rarity === 'epic'
    if (itemFilter === 'claimed') return r.status === 'claimed'
    return true
  })

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
      <div className="space-y-8" data-sf-m="home-item-list">
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
              {/* 发布入口（Kevin 裁定④）：原「查看奖励」→ 首页唯一列表的发布入口 `/item/new` */}
              <Link to={buildLocalizedPath(lang, '/item/new')} data-sf-m="home-publish-link">
                <Button variant="secondary" size="lg">{t('item.publish')}</Button>
              </Link>
            </div>
          </section>
        </FadeIn>

        {/* 「我的积分」（并入自 `RewardPage`；登录后渲染） */}
        {isAuthenticated && (
          <FadeIn>
            <Card variant="primary" className="max-w-md mx-auto" data-sf-m="home-my-points">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{t('item.myPoints')}</div>
                    <div className="text-2xl font-bold text-yellow-600">{userPoints}</div>
                  </div>
                  <div className="text-4xl">🪙</div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}

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
          <section data-sf-m="home-items">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('homePage.featuredRewards')}</h2>
              <p className="text-gray-600">{t('homePage.featuredLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>{t('homePage.featuredTail')}</p>
            </div>

            {/* 分类筛选（并入自 `RewardPage`）—— 计数随数据面实时派生（三档均可筛，见文件头判据） */}
            <div className="flex flex-wrap gap-2 mb-6" data-sf-m="home-item-filter" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={itemFilter === f.key}
                  className={`px-3 py-1.5 rounded-md text-sm border ${itemFilter === f.key ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'}`}
                  data-sf-filter={f.key}
                  onClick={() => setItemFilter(f.key)}
                >
                  {t(f.labelKey)} ({f.count})
                </button>
              ))}
            </div>

            {filteredRewards.length > 0 ? (
              <StaggerContainer>
                <ResponsiveGrid sm={1} md={2} lg={4} gap={6}>
                  {filteredRewards.map((reward, index) => (
                    <FadeIn key={reward.bID} delay={index * 100}>
                      <RewardCard
                        reward={reward}
                        to={rewardPath(reward)}
                        onClaim={handleRewardAction}
                        userPoints={userPoints}
                        showStatus={true}
                        actionLabelKey="item.viewDetail"
                      />
                    </FadeIn>
                  ))}
                </ResponsiveGrid>
              </StaggerContainer>
            ) : (
              <Card variant="inactive">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">{t('item.empty')}</p>
                </CardContent>
              </Card>
            )}
          </section>
        </SlideUp>

        {/* D7 变更（2026-10-14）：「我的订单」整块移出首页 —— 渲染点迁至 /profile 我的交易-我买到的
            （`./item/MyOrdersPanel` 保留复用；退款/发货/收货三写动作在 profile 侧仍可达，首页零死钩子）。 */}
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
