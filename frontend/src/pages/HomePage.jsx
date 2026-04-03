import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

// UI 组件
import { Button, Card, CardContent } from '../components/ui'
import { TaskCard } from '../components/task/TaskCard'
import { RewardCard } from '../components/reward/RewardCard'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import DashJ from '../components/ui/DashJ'
import RegisterModal from '../components/RegisterModal'

// 模态框组件
import ClaimRewardModal from '../components/ClaimRewardModal'
import ActiveTaskModal from '../components/ActiveTaskModal'

const HomePage = () => {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState([])
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const [selectedTask, setSelectedTask] = useState(null)
  const [openActiveModal, setOpenActiveModal] = useState(false)
  const [openChooseModal, setOpenChooseModal] = useState(false)
  const [pendingRewardTasks, setPendingRewardTasks] = useState([])
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  
  const location = useLocation()

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 加载用户积分
  const loadUserPoints = async () => {
    try {
      const user = localStorage.getItem('user')
      if (user) {
        const userData = JSON.parse(user)
        // 模拟积分数据
        const mockPoints = Math.floor(Math.random() * 10000) + 1000
        setUserPoints(mockPoints)
      }
    } catch (error) {
      console.warn('Failed to load user points:', error)
      setUserPoints(0)
    }
  }

  // 加载数据
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()
    const { signal } = controller

    const loadData = async () => {
      if (isMounted) setLoading(true)
      
      try {
        // 加载任务数据
        try {
          const tasksResponse = await fetch('/api/task/all', { signal })
          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json()
            if (tasksData.success) {
              const enrichedTasks = (tasksData.data || []).map(task => ({
                ...task,
                title: task.title || '任务',
                note: task.note || '',
                points: task.points || Math.floor(Math.random() * 1000) + 100,
                status: task.is_open ? 'active' : 'inactive',
                statusText: task.is_open ? '进行中' : '已结束',
                participants: Math.floor(Math.random() * 100),
                actionText: '立即参与'
              }))
              setTasks(enrichedTasks)
            }
          }
        } catch (error) {
          console.warn('Failed to load tasks:', error)
        }
        
        // 加载奖励数据
        try {
          const giftsResponse = await fetch('/api/brand/all', { signal })
          if (giftsResponse.ok) {
            const giftsData = await giftsResponse.json()
            if (giftsData.success) {
              const normalizedGifts = (giftsData.data || []).map(gift => ({
                ...gift,
                title: gift.name || '奖励',
                description: gift.description || '',
                points_required: gift.points || Math.floor(Math.random() * 2000) + 500,
                status: 'available',
                statusText: '可领取',
                rarity: gift.points > 5000 ? 'epic' : gift.points > 2000 ? 'rare' : 'common',
                image: gift.url_image || '/placeholder.jpg'
              }))
              setGifts(normalizedGifts)
            }
          }
        } catch (error) {
          console.warn('Failed to load gifts:', error)
        }
        
      } catch (error) {
        console.error('Load data error:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadUserPoints()
    loadData()
    
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [t])

  // 处理任务操作
  const handleTaskAction = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

  // 处理奖励领取
  const handleRewardClaim = (reward) => {
    const user = localStorage.getItem('user')
    if (!user) {
      toast.error('请先登录')
      return
    }

    if (userPoints < reward.points_required) {
      toast.error('dashJ不足')
      return
    }

    toast.success('领取成功！')
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
        {/* 英雄区域 */}
        <FadeIn>
          <section className="bg-gradient-to-r from-yellow-50 to-blue-50 rounded-2xl p-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              欢迎来到 Jinli Club
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              参与任务，赚取<DashJ size="sm" />，兑换精彩奖励
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="primary" size="lg" onClick={() => setShowRegisterModal(true)}>
                立即注册
              </Button>
              <Link to="/task">
                <Button variant="secondary" size="lg">
                  开始探索
                </Button>
              </Link>
            </div>
          </section>
        </FadeIn>

        {/* 任务区域 */}
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
                      <TaskCard 
                        task={task} 
                        onAction={handleTaskAction}
                        showStatus={true}
                      />
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

        {/* 奖励区域 */}
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
            
            {gifts.length > 0 ? (
              <StaggerContainer>
                <ResponsiveGrid sm={1} md={2} lg={4} gap={6}>
                  {gifts.slice(0, 8).map((reward, index) => (
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

      {/* 模态框 */}
      {selectedTask && (
        <ActiveTaskModal
          open={openActiveModal}
          onClose={() => setOpenActiveModal(false)}
          task={selectedTask}
        />
      )}
      
      <ClaimRewardModal
        isOpen={openChooseModal}
        onClose={() => setOpenChooseModal(false)}
        tasks={pendingRewardTasks}
      />
      
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={() => {
          // 注册成功后可以跳转到登录页面
          window.location.href = '/login'
        }}
      />
    </ResponsiveContainer>
  )
}

export default HomePage
