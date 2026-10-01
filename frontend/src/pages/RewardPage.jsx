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
import { getLanguageFromUrl } from '../utils'
import { contentStatus, pickLocalized } from '../i18n-content'
import TranslatingBadge from '../components/i18n/TranslatingBadge'

const RewardPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  // P6-I18N-LIT-B2：语言码走 utils 单一来源（原本地 `getCurrentLang` 复刻 ⇒ 删）。
  const lang = getLanguageFromUrl(location.pathname)
  const [rewards, setRewards] = useState([])
  const [shardMap, setShardMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [taskProgress, setTaskProgress] = useState(null)
  const [taskDetail, setTaskDetail] = useState(null)
  const [userPoints, setUserPoints] = useState(0)
  const [activeTab, setActiveTab] = useState('available')

  const params = new URLSearchParams(location.search)
  const q_jID = params.get('jID')
  const isTaskProgressMode = !!q_jID

  const buildPath = (path) => (lang === 'zh' ? path : `/${lang}${path}`)

  const loadListMode = async () => {
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
        // P6-I18N-LIT-B2：内容本地化收口为共用 `pickLocalized`（`||` 语义、防空串穿透）；
        //   原旧式三目链（`_en` 配 `??` 兜底）删除 —— `??` 会被空串穿透 ⇒ 卡片空白。
        title: pickLocalized(reward, 'name', lang),
        description: pickLocalized(reward, 'description', lang),
        points_required: reward.points || 0,
        image: reward.image_url || reward.url_image,
        brand: {
          // P6-I18N-LIT-B2：品牌/奖品名同为 UGC ⇒ 一并走 `pickLocalized`（en 档不得回显中文原名）
          name: pickLocalized(reward, 'name', lang),
          logo: reward.image_url || reward.url_image,
        },
        status: isClaimed ? 'claimed' : storesCount > 0 ? 'available' : 'locked',
        statusText: isClaimed
          ? t('common.redeemed')
          : storesCount > 0
            ? t('CanClaim')
            : t('common.outOfStock'),
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

  // P6-B5-CLAIM（批 5 = sunset）：`POST /api/task-progress/claim/:jID` 已退役（后端恒 `410` + `details.reason='CLAIM_RETIRED'`）。
  // ⇒ 前端**零调用**该端点（判据 = §9.B「弃用面前端零调用」；与 `shard/redeem` / `chest` 同先例）。
  // 处置 = **删调用 + 删 UI 分支**（就地显示「已下线」，四语键 `claimRetiredNotice`；不整页删）；
  // 奖励/积分发放唯一路径 = A1 管理员调分（已接账本 `mint`/`burn`）⇒ 无功能缺口。

  const handleRewardClaim = (reward) => {
    if (!isAuthenticated) {
      toast.error(t('pleaseLogin'))
      navigate('/login', { state: { from: location } })
      return
    }

    if (reward.status === 'claimed') {
      toast(t('rewardPage.alreadyInGiftRecord'))
      return
    }

    if (reward.status !== 'available') {
      toast.error(t('rewardPage.rewardOutOfStock'))
      return
    }

    if (userPoints < reward.points_required) {
      toast.error(t('common.notEnoughPoints'))
      return
    }

    toast(t('rewardPage.redeemNotOpen'))
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
        <LoadingPage message={t('common.loadingRewards')} />
      </ResponsiveContainer>
    )
  }

  if (isTaskProgressMode && taskProgress) {
    const rewardPoints = taskProgress.points_claimed || taskDetail?.points || 0
    const detailTitle = pickLocalized(taskDetail, 'title', lang) || t('rewardPage.taskNumber', { id: taskProgress.tID })
    const detailNote = pickLocalized(taskDetail, 'note', lang)

    return (
      <ResponsiveContainer>
        <FadeIn>
          <div className="max-w-2xl mx-auto space-y-6">
            <Button
              variant="proceed"
              onClick={() => navigate(buildPath('/reward'))}
              className="mb-4"
            >
              {t('rewardPage.backToList')}
            </Button>

            <Card variant="primary">
              <CardHeader>
                <CardTitle className="text-2xl">{t('rewardPage.detailTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {t('rewardPage.taskInfo')}
                    {/* 「翻译中」小标（TR-2）：`i18n_status ∈ {pending, partial}` 且非 zh 档才渲染 */}
                    <TranslatingBadge status={contentStatus(taskDetail)} />
                  </h3>
                  <p className="text-gray-600">{detailTitle}</p>
                  <p className="text-sm text-gray-500 mt-1">{detailNote || t('rewardPage.noNote')}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">{t('rewardPage.progress')}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: taskProgress.info_input ? '100%' : '0%' }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">
                      {taskProgress.time_claimed
                        ? t('common.claimed')
                        : taskProgress.time_checked
                          ? t('common.claimable')
                          : taskProgress.info_input
                            ? t('common.underReview')
                            : t('common.ongoing')}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">{t('rewardPage.pointsAvailable')}</h3>
                  <div className="text-3xl font-bold text-yellow-600">{rewardPoints}</div>
                  <div className="text-sm text-gray-500">{t('common.points')}</div>
                </div>

                {taskProgress.time_claimed ? (
                  <div className="text-center py-4">
                    <Badge variant="success" size="lg">{t('common.claimed')}</Badge>
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">{t('claimRetiredNotice')}</div>
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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('rewardPage.title')}</h1>
            <p className="text-xl text-gray-600 mb-8">{t('rewardPage.subtitle')}</p>

            {isAuthenticated && (
              <Card variant="primary" className="max-w-md mx-auto">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">{t('rewardPage.myPoints')}</div>
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
                <div className="text-sm text-gray-600">{t('CanClaim')}</div>
              </CardContent>
            </Card>
            <Card variant="success" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-green-600">{claimedRewards.length}</div>
                <div className="text-sm text-gray-600">{t('common.redeemed')}</div>
              </CardContent>
            </Card>
            <Card variant="warning" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-orange-600">{limitedRewards.length}</div>
                <div className="text-sm text-gray-600">{t('rewardPage.limitedEdition')}</div>
              </CardContent>
            </Card>
            <Card variant="secondary" className="text-center">
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-blue-600">{epicRewards.length}</div>
                <div className="text-sm text-gray-600">{t('rewardPage.highValue')}</div>
              </CardContent>
            </Card>
          </div>
        </SlideUp>

        <SlideUp delay={400}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">{t('CanClaim')} ({availableRewards.length})</TabsTrigger>
              <TabsTrigger value="limited">{t('rewardPage.limitedEdition')} ({limitedRewards.length})</TabsTrigger>
              <TabsTrigger value="epic">{t('rewardPage.highValue')} ({epicRewards.length})</TabsTrigger>
              <TabsTrigger value="claimed">{t('common.redeemed')} ({claimedRewards.length})</TabsTrigger>
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
                      <p className="text-lg">{t('rewardPage.emptyAvailable')}</p>
                      <p className="text-sm mt-2">{t('rewardPage.emptyAvailableHint')}</p>
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
                      <p className="text-lg">{t('rewardPage.emptyLimited')}</p>
                      <p className="text-sm mt-2">{t('rewardPage.emptyLimitedHint')}</p>
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
                      <p className="text-lg">{t('rewardPage.emptyHighValue')}</p>
                      <p className="text-sm mt-2">{t('rewardPage.emptyHighValueHint')}</p>
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
                      <p className="text-lg">{t('rewardPage.emptyClaimed')}</p>
                      <p className="text-sm mt-2">{t('rewardPage.emptyClaimedHint')}</p>
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
