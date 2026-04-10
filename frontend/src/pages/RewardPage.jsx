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
  const [gifts, setGifts] = useState([])
  const [shardMap, setShardMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [journey, setJourney] = useState(null)
  const [taskDetail, setTaskDetail] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [openingChestId, setOpeningChestId] = useState(null)
  const [userPoints, setUserPoints] = useState(0)
  const [activeTab, setActiveTab] = useState('available')

  const params = new URLSearchParams(location.search)
  const q_jID = params.get('jID')
  const isJourneyMode = !!q_jID

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
      const [giftRows, assetRows, shardRows] = await Promise.all([
        fetchApiJson('/api/gift', { headers: getAuthHeaders(user) }).catch(() => []),
        fetchApiJson(`/api/user/asset/${user.uID}`).catch(() => ({ points: 0 })),
        fetchApiJson('/api/shard', { headers: getAuthHeaders(user) }).catch(() => []),
      ])

      claimedBrandIds = new Set((giftRows || []).map((gift) => gift.bID))
      asset = assetRows || asset
      const map = {}
      for (const h of shardRows || []) map[h.bID] = h.volume
      setShardMap(map)
    }

    setUserPoints(asset?.points || 0)

    const normalized = (brandRows || []).map((gift) => {
      const storesCount = gift.stores_count || 0
      const claimsCount = gift.claims_count || 0
      const isClaimed = claimedBrandIds.has(gift.bID)
      return {
        ...gift,
        title: lang === 'en'
          ? (gift.name_en ?? gift.name)
          : lang === 'hk'
            ? (gift.name_hk ?? gift.name)
            : lang === 'vn'
              ? (gift.name_vn ?? gift.name)
              : gift.name,
        description: lang === 'en'
          ? (gift.description_en ?? gift.description)
          : lang === 'hk'
            ? (gift.description_hk ?? gift.description)
            : lang === 'vn'
              ? (gift.description_vn ?? gift.description)
              : gift.description,
        points_required: gift.points || 0,
        image: gift.image_url || gift.url_image,
        brand: {
          name: gift.name,
          logo: gift.image_url || gift.url_image,
        },
        status: isClaimed ? 'claimed' : storesCount > 0 ? 'available' : 'locked',
        statusText: isClaimed ? '已兑换' : storesCount > 0 ? '可兑换' : '库存不足',
        rarity: gift.points > 5000 ? 'epic' : gift.points > 2000 ? 'rare' : 'common',
        claimed: claimsCount,
        total: claimsCount + storesCount,
        limited: Boolean(gift.gift_limit || gift.time_end),
      }
    })

    setGifts(normalized)
  }

  const loadJourneyMode = async () => {
    const nextJourney = await fetchApiJson(`/api/journey/${Number(q_jID)}`)
    setJourney(nextJourney)
    if (nextJourney?.tID) {
      const task = await fetchApiJson(`/api/task/${Number(nextJourney.tID)}`).catch(() => null)
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
        if (isJourneyMode) {
          await loadJourneyMode()
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
  }, [isAuthenticated, isJourneyMode, location.pathname, q_jID, t, user?.uID])

  const handleJourneyClaim = async () => {
    if (!journey?.jID) return
    if (!isAuthenticated) {
      toast.error('请先登录')
      navigate('/login', { state: { from: location } })
      return
    }

    setClaiming(true)
    try {
      const result = await fetchApiJson(`/api/journey/claim/${journey.jID}`, {
        method: 'POST',
        headers: getAuthHeaders(user),
      })
      setJourney((prev) => ({ ...prev, ...result }))
      if (typeof result?.user_points_total === 'number') {
        setUserPoints(result.user_points_total)
      }
      toast.success(`奖励领取成功，获得 ${result?.reward_points || result?.points_claimed || 0} 积分`)
    } catch (error) {
      console.error('Error claiming journey reward:', error)
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

  const handleRedeem = async (bID) => {
    try {
      await fetchApiJson('/api/shard/redeem', {
        method: 'POST',
        headers: getAuthHeaders(user),
        body: JSON.stringify({ bID }),
      })
      toast.success('碎片兑换成功！')
      await loadListMode()
    } catch (error) {
      toast.error(`兑换失败: ${error.message}`)
    }
  }

  const handleOpenChest = async (reward) => {
    if (!isAuthenticated) {
      toast.error('请先登录')
      navigate('/login', { state: { from: location } })
      return
    }

    setOpeningChestId(reward.bID)
    try {
      const result = await fetchApiJson(`/api/chest/${reward.bID}/open`, {
        method: 'POST',
        headers: getAuthHeaders(user),
      })
      toast.success(`宝箱开启成功，获得 ${result?.shards_awarded || 0} 个碎片`)
      await loadListMode()
    } catch (error) {
      toast.error(`开箱失败: ${error.message}`)
    } finally {
      setOpeningChestId(null)
    }
  }

  const renderRewardActions = (reward) => (
    <>
      {isAuthenticated && reward.market_is_open && (reward.free_shards_remaining || 0) > 0 && (
        <div className="mt-2 space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            免费碎片宝箱剩余 {reward.free_shards_remaining} 个碎片
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
            onClick={() => handleOpenChest(reward)}
            disabled={openingChestId === reward.bID}
          >
            {openingChestId === reward.bID ? '开箱中...' : '开启随机碎片宝箱'}
          </Button>
        </div>
      )}
      {isAuthenticated && shardMap[reward.bID] >= 1000 && (
        <div className="mt-2">
          <Button
            variant="proceed"
            size="sm"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => handleRedeem(reward.bID)}
          >
            兑换奖品 (1000 碎片)
          </Button>
        </div>
      )}
    </>
  )

  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载奖励..." />
      </ResponsiveContainer>
    )
  }

  if (isJourneyMode && journey) {
    const rewardPoints = journey.points_claimed || taskDetail?.points || 0
    const canClaim = Boolean(journey.time_checked) && !journey.time_claimed

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
                  <p className="text-gray-600">{taskDetail?.title || `任务 #${journey.tID}`}</p>
                  <p className="text-sm text-gray-500 mt-1">{taskDetail?.note || '暂无说明'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">完成进度</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: journey.info_input ? '100%' : '0%' }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">
                      {journey.time_claimed ? '已领取' : journey.time_checked ? '可领取' : journey.info_input ? '审核中' : '进行中'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">可获得积分</h3>
                  <div className="text-3xl font-bold text-yellow-600">{rewardPoints}</div>
                  <div className="text-sm text-gray-500">积分</div>
                </div>

                {journey.time_claimed ? (
                  <div className="text-center py-4">
                    <Badge variant="success" size="lg">已领取</Badge>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={!canClaim || claiming}
                    onClick={handleJourneyClaim}
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

  const availableRewards = gifts.filter((gift) => gift.status === 'available')
  const claimedRewards = gifts.filter((gift) => gift.status === 'claimed')
  const limitedRewards = gifts.filter((gift) => gift.limited)
  const epicRewards = gifts.filter((gift) => gift.rarity === 'epic')

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
