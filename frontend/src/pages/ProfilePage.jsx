import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, Mail, Calendar, Trophy, Star, Edit3, Save, X } from 'lucide-react'

// 新的 UI 组件
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'
import { formatEvmAddress } from '../utils'
import { fetchApiJson, fetchCurrentUser, getAuthHeaders, updateMyProfile } from '../auth'
import { useAuth } from '../auth-context'

const ProfilePage = () => {
  const navigate = useNavigate()
  const { isAuthenticated, updateSession, user: sessionUser } = useAuth()
  const [user, setUser] = useState(null)
  const [userAssets, setUserAssets] = useState(null)
  const [taskStats, setTaskStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    pendingRewards: 0,
    totalPoints: 0,
    claimedRewards: 0,
  })
  const [shardHoldings, setShardHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [tempBio, setTempBio] = useState('')

  // 加载用户信息和任务统计
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!isAuthenticated) {
        setUser(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const profile = await fetchCurrentUser(sessionUser)
        if (!profile) {
          setUser(null)
          return
        }

        const nextProfile = updateSession(profile)
        setUser(nextProfile)
        setBio(nextProfile.bio || '')
        setTempBio(nextProfile.bio || '')
        
        await Promise.all([
          loadUserAssets(nextProfile.uID),
          loadTaskStats(nextProfile.uID),
          loadShardHoldings(),
        ])
      } catch (error) {
        console.error('Error loading user info:', error)
        toast.error('加载用户信息失败: ' + error.message)
      } finally {
        setLoading(false)
      }
    }

    loadUserInfo()
  }, [isAuthenticated, sessionUser?.uID])

  // 加载用户资产
  const loadUserAssets = async (uID) => {
    try {
      const asset = await fetchApiJson(`/api/user/asset/${uID}`)
      setUserAssets(asset)
    } catch (error) {
      console.warn('Failed to load user assets:', error)
      setUserAssets({
        points: 0,
        time_update: null,
      })
    }
  }

  // 加载碎片持仓
  const loadShardHoldings = async () => {
    try {
      const headers = getAuthHeaders(sessionUser)
      const result = await fetchApiJson('/api/shard', { headers })
      setShardHoldings(result ?? [])
    } catch (error) {
      console.warn('Failed to load shard holdings:', error)
      setShardHoldings([])
    }
  }

  // 加载任务统计
  const loadTaskStats = async (uID) => {
    try {
      const headers = getAuthHeaders(sessionUser)
      const [journeys, gifts] = await Promise.all([
        fetchApiJson('/api/journey', { headers }),
        fetchApiJson('/api/gift', { headers }).catch(() => []),
      ])

      const stats = {
        totalTasks: (journeys || []).length,
        completedTasks: 0,
        pendingTasks: 0,
        pendingRewards: 0,
        totalPoints: 0,
        claimedRewards: (gifts || []).length,
      }

      for (const j of journeys || []) {
        if (j.time_claimed) {
          stats.completedTasks++
          stats.totalPoints += j.points_claimed || 0
        } else if (j.time_checked) {
          stats.pendingRewards++
        } else {
          stats.pendingTasks++
        }
      }

      setTaskStats(stats)
    } catch (error) {
      console.warn('Failed to load task stats:', error)
      setTaskStats({
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        pendingRewards: 0,
        totalPoints: 0,
        claimedRewards: 0,
      })
    }
  }

  // 保存用户简介
  const saveBio = async () => {
    try {
      const nextBio = tempBio.trim()
      if (nextBio.length < 10) {
        toast.error('请至少填写 10 个字的个人简介')
        return
      }

      const updatedUser = await updateMyProfile({ bio: nextBio }, sessionUser)
      const nextUser = updateSession(updatedUser)
      setUser(nextUser)
      setBio(nextUser.bio || nextBio)
      setTempBio(nextUser.bio || nextBio)
      setIsEditing(false)
      toast.success('简介保存成功')
    } catch (error) {
      toast.error('保存失败: ' + error.message)
    }
  }

  // 取消编辑
  const cancelEdit = () => {
    setTempBio(bio)
    setIsEditing(false)
  }

  // 如果正在加载，显示加载页面
  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载用户信息..." />
      </ResponsiveContainer>
    )
  }

  if (!user) {
    return (
      <ResponsiveContainer>
        <Card variant="inactive">
          <CardContent className="text-center py-12">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-4">请先登录</p>
            <Button variant="primary" onClick={() => navigate('/login')}>
              去登录
            </Button>
          </CardContent>
        </Card>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        {/* 页面标题 */}
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              个人中心
            </h1>
            <p className="text-xl text-gray-600">
              管理你的账户信息和查看成就
            </p>
          </div>
        </FadeIn>

        {/* 用户基本信息 */}
        <SlideUp delay={200}>
          <Card variant="primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">基本信息</CardTitle>
                {!isEditing ? (
                  <Button 
                    variant="proceed" 
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={saveBio}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      保存
                    </Button>
                    <Button 
                      variant="inactive" 
                      size="sm"
                      onClick={cancelEdit}
                    >
                      <X className="w-4 h-4 mr-1" />
                      取消
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 用户头像和基本信息 */}
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user.EVM ? user.EVM.slice(2, 4).toUpperCase() : 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {user.EVM ? formatEvmAddress(user.EVM) : '未知用户'}
                    </h2>
                    {user.is_admin && (
                      <Badge variant="warning" size="sm">管理员</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      注册时间: {user.time_reg ? new Date(user.time_reg).toLocaleDateString() : '未知'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      钱包地址: {user.EVM ? formatEvmAddress(user.EVM) : '未设置'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 用户简介 */}
              <div>
                <h3 className="font-semibold text-lg mb-2">个人简介</h3>
                {isEditing ? (
                  <textarea
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-500 focus:outline-none resize-none"
                    rows={4}
                    placeholder="介绍一下你自己..."
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg min-h-[100px]">
                    {bio || '这个人很懒，什么都没有留下...'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 用户资产 */}
        <SlideUp delay={400}>
          <Card variant="secondary">
            <CardHeader>
              <CardTitle className="text-2xl">我的资产</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={2} md={4} gap={4}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {userAssets?.points || 0}
                  </div>
                  <div className="text-sm text-gray-600">积分</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {taskStats.pendingRewards}
                  </div>
                  <div className="text-sm text-gray-600">待领取</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {taskStats.claimedRewards}
                  </div>
                  <div className="text-sm text-gray-600">已兑换奖励</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {userAssets?.time_update ? new Date(userAssets.time_update).toLocaleDateString() : '—'}
                  </div>
                  <div className="text-sm text-gray-600">最近更新</div>
                </div>
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 任务统计 */}
        <SlideUp delay={600}>
          <Card variant="success">
            <CardHeader>
              <CardTitle className="text-2xl">任务成就</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={2} md={4} gap={4}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {taskStats.totalTasks}
                  </div>
                  <div className="text-sm text-gray-600">总任务</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {taskStats.completedTasks}
                  </div>
                  <div className="text-sm text-gray-600">已完成</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-1">
                    {taskStats.pendingTasks}
                  </div>
                  <div className="text-sm text-gray-600">进行中</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {taskStats.totalPoints}
                  </div>
                  <div className="text-sm text-gray-600">总积分</div>
                </div>
              </ResponsiveGrid>
              
              {/* 成就徽章 */}
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">成就徽章</h3>
                <div className="flex flex-wrap gap-2">
                  {taskStats.completedTasks >= 1 && (
                    <Badge variant="success" className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      新手
                    </Badge>
                  )}
                  {taskStats.completedTasks >= 5 && (
                    <Badge variant="primary" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      达人
                    </Badge>
                  )}
                  {taskStats.completedTasks >= 10 && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      专家
                    </Badge>
                  )}
                  {taskStats.totalPoints >= 1000 && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      积分达人
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 碎片持仓 */}
        <SlideUp delay={800}>
          <Card variant="inactive">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">碎片持仓</CardTitle>
                <Link to="/shard" className="text-sm text-blue-600 hover:text-blue-800 underline">
                  去交易
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {shardHoldings.length === 0 ? (
                <p className="text-center text-gray-500 py-4">暂无持仓</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {shardHoldings.map((h) => (
                    <div key={h.bID} className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-800">{h.symbol || h.bID}</span>
                      <span className="text-gray-600">{h.volume} 碎片</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </SlideUp>
      </div>
    </ResponsiveContainer>
  )
}

export default ProfilePage
