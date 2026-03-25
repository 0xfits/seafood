import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// 新的 UI 组件
import { Container, Grid } from '../components/layout'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { RewardCard } from '../components/reward/RewardCard'
import { LoadingPage, LoadingCard } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'

const RewardPage = () => {
  const { t } = useTranslation()
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [journey, setJourney] = useState(null)
  const [taskDetail, setTaskDetail] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const [activeTab, setActiveTab] = useState('available')

  // 初始化用户
  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { 
        const user = JSON.parse(stored)
        setCurrentUser(user)
        // 模拟用户积分，实际应从后端获取
        setUserPoints(user.points || 1000)
      } catch {}
    }
  }, [])

  // 检查是否为旅程详情模式
  const params = new URLSearchParams(location.search)
  const q_jID = params.get('jID')
  const q_uID = params.get('uID')
  const isJourneyMode = !!q_jID

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 构建带语言前缀的路径
  const buildPath = (path) => {
    const lang = getCurrentLang()
    return lang === 'zh' ? path : `/${lang}${path}`
  }

  // 加载数据
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (isJourneyMode) {
          // 加载旅程详情
          const resp = await fetch(`/api/journey/${Number(q_jID)}`)
          const data = await resp.json()
          if (data.success && data.data) {
            setJourney(data.data)
            // 加载任务详情以获取积分
            const tResp = await fetch(`/api/task/${Number(data.data.tID)}`)
            const tData = await tResp.json()
            if (tData.success) setTaskDetail(tData.data)
          } else {
            toast.error(t('error') + ': ' + (data.error || '加载旅程失败'))
          }
        } else {
          // 奖励列表模式
          const response = await fetch('/api/brand/all')
          const data = await response.json()
          if (data.success) {
            const lang = getCurrentLang()
            const enrichedGifts = (data.data || []).map(gift => ({
              ...gift,
              title: lang === 'en' ? (gift.name_en ?? gift.name) : 
                     lang === 'hk' ? (gift.name_hk ?? gift.name) : 
                     lang === 'vn' ? (gift.name_vn ?? gift.name) : gift.name,
              description: lang === 'en' ? (gift.description_en ?? gift.description) : 
                          lang === 'hk' ? (gift.description_hk ?? gift.description) : 
                          lang === 'vn' ? (gift.description_vn ?? gift.description) : gift.description,
              points_required: gift.points || 0,
              image: gift.url_image,
              brand: {
                name: gift.name,
                logo: gift.url_image
              },
              status: 'available',
              statusText: '可领取',
              rarity: gift.points > 5000 ? 'epic' : gift.points > 2000 ? 'rare' : 'common',
              claimed: Math.floor(Math.random() * 50),
              total: 100,
              limited: gift.time_end ? true : false,
              discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30 + 10) : null
            }))
            setGifts(enrichedGifts)
          } else {
            toast.error(t('error') + ': ' + (data.error || '加载奖励失败'))
          }
        }
      } catch (error) {
        console.error('Error loading:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [t, isJourneyMode, q_jID])

  // 处理奖励领取
  const handleRewardClaim = (reward) => {
    if (!currentUser) {
      toast.error('请先登录')
      navigate(buildPath('/login'))
      return
    }

    if (userPoints < reward.points_required) {
      toast.error('积分不足')
      return
    }

    setClaiming(true)
    
    // 模拟领取过程
    setTimeout(() => {
      setClaiming(false)
      toast.success(`成功领取 ${reward.title}！`)
      // 更新用户积分
      setUserPoints(prev => prev - reward.points_required)
    }, 2000)
  }

  // 如果正在加载，显示加载页面
  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载奖励..." />
      </ResponsiveContainer>
    )
  }

  // 旅程详情模式
  if (isJourneyMode && journey) {
    return (
      <ResponsiveContainer>
        <FadeIn>
          <div className="max-w-2xl mx-auto space-y-6">
            <Button 
              variant="proceed" 
              onClick={() => navigate(buildPath('/rewards'))}
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
                  <p className="text-gray-600">{taskDetail?.title || '未知任务'}</p>
                  <p className="text-sm text-gray-500 mt-1">{taskDetail?.note}</p>
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
                      {journey.info_input ? '已完成' : '进行中'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-2">可获得积分</h3>
                  <div className="text-3xl font-bold text-yellow-600">
                    {journey.points_claimed || taskDetail?.points || 0}
                  </div>
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
                    disabled={!journey.info_input || claiming}
                    onClick={() => {
                      // 领取逻辑
                      toast.success('奖励领取成功！')
                    }}
                  >
                    {claiming ? '领取中...' : '领取奖励'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      </ResponsiveContainer>
    )
  }

  // 奖励分类
  const availableRewards = gifts.filter(g => g.status === 'available')
  const claimedRewards = gifts.filter(g => g.status === 'claimed')
  const limitedRewards = gifts.filter(g => g.limited)
  const epicRewards = gifts.filter(g => g.rarity === 'epic')

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        {/* 页面标题 */}
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              奖励中心
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              用积分兑换精彩礼品和特权
            </p>
            
            {/* 用户积分信息 */}
            {currentUser && (
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

        {/* 奖励统计 */}
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
                <div className="text-sm text-gray-600">史诗级</div>
              </CardContent>
            </Card>
          </div>
        </SlideUp>

        {/* 奖励标签页 */}
        <SlideUp delay={400}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available">可兑换 ({availableRewards.length})</TabsTrigger>
              <TabsTrigger value="limited">限量版 ({limitedRewards.length})</TabsTrigger>
              <TabsTrigger value="epic">史诗级 ({epicRewards.length})</TabsTrigger>
              <TabsTrigger value="claimed">已兑换 ({claimedRewards.length})</TabsTrigger>
            </TabsList>

            {/* 可兑换奖励 */}
            <TabsContent value="available" className="space-y-6">
              {availableRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} xl={4} gap={6}>
                    {availableRewards.map((reward, index) => (
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

            {/* 限量版奖励 */}
            <TabsContent value="limited" className="space-y-6">
              {limitedRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {limitedRewards.map((reward, index) => (
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
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">⏰</div>
                      <p className="text-lg">暂无限量版奖励</p>
                      <p className="text-sm mt-2">限时奖励会不定期推出</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 史诗级奖励 */}
            <TabsContent value="epic" className="space-y-6">
              {epicRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {epicRewards.map((reward, index) => (
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
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <div className="text-6xl mb-4">👑</div>
                      <p className="text-lg">暂无史诗级奖励</p>
                      <p className="text-sm mt-2">高价值奖励需要更多积分</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 已兑换奖励 */}
            <TabsContent value="claimed" className="space-y-6">
              {claimedRewards.length > 0 ? (
                <StaggerContainer>
                  <ResponsiveGrid sm={1} md={2} lg={3} gap={6}>
                    {claimedRewards.map((reward, index) => (
                      <FadeIn key={reward.bID} delay={index * 100}>
                        <RewardCard 
                          reward={{
                            ...reward,
                            status: 'claimed',
                            statusText: '已兑换'
                          }} 
                          onClaim={() => {}}
                          userPoints={userPoints}
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
                      <p className="text-lg">暂无已兑换奖励</p>
                      <p className="text-sm mt-2">兑换的奖励会显示在这里</p>
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
