import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { RewardCard } from '../components/reward/RewardCard'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { fetchApiJson, getAuthHeaders } from '../auth'
import { useAuth } from '../auth-context'

const RewardPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [rewards, setRewards] = useState([])
  const [shardMap, setShardMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [taskProgress, setTaskProgress] = useState(null)
  const [taskDetail, setTaskDetail] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const [activeTab, setActiveTab] = useState('available')

  const params = new URLSearchParams(location.search)
  const q_jID = params.get('jID')
  const isTaskProgressMode = !!q_jID

  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  const buildPath = (path) => {
    const lang = getCurrentLang()
    return lang === 'zh' ? path : `/${lang}${path}`
  }

  const loadListMode = async () => {
    const lang = getCurrentLang()
    const brandRows = await fetchApiJson('/api/prize/all')

    let claimedBrandIds = new Set()
    let asset = { points: 0 }

    if (isAuthenticated && user?.uID) {
      const [prizeItems, assetRows, shardRows] = await Promise.all([
        fetchApiJson('/api/prize-item', { headers: getAuthHeaders(user) }).catch(() => []),
        fetchApiJson(`/api/user/asset/${user.uID}`).catch(() => ({ points: 0 })),
        // 四项确认 ④：`/api/shard` = 已 sunset 的碎片读口（恒空态 + 顶层 `deprecated:true`；§5.2 逐字
        //   「**禁止**新代码再调 `/api/shard`」）⇒ **移除调用**。迁移目标 `GET /api/user/points` **未注册**
        //   ⇒ 不迁、只留空态（`shardMap` 恒空，不臆造持仓/流水）。
        Promise.resolve([]),
      ])

      claimedBrandIds = new Set((prizeItems || []).map((prizeItem) => prizeItem.bID))
      asset = assetRows || asset
      const map = {}
      for (const h of shardRows || []) map[h.bID] = h.volume
      setShardMap(map)
    }

    setUserPoints(asset?.points || 0)

    const normalized = (brandRows || []).map((reward) => {
      const storesCount = reward.stores_count || 0
      const claimsCount = reward.claims_count || 0
      const isClaimed = claimedBrandIds.has(reward.bID)
      return {
        ...reward,
        title: lang === 'en'
          ? (reward.name_en ?? reward.name)
          : lang === 'hk'
            ? (reward.name_hk ?? reward.name)
            : lang === 'vn'
              ? (reward.name_vn ?? reward.name)
              : reward.name,
        description: lang === 'en'
          ? (reward.description_en ?? reward.description)
          : lang === 'hk'
            ? (reward.description_hk ?? reward.description)
            : lang === 'vn'
              ? (reward.description_vn ?? reward.description)
              : reward.description,
        points_required: reward.points || 0,
        image: reward.image_url || reward.url_image,
        brand: {
          name: reward.name,
          logo: reward.image_url || reward.url_image,
        },
        status: isClaimed ? 'claimed' : storesCount > 0 ? 'available' : 'locked',
        statusText: isClaimed ? '已兑换' : storesCount > 0 ? '可兑换' : '库存不足',
        rarity: reward.points > 5000 ? 'epic' : reward.points > 2000 ? 'rare' : 'common',
        claimed: claimsCount,
        total: claimsCount + storesCount,
        limited: Boolean(reward.gift_limit || reward.time_end),
      }
    })

    setRewards(normalized)
  }

  const loadTaskProgressMode = async () => {
    const nextTaskProgress = await fetchApiJson(`/api/task-progress/${Number(q_jID)}`)
    setTaskProgress(nextTaskProgress)
    if (nextTaskProgress?.tID) {
      const task = await fetchApiJson(`/api/task/${Number(nextTaskProgress.tID)}`).catch(() => null)
      setTaskDetail(task)
    }

    if (isAuthenticated && user?.uID) {
      const asset = await fetchApiJson(`/api/user/asset/${user.uID}`).catch(() => ({ points: 0 }))
      setUserPoints(asset?.points || 0)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (isTaskProgressMode) {
          await loadTaskProgressMode()
        } else {
          await loadListMode()
        }
      } catch (error) {
        console.error('Error loading rewards:', error)
        toast.error(`${t('error')}: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isAuthenticated, isTaskProgressMode, location.pathname, q_jID, t, user?.uID])

  const handleTaskProgressClaim = async () => {
    if (!taskProgress?.jID) return
    if (!isAuthenticated) {
      toast.error('请先登录')
      navigate('/login', { state: { from: location } })
      return
    }

    setClaiming(true)
    try {
      const result = await fetchApiJson(`/api/task-progress/claim/${taskProgress.jID}`, {
        method: 'POST',
        headers: getAuthHeaders(user),
      })
      setTaskProgress((prev) => ({ ...prev, ...result }))
      if (typeof result?.user_points_total === 'number') {
        setUserPoints(result.user_points_total)
      }
      toast.success(`奖励领取成功，获得 ${result?.reward_points || result?.points_claimed || 0} 积分`)
    } catch (error) {
      console.error('Error claiming task progress reward:', error)
      toast.error(`领取失败: ${error.message}`)
    } finally {
      setClaiming(false)
    }
  }

  const handleRewardClaim = (reward) => {
    if (!isAuthenticated) {
      toast.error('请先登录')
      navigate('/login', { state: { from: location } })
      return
    }

    if (reward.status === 'claimed') {
      toast('该奖励已在你的礼品记录中')
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

    toast('奖品兑换入口暂未开放，请联系管理员准备具体库存后再兑换。')
  }

  // ── 弃用面下线（P4-B4b-i · §2.4 **S5** / §5.2）─────────────────────────────────
  // `POST /api/shard/redeem`（原 `:196`）与 `POST /api/chest/:bID/open`（原 `:217`）两**写口**
  // 已由后端落为 **`410` + `R107` + `details.sunset`**（§5.1「碎片写口①」/「宝箱写口」行；**撤守卫**
  // ⇒ 无 token 亦 `410`）⇒ **前端不得再发起该调用**（判据 = §9.B **B5**「13 面前端零调用」）。
  // 处置 = **删调用 + 删 UI 分支**（不整页删）：碎片兑换在 `cid` 模型里无对应语义，等值动作 = 交易所
  // `trade` / `transfer`；宝箱「凭空调入余额」与 `DL5` 双分录正面冲突 ⇒ 二者**均无前端替代入口**。
  const renderRewardActions = () => null

  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载奖励..." />
      </ResponsiveContainer>
    )
  }

  if (isTaskProgressMode && taskProgress) {
    const rewardPoints = taskProgress.points_claimed || taskDetail?.points || 0
    const canClaim = Boolean(taskProgress.time_checked) && !taskProgress.time_claimed

    return (
      <ResponsiveContainer>
        <FadeIn>
          <div className="max-w-2xl mx-auto space-y-6">
            <Button
              variant="proceed"
              onClick={() => navigate(buildPath('/reward'))}
              className="mb-4"
            >
              ← 返回奖励列表
            </Button>

            <Card variant="primary">
              <CardHeader>
                <CardTitle className="text-2xl">任务奖励详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">任务信息</h3>
                  <p className="text-gray-600">{taskDetail?.title || `任务 #${taskProgress.tID}`}</p>
                  <p className="text-sm text-gray-500 mt-1">{taskDetail?.note || '暂无说明'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">完成进度</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: taskProgress.info_input ? '100%' : '0%' }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">
                      {taskProgress.time_claimed ? '已领取' : taskProgress.time_checked ? '可领取' : taskProgress.info_input ? '审核中' : '进行中'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">可获得积分</h3>
                  <div className="text-3xl font-bold text-yellow-600">{rewardPoints}</div>
                  <div className="text-sm text-gray-500">积分</div>
                </div>

                {taskProgress.time_claimed ? (
                  <div className="text-center py-4">
                    <Badge variant="success" size="lg">已领取</Badge>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={!canClaim || claiming}
                    onClick={handleTaskProgressClaim}
                  >
                    {claiming ? '领取中...' : canClaim ? '领取奖励' : '待管理员审核'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      </ResponsiveContainer>
    )
  }

  const availableRewards = rewards.filter((reward) => reward.status === 'available')
  const claimedRewards = rewards.filter((reward) => reward.status === 'claimed')
  const limitedRewards = rewards.filter((reward) => reward.limited)
  const epicRewards = rewards.filter((reward) => reward.rarity === 'epic')

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">奖励中心</h1>
            <p className="text-xl text-gray-600 mb-8">用积分兑换精彩礼品和特权</p>

            {isAuthenticated && (
              <Card variant="primary" className="max-w-md mx-auto">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">我的积分</div>
                      <div className="text-2xl font-bold text-yellow-600">{userPoints}</div>
                    </div>
                    <div className="text-4xl">🪙</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </FadeIn>

        <SlideUp delay={200}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <Card variant="primary" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-yellow-600">{availableRewards.length}</div>
                <div className="text-sm text-gray-600">可兑换</div>
              </CardContent>
            </Card>
            <Card variant="success" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-green-600">{claimedRewards.length}</div>
                <div className="text-sm text-gray-600">已兑换</div>
              </CardContent>
            </Card>
            <Card variant="warning" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-orange-600">{limitedRewards.length}</div>
                <div className="text-sm text-gray-600">限量版</div>
              </CardContent>
            </Card>
            <Card variant="secondary" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-blue-600">{epicRewards.length}</div>
                <div className="text-sm text-gray-600">高价值</div>
              </CardContent>
            </Card>
          </div>
        </SlideUp>

        <SlideUp delay={400}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">可兑换 ({availableRewards.length})</TabsTrigger>
              <TabsTrigger value="limited">限量版 ({limitedRewards.length})</TabsTrigger>
              <TabsTrigger value="epic">高价值 ({epicRewards.length})</TabsTrigger>
              <TabsTrigger value="claimed">已兑换 ({claimedRewards.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-6">
              {availableRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} xl={4} gap={6}>
                    {availableRewards.map((reward, index) => (
                      <FadeIn key={reward.bID} delay={index * 100}>
                        <RewardCard reward={reward} onClaim={handleRewardClaim} userPoints={userPoints} showStatus={true} />
                        {renderRewardActions(reward)}
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">🎁</div>
                      <p className="text-lg">暂无可兑换奖励</p>
                      <p className="text-sm mt-2">完成任务赚取积分来解锁奖励</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="limited" className="space-y-6">
              {limitedRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {limitedRewards.map((reward, index) => (
                      <FadeIn key={reward.bID} delay={index * 100}>
                        <RewardCard reward={reward} onClaim={handleRewardClaim} userPoints={userPoints} showStatus={true} />
                        {renderRewardActions(reward)}
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">⏰</div>
                      <p className="text-lg">暂无限量版奖励</p>
                      <p className="text-sm mt-2">限时或限额奖励会在库存准备好后出现</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="epic" className="space-y-6">
              {epicRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {epicRewards.map((reward, index) => (
                      <FadeIn key={reward.bID} delay={index * 100}>
                        <RewardCard reward={reward} onClaim={handleRewardClaim} userPoints={userPoints} showStatus={true} />
                        {renderRewardActions(reward)}
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">👑</div>
                      <p className="text-lg">暂无高价值奖励</p>
                      <p className="text-sm mt-2">高价值奖励会在库存准备好后开放兑换</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="claimed" className="space-y-6">
              {claimedRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {claimedRewards.map((reward, index) => (
                      <FadeIn key={reward.bID} delay={index * 100}>
                        <RewardCard reward={reward} onClaim={() => {}} userPoints={userPoints} showStatus={true} />
                      </FadeIn>
                    ))}
                  </ResponsiveGrid>
                </StaggerContainer>
              ) : (
                <Card variant="inactive">
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">📋</div>
                      <p className="text-lg">暂无已兑换奖励</p>
                      <p className="text-sm mt-2">兑换记录会显示在这里</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </SlideUp>
      </div>
    </ResponsiveContainer>
  )
}

export default RewardPage
