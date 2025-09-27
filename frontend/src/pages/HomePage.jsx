import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import toast from 'react-hot-toast'
import ChooseRewardModal from '../components/ChooseRewardModal'
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
  const location = useLocation()

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // 加载用户信息
        const user = localStorage.getItem('user')
        if (user) {
          setCurrentUser(JSON.parse(user))
        }
        
        // 加载任务数据
        try {
          const tasksResponse = await fetch('/api/tasks/all')
          if (!tasksResponse.ok) {
            throw new Error(`HTTP error! status: ${tasksResponse.status}`)
          }
          // 检查响应是否为JSON
          const contentType = tasksResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON')
          }
          const tasksData = await tasksResponse.json()
          if (tasksData.success) {
            setTasks(tasksData.data)
            // 存储到全局变量供前端使用
            window.tasksData = tasksData.data
          }
        } catch (error) {
          console.warn('Failed to load tasks, using mock data:', error)
          // 使用模拟任务数据
          const mockTasks = [
            {
              "tID": 1,
              "title": "完成社区问卷调查",
              "note": "参与社区问卷调查，帮助我们改进服务",
              "refcode": "SURVEY2023",
              "linkA": "https://example.com/survey",
              "is_active": true
            },
            {
              "tID": 2,
              "title": "分享项目到社交媒体",
              "note": "将我们的项目分享到至少一个社交媒体平台",
              "refcode": "SOCIALSHARE",
              "linkA": "https://example.com/share",
              "is_active": true
            },
            {
              "tID": 3,
              "title": "撰写项目反馈",
              "note": "提供详细的项目使用体验和建议",
              "refcode": "FEEDBACK",
              "linkA": "https://example.com/feedback",
              "is_active": true
            }
          ]
          setTasks(mockTasks)
          window.tasksData = mockTasks
        }
        
        // 加载奖励数据
        try {
          const giftsResponse = await fetch('/api/gifts/all')
          if (!giftsResponse.ok) {
            throw new Error(`HTTP error! status: ${giftsResponse.status}`)
          }
          // 检查响应是否为JSON
          const contentType = giftsResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON')
          }
          const giftsData = await giftsResponse.json()
          if (giftsData.success) {
            setGifts(giftsData.data)
          }
        } catch (error) {
          console.warn('Failed to load gifts, using mock data:', error)
          // 使用模拟礼品数据
          const mockGifts = [
            {
              "gift_id": 1,
              "gift_name": "社区T恤",
              "gift_description": "限量版社区纪念T恤",
              "gift_points": 1000,
              "gift_image_url": "https://example.com/tshirt.jpg",
              "stock": 50,
              "is_active": true
            },
            {
              "gift_id": 2,
              "gift_name": "咖啡券",
              "gift_description": "星巴克中杯咖啡券",
              "gift_points": 300,
              "gift_image_url": "https://example.com/coffee.jpg",
              "stock": 100,
              "is_active": true
            },
            {
              "gift_id": 3,
              "gift_name": "项目周边贴纸",
              "gift_description": "精美项目主题贴纸套装",
              "gift_points": 100,
              "gift_image_url": "https://example.com/stickers.jpg",
              "stock": 200,
              "is_active": true
            }
          ]
          setGifts(mockGifts)
        }
        
        // 加载用户任务清单
        if (currentUser && currentUser.uID) {
          try {
            const tasklistResponse = await fetch(`/api/tasklist/user/${currentUser.uID}`)
            if (!tasklistResponse.ok) {
              throw new Error(`HTTP error! status: ${tasklistResponse.status}`)
            }
            // 检查响应是否为JSON
            const contentType = tasklistResponse.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error('Response is not JSON')
            }
            const tasklistData = await tasklistResponse.json()
            if (tasklistData.success) {
              setPendingRewardTasks(tasklistData.data.pendingRewards || [])
              setPendingTasks(tasklistData.data.pendingTasks || [])
              setCompletedTasks(tasklistData.data.completedTasks || [])
            }
          } catch (error) {
            console.warn('Failed to load tasklist, using mock data:', error)
            // 使用模拟数据
            setPendingRewardTasks([])
            setPendingTasks([])
            setCompletedTasks([])
          }
        } else {
          // 如果没有用户ID，使用模拟数据
          setPendingRewardTasks([])
          setPendingTasks([])
          setCompletedTasks([])
        }
        
        // 加载日历事件
        try {
          const calendarResponse = await fetch('/api/calendar/events')
          if (!calendarResponse.ok) {
            throw new Error(`HTTP error! status: ${calendarResponse.status}`)
          }
          // 检查响应是否为JSON
          const contentType = calendarResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON')
          }
          const calendarData = await calendarResponse.json()
          if (calendarData.success) {
            setCalendarEvents(calendarData.data)
          }
        } catch (error) {
          console.warn('Failed to load calendar events, using mock data:', error)
          // 使用模拟日历数据
          const mockCalendar = [
            {
              "eventID": 1,
              "title": "社区线上会议",
              "description": "每周社区线上会议，讨论项目进展",
              "start_time": "2023-06-10T10:00:00",
              "end_time": "2023-06-10T11:30:00",
              "location": "线上Zoom会议",
              "url": "https://example.com/meeting"
            },
            {
              "eventID": 2,
              "title": "项目更新公告",
              "description": "重要项目功能更新公告",
              "start_time": "2023-06-15T14:00:00",
              "end_time": "2023-06-15T15:00:00",
              "location": "项目Discord频道",
              "url": "https://example.com/announcement"
            }
          ]
          setCalendarEvents(mockCalendar)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error(t('error') + ': ' + error.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [t, currentUser])

  // 处理选择奖励
  const handleClaimReward = (task) => {
    setSelectedTask(task)
    setOpenChooseModal(true)
  }

  // 处理完成任务
  const handleCompleteTask = (task) => {
    setSelectedTask(task)
    setOpenActiveModal(true)
  }

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
    const currentLang = getCurrentLang()
    if (currentLang === 'zh') {
      return path === '' ? '/' : `/${path}`
    }
    return `/${currentLang}/${path}`
  }

  // 日历事件点击处理
  const handleDateClick = (info) => {
    // 可以实现日期点击事件
  }

  // 日历事件点击处理
  const handleEventClick = (info) => {
    // 显示事件详情或跳转到Google Calendar
    if (info.event.extendedProps.url) {
      window.open(info.event.extendedProps.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-64">
        <div className="flex flex-col items-center">
          <div className="loading-spinner mr-2"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 欢迎信息 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 swedish-title">{t('welcome')}</h1>
        <p className="text-text-secondary">
          {currentUser ? 
            `${t('welcome')}, ${currentUser.EVM ? `${currentUser.EVM.slice(0, 6)}...${currentUser.EVM.slice(-4)}` : '用户'}` : 
            t('welcome')
          }
        </p>
      </div>
      
      {/* 日历模块 */}
      <div className="mb-12 card p-6">
        <h2 className="text-2xl font-bold mb-6 swedish-title">{t('communityCalendar')}</h2>
        <div className="h-96">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            locale={getCurrentLang()}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek,dayGridDay'
            }}
            height="auto"
          />
        </div>
      </div>
      
      {/* 奖励清单模块 */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 swedish-title">{t('rewardsList')}</h2>
        {gifts.length === 0 ? (
          <div className="card p-8 text-center">
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gifts.map((gift) => (
              <div key={gift.gift_id} className="card p-6">
                <h3 className="text-xl font-bold mb-3">{gift.gift_name}</h3>
                <p className="text-text-secondary mb-4">{gift.gift_description}</p>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-text-muted">
                    {gift.gift_points} {t('points')} | {gift.stock} {t('available')}
                  </div>
                  <Link
                    to={buildPath('task')}
                    className="btn btn-primary"
                  >
                    {t('viewDetails')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 任务清单模块 */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 swedish-title">{t('tasks')}</h2>
        
        {/* 待领取奖励的任务 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">{t('pendingRewards')}</h3>
          {pendingRewardTasks.length === 0 ? (
            <div className="card p-6 text-center">
              <p>{t('noData')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRewardTasks.map((task) => (
                <div key={task.tlistID} className="card p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    <div>
                      <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                      <p className="text-text-secondary text-sm">{task.note}</p>
                    </div>
                    <button
                      onClick={() => handleClaimReward(task)}
                      className="btn btn-primary mt-4 md:mt-0"
                    >
                      {t('claimReward')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 待完成的任务 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">{t('pendingTasks')}</h3>
          {pendingTasks.length === 0 ? (
            <div className="card p-6 text-center">
              <p>{t('noData')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTasks.map((task) => (
                <div key={task.tID} className="card p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    <div>
                      <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                      <p className="text-text-secondary text-sm">{task.note}</p>
                      {task.linkA && (
                        <a href={task.linkA} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm mt-2 inline-block">
                          {t('viewDetails')}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task)}
                      className="btn btn-secondary mt-4 md:mt-0"
                    >
                      {t('goComplete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 已领取奖励的任务 */}
        <div>
          <h3 className="text-xl font-semibold mb-4">{t('completedTasks')}</h3>
          {completedTasks.length === 0 ? (
            <div className="card p-6 text-center">
              <p>{t('noData')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedTasks.map((task) => (
                <div key={task.tlistID} className="card p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    <div>
                      <h4 className="text-lg font-medium mb-2">{task.title}</h4>
                      <p className="text-text-secondary text-sm">{task.note}</p>
                      <div className="flex items-center mt-2">
                        <span className="text-success text-sm">{t('success')}: </span>
                        <span className="text-sm ml-1">{task.giftTitle}</span>
                      </div>
                    </div>
                    <div className="text-sm text-text-muted mt-2 md:mt-0">
                      {new Date(task.time_actived).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 模态框 */}
      <ChooseRewardModal
        open={openChooseModal}
        onClose={() => setOpenChooseModal(false)}
        task={selectedTask}
      />
      
      <ActiveTaskModal
        open={openActiveModal}
        onClose={() => setOpenActiveModal(false)}
        task={selectedTask}
      />
    </div>
  )
}

export default HomePage