import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import toast from 'react-hot-toast'

// 新的 UI 组件
import { Container, Grid } from '../components/layout'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { TaskCard } from '../components/task/TaskCard'
import { RewardCard } from '../components/reward/RewardCard'
import { LoadingPage, LoadingCard } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveGrid, ResponsiveContainer } from '../components/ui/Responsive'
import DashJ from '../components/ui/DashJ'

// 原有模态框组件
import ClaimRewardModal from '../components/ClaimRewardModal'
import ActiveTaskModal from '../components/ActiveTaskModal'

const HomePage = () => {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState([])
  const [gifts, setGifts] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [pendingRewardTasks, setPendingRewardTasks] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [openChooseModal, setOpenChooseModal] = useState(false)
  const [openActiveModal, setOpenActiveModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  
  // 用户资产与宝箱
  const [assetBalance, setAssetBalance] = useState(null)
  const [userChests, setUserChests] = useState([])
  const [openableChestCount, setOpenableChestCount] = useState(0)
  
  const location = useLocation()

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 加载数据
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()
    const { signal } = controller
    let loadingGuard = null

    const loadData = async () => {
      if (isMounted) setLoading(true)
      
      loadingGuard = setTimeout(() => {
        if (isMounted) setLoading(false)
      }, 1500)
      
      try {
        // 加载任务数据
        try {
          const tasksResponse = await fetch('/api/task/all', { signal })
          if (!tasksResponse.ok) {
            throw new Error(`HTTP error! status: ${tasksResponse.status}`)
          }
          
          const contentType = tasksResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON')
          }
          
          const tasksData = await tasksResponse.json()
          if (tasksData.success) {
            let baseTasks = Array.isArray(tasksData.data) ? tasksData.data : []
            
            // 加载品牌数据用于积分映射
            try {
              const brandResp = await fetch('/api/brand/all', { signal })
              if (brandResp.ok) {
                const brandData = await brandResp.json()
                const list = Array.isArray(brandData?.data) ? brandData.data : []
                const symMap = new Map(list.map(b => [String(b.symbol || '').trim(), Number(b.points || 0)]))
                const lang = getCurrentLang()
                
                baseTasks = baseTasks.map(t => {
                  const title = lang === 'en' ? (t.title_en ?? t.title) : lang === 'hk' ? (t.title_hk ?? t.title) : lang === 'vn' ? (t.title_vn ?? t.title) : (t.title)
                  const note = lang === 'en' ? (t.note_en ?? t.note) : lang === 'hk' ? (t.note_hk ?? t.note) : lang === 'vn' ? (t.note_vn ?? t.note) : (t.note)
                  
                  return {
                    ...t,
                    title,
                    note,
                    points: typeof t.points === 'number' ? t.points : (symMap.get(String(t.refcode || '').trim()) ?? 0),
                    // 添加状态信息
                    status: t.is_open ? 'active' : 'inactive',
                    statusText: t.is_open ? '进行中' : '已结束',
                    type: t.refcode ? 'trade' : 'join',
                    participants: Math.floor(Math.random() * 100), // 模拟数据，实际应从后端获取
                    actionText: '立即参与'
                  }
                })
              }
            } catch (e) {
              console.warn('Failed to load brand data:', e)
            }
            
            if (isMounted) setTasks(baseTasks)
            window.tasksData = baseTasks
          }
        } catch (error) {
          if (error?.name !== 'AbortError') {
            console.warn('Failed to load tasks:', error)
            toast.error(t('error') + ': ' + (error.message || 'Load tasks failed'))
          }
          if (isMounted) setTasks([])
          window.tasksData = []
        }
        
        // 加载奖励数据
        try {
          const giftsResponse = await fetch('/api/brand/all', { signal })
          if (!giftsResponse.ok) {
            throw new Error(`HTTP error! status: ${giftsResponse.status}`)
          }
          
          const contentType = giftsResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON')
          }
          
          const giftsData = await giftsResponse.json()
          if (giftsData.success) {
            const brands = Array.isArray(giftsData.data) ? giftsData.data : []
            const lang = getCurrentLang()
            
            let normalized = brands.map((b) => {
              const name_ = lang === 'en' ? (b.name_en ?? b.name) : lang === 'hk' ? (b.name_hk ?? b.name) : lang === 'vn' ? (b.name_vn ?? b.name) : (b.name)
              const desc_ = lang === 'en' ? (b.description_en ?? b.description) : lang === 'hk' ? (b.description_hk ?? b.description) : lang === 'vn' ? (b.description_vn ?? b.description) : (b.description)
              
              return {
                ...b,
                gift_id: b.gID ?? b.bID,
                gift_name: b.gift_name ?? name_,
                gift_description: b.gift_description ?? desc_,
                gift_points: b.gift_points ?? b.points ?? 0,
                stock: b.stock ?? b.stores_count ?? 0,
                is_open: b.is_open !== false,
                gift_image_url: b.gift_image_url ?? b.image_url ?? b.url_image,
                title: name_,
                description: desc_,
                points_required: b.points ?? 0,
                image: b.url_image,
                brand: {
                  name: name_,
                  logo: b.url_image
                },
                // 添加状态信息
                status: 'available',
                statusText: '可领取',
                rarity: b.points > 5000 ? 'epic' : b.points > 2000 ? 'rare' : 'common',
                claimed: Math.floor(Math.random() * 50), // 模拟数据
                total: 100,
                limited: b.time_end ? true : false
              }
            })

            if (isMounted) setGifts(normalized)
          }
        } catch (error) {
          if (error?.name !== 'AbortError') {
            console.warn('Failed to load gifts:', error)
            toast.error(t('error') + ': ' + (error.message || 'Load gifts failed'))
          }
          if (isMounted) setGifts([])
        }
        
      } catch (error) {
        console.error('Load data error:', error)
      } finally {
        if (loadingGuard) clearTimeout(loadingGuard)
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    
    return () => {
      isMounted = false
      controller.abort()
      if (loadingGuard) clearTimeout(loadingGuard)
    }
  }, [t])

  // 初始化用户信息
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setCurrentUser(JSON.parse(user))
    }
  }, [])

  // 处理任务操作
  const handleTaskAction = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

  // 处理奖励领取
  const handleRewardClaim = (reward) => {
    // 这里可以添加领取逻辑
    toast.success(`正在领取 ${reward.title}`)
  }

  // 如果正在加载，显示加载页面
  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message="正在加载精彩内容..." />
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
              <Button variant="primary" size="lg">
                开始探索
              </Button>
              <Button variant="secondary" size="lg">
                了解更多
              </Button>
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
              <Link to="/tasks">
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
              <Link to="/rewards">
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
                        userPoints={assetBalance?.points || 0}
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

        {/* 日历区域 */}
        <SlideUp delay={600}>
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">活动日历</h2>
              <p className="text-gray-600">查看即将到来的活动</p>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  events={calendarEvents}
                  height={400}
                  locale="zh-cn"
                />
              </CardContent>
            </Card>
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
    </ResponsiveContainer>
  )
}

export default HomePage
