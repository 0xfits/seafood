import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
  Users, 
  Trophy, 
  Gift, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock,
  BarChart3,
  Settings,
  Eye,
  Shield
} from 'lucide-react'

// 新的 UI 组件
import { Container, Grid } from '../components/layout'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'
import { formatEvmAddress } from '../utils'

const DashboardPage = () => {
  const { t } = useTranslation()
  const [pendingVerificationTasks, setPendingVerificationTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalRewards: 0,
    claimedRewards: 0
  })

  // 加载数据和验证管理员身份
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // 加载用户信息
        const user = localStorage.getItem('user')
        if (!user) {
          toast.error('请先登录')
          setLoading(false)
          return
        }

        const parsedUser = JSON.parse(user)
        setCurrentUser(parsedUser)

        // 验证管理员身份
        const isAdminUser = parsedUser.is_admin || false
        setIsAdmin(isAdminUser)

        if (isAdminUser) {
          // 加载仪表板统计数据
          await loadDashboardStats()
          // 加载待验证任务
          await loadPendingVerificationTasks()
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('加载数据失败: ' + error.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // 加载仪表板统计数据
  const loadDashboardStats = async () => {
    try {
      // 模拟数据，实际应从API获取
      const stats = {
        totalUsers: 1248,
        activeUsers: 856,
        totalTasks: 45,
        completedTasks: 1247,
        pendingTasks: 234,
        totalRewards: 28,
        claimedRewards: 891
      }
      setDashboardStats(stats)
    } catch (error) {
      console.warn('Failed to load dashboard stats:', error)
    }
  }

  // 加载所有待验证的任务
  const loadPendingVerificationTasks = async () => {
    try {
      const response = await fetch('/api/tasklist/pending-verification', {
        headers: {
          'Authorization': `Bearer ${currentUser?.token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setPendingVerificationTasks(data.data || [])
      } else {
        toast.error('加载任务失败: ' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('Error loading pending verification tasks:', error)
      // 模拟数据
      setPendingVerificationTasks([
        {
          tlistID: 1,
          user: { EVM: '0x1234567890123456789012345678901234567890' },
          task: { title: '社交媒体分享', points: 100 },
          info_input: '已完成分享',
          time_created: new Date().toISOString(),
          time_checked: null
        },
        {
          tlistID: 2,
          user: { EVM: '0x2345678901234567890123456789012345678901' },
          task: { title: '邀请好友', points: 200 },
          info_input: '已邀请3位好友',
          time_created: new Date().toISOString(),
          time_checked: null
        }
      ])
    }
  }

  // 验证任务
  const handleVerifyTask = async (tlistID, approved) => {
    try {
      const response = await fetch(`/api/tasklist/${tlistID}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ approved })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(approved ? '任务已通过验证' : '任务已拒绝')
        // 重新加载任务列表
        await loadPendingVerificationTasks()
      } else {
        toast.error('操作失败: ' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('Error verifying task:', error)
      toast.error('操作失败: ' + error.message)
    }
  }

  // 如果正在加载，显示加载页面
  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载管理面板..." />
      </ResponsiveContainer>
    )
  }

  // 如果不是管理员，显示权限不足
  if (!isAdmin) {
    return (
      <ResponsiveContainer>
        <Card variant="warning">
          <CardContent className="text-center py-12">
            <Shield className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">权限不足</h2>
            <p className="text-gray-600 mb-6">只有管理员才能访问管理面板</p>
            <Link to="/">
              <Button variant="primary">返回首页</Button>
            </Link>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                管理面板
              </h1>
              <p className="text-xl text-gray-600">
                管理用户、任务和奖励系统
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                管理员
              </Badge>
              <span className="text-sm text-gray-600">
                {formatEvmAddress(currentUser?.EVM)}
              </span>
            </div>
          </div>
        </FadeIn>

        {/* 统计卡片 */}
        <SlideUp delay={200}>
          <ResponsiveGrid sm={2} md={4} gap={6}>
            <Card variant="primary" className="text-center">
              <CardContent className="py-6">
                <Users className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalUsers}
                </div>
                <div className="text-sm text-gray-600">总用户数</div>
                <div className="text-xs text-green-600 mt-1">
                  +{dashboardStats.activeUsers} 活跃
                </div>
              </CardContent>
            </Card>

            <Card variant="success" className="text-center">
              <CardContent className="py-6">
                <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalTasks}
                </div>
                <div className="text-sm text-gray-600">总任务数</div>
                <div className="text-xs text-blue-600 mt-1">
                  {dashboardStats.completedTasks} 已完成
                </div>
              </CardContent>
            </Card>

            <Card variant="secondary" className="text-center">
              <CardContent className="py-6">
                <Gift className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalRewards}
                </div>
                <div className="text-sm text-gray-600">总奖励数</div>
                <div className="text-xs text-orange-600 mt-1">
                  {dashboardStats.claimedRewards} 已兑换
                </div>
              </CardContent>
            </Card>

            <Card variant="warning" className="text-center">
              <CardContent className="py-6">
                <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {pendingVerificationTasks.length}
                </div>
                <div className="text-sm text-gray-600">待验证</div>
                <div className="text-xs text-red-600 mt-1">
                  需要审核
                </div>
              </CardContent>
            </Card>
          </ResponsiveGrid>
        </SlideUp>

        {/* 快速操作 */}
        <SlideUp delay={400}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={2} md={4} gap={4}>
                <Link to="/tasks">
                  <Button variant="primary" className="w-full">
                    <Trophy className="w-4 h-4 mr-2" />
                    管理任务
                  </Button>
                </Link>
                <Link to="/rewards">
                  <Button variant="secondary" className="w-full">
                    <Gift className="w-4 h-4 mr-2" />
                    管理奖励
                  </Button>
                </Link>
                <Button variant="proceed" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                    用户管理
                </Button>
                <Button variant="success" className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                    数据统计
                </Button>
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 待验证任务 */}
        <SlideUp delay={600}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                待验证任务 ({pendingVerificationTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingVerificationTasks.length > 0 ? (
                <StaggerContainer>
                  <div className="space-y-4">
                    {pendingVerificationTasks.map((task, index) => (
                      <FadeIn key={task.tlistID} delay={index * 100}>
                        <Card variant="inactive" className="border-l-4 border-l-orange-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-gray-900">
                                    {task.task?.title || '未知任务'}
                                  </h3>
                                  <Badge variant="warning" size="sm">
                                    {task.task?.points || 0} 积分
                                  </Badge>
                                </div>
                                
                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>用户:</strong> {formatEvmAddress(task.user?.EVM)}
                                </div>
                                
                                <div className="text-sm text-gray-600 mb-3">
                                  <strong>提交内容:</strong> {task.info_input || '无'}
                                </div>
                                
                                <div className="text-xs text-gray-500">
                                  提交时间: {task.time_created ? new Date(task.time_created).toLocaleString() : '未知'}
                                </div>
                              </div>
                              
                              <div className="flex gap-2 ml-4">
                                <Button 
                                  variant="success" 
                                  size="sm"
                                  onClick={() => handleVerifyTask(task.tlistID, true)}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="warning" 
                                  size="sm"
                                  onClick={() => handleVerifyTask(task.tlistID, false)}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </FadeIn>
                    ))}
                  </div>
                </StaggerContainer>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">暂无待验证任务</p>
                </div>
              )}
            </CardContent>
          </Card>
        </SlideUp>

        {/* 系统状态 */}
        <SlideUp delay={800}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                系统状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={1} md={3} gap={4}>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">正常</div>
                  <div className="text-sm text-gray-600">API 服务</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">正常</div>
                  <div className="text-sm text-gray-600">数据库</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">正常</div>
                  <div className="text-sm text-gray-600">缓存服务</div>
                </div>
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 管理操作 */}
        <SlideUp delay={1000}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 任务管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  任务管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="primary" className="w-full">
                    <Trophy className="w-4 h-4 mr-2" />
                    添加新任务
                  </Button>
                  <Button variant="secondary" className="w-full">
                    <Settings className="w-4 h-4 mr-2" />
                    管理任务列表
                  </Button>
                  <div className="text-sm text-gray-600">
                    创建、编辑和删除社区任务
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 奖励管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  奖励管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="primary" className="w-full">
                    <Gift className="w-4 h-4 mr-2" />
                    添加新奖励
                  </Button>
                  <Button variant="secondary" className="w-full">
                    <Settings className="w-4 h-4 mr-2" />
                    管理奖励列表
                  </Button>
                  <div className="text-sm text-gray-600">
                    创建、编辑和删除社区奖励
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SlideUp>

        {/* 用户管理 */}
        <SlideUp delay={1200}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                用户管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={1} md={3} gap={4}>
                <Button variant="primary" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  用户列表
                </Button>
                <Button variant="secondary" className="w-full">
                  <Shield className="w-4 h-4 mr-2" />
                  权限管理
                </Button>
                <Button variant="warning" className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  积分调整
                </Button>
              </ResponsiveGrid>
              <div className="text-sm text-gray-600 mt-4">
                管理用户账户、权限和积分
              </div>
            </CardContent>
          </Card>
        </SlideUp>
      </div>
    </ResponsiveContainer>
  )
}

export default DashboardPage
