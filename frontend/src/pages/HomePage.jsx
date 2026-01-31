import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import toast from 'react-hot-toast'
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

  // 加载数据
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()
    const { signal } = controller
    // 防护：若请求在开发环境被频繁中止，确保界面不会一直停留在“加载中”
    let loadingGuard = null

    const loadData = async () => {
      if (isMounted) setLoading(true)
      // 最长 1.5s 后强制结束加载态，避免出现无内容的长期“加载中”
      loadingGuard = setTimeout(() => {
        if (isMounted) setLoading(false)
      }, 1500)
      try {
        // 当前用户信息在独立的 useEffect 中初始化，避免依赖循环
        
        // 加载任务数据（仅使用真实后端，不再回退模拟数据）
        try {
          const tasksResponse = await fetch('/api/task/all', { signal })
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
            let baseTasks = Array.isArray(tasksData.data) ? tasksData.data : []
            // 额外加载品牌列表，构建 symbol->points 映射，用于为任务补充积分
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
                  }
                })
              }
            } catch (e) {
              console.warn('Failed to load brand/all for task points enrichment:', e)
            }
            if (isMounted) setTasks(baseTasks)
            // 存储到全局变量供前端使用（含 points 富化）
            window.tasksData = baseTasks
          }
        } catch (error) {
          // 仅记录错误并保持空数据（不使用模拟数据）
          if (error?.name !== 'AbortError') {
            console.warn('Failed to load tasks:', error)
            toast.error(t('error') + ': ' + (error.message || 'Load tasks failed'))
          }
          if (isMounted) setTasks([])
          window.tasksData = []
        }
        
        // 加载奖励数据（品牌列表，数据集 A；仅使用真实后端）
        try {
          const giftsResponse = await fetch('/api/brand/all', { signal })
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
            // /api/brand/all 返回品牌数据，将其规范化为前端奖励卡片需要的字段
            const brands = Array.isArray(giftsData.data) ? giftsData.data : []
            const lang = getCurrentLang()
              let normalized = brands.map((b) => {
                const name_ = lang === 'en' ? (b.name_en ?? b.name) : lang === 'hk' ? (b.name_hk ?? b.name) : lang === 'vn' ? (b.name_vn ?? b.name) : (b.name)
                const desc_ = lang === 'en' ? (b.description_en ?? b.description) : lang === 'hk' ? (b.description_hk ?? b.description) : lang === 'vn' ? (b.description_vn ?? b.description) : (b.description)
                return {
                  gift_id: b.gID ?? b.bID,
                  gift_name: b.gift_name ?? name_,
                  gift_description: b.gift_description ?? desc_,
                  gift_points: b.gift_points ?? b.points ?? 0,
                  stock: b.stock ?? b.stores_count ?? 0,
                  is_open: b.is_open !== false,
                  gift_image_url: b.gift_image_url ?? b.image_url ?? b.url_image,
                  bID: b.bID,
                  symbol: b.symbol,
                  time_end: b.time_end || 0,
                  is_claimed: false,
                  is_actived: false,
                }
              })

            // 若存在当前用户，则从 /gift?uid={uID} 获取数据集 B，并合并状态
            if (currentUser && currentUser.uID) {
              try {
                const bResp = await fetch(`/api/gift?uid=${encodeURIComponent(currentUser.uID)}`, { signal })
                if (bResp.ok) {
                  const bData = await bResp.json()
                  if (bData.success) {
                    const items = Array.isArray(bData.data) ? bData.data : []
                    // 聚合：按 bID 归并，若任一记录 time_actived 存在则 is_actived=true；否则若任一记录 time_claimed 存在则 is_claimed=true
                    const brandState = new Map()
                    for (const it of items) {
                      const bid = it.bID
                      const claimed = !!it.time_claimed
                      const actived = !!it.time_actived
                      const prev = brandState.get(bid) || { is_claimed: false, is_actived: false }
                      brandState.set(bid, {
                        is_claimed: prev.is_claimed || claimed,
                        is_actived: prev.is_actived || actived,
                      })
                    }
                    normalized = normalized.map((g) => {
                      const st = brandState.get(g.bID)
                      if (!st) return g
                      return { ...g, is_claimed: !!st.is_claimed, is_actived: !!st.is_actived }
                    })
                  }
                }
              } catch (err) {
                // 忽略用户礼品加载错误，保留默认状态
                console.warn('Failed to load user gifts for merging:', err)
              }
            }
            if (isMounted) setGifts(normalized)
          }
        } catch (error) {
          if (error?.name !== 'AbortError') {
            console.warn('Failed to load gifts:', error)
            toast.error(t('error') + ': ' + (error.message || 'Load gifts failed'))
          }
          if (isMounted) setGifts([])
        }
        
        // 加载用户任务清单并基于数据集 B 过滤“已检查”的任务
        // 逻辑：从数据集 B (/api/journey/user/{uID}) 中找出 time_checked 非空的记录，取其 tID，从数据集 A (/api/task/all)中过滤移除这些任务，
        // 将剩余任务用于 subsection_task_tocomplete 容器的卡片。
        if (currentUser && currentUser.uID) {
          // 先初始化为“所有任务”作为待完成列表，保证即使后续请求失败也有兜底
          const allTasks = Array.isArray(window.tasksData) ? window.tasksData : []
          if (isMounted) setPendingTasks(allTasks)

          // 若后端存在聚合接口返回待领取和已完成，你可继续保留原有展示；没有也不影响“待完成”逻辑
          try {
            const journeyResp = await fetch(`/api/journey?uid=${encodeURIComponent(currentUser.uID)}`, { signal })
            if (!journeyResp.ok) {
              throw new Error(`HTTP error! status: ${journeyResp.status}`)
            }
            const contentType = journeyResp.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error('Response is not JSON')
            }
            const journeyData = await journeyResp.json()
            if (journeyData.success) {
              // 数据集 B 可能为数组或包含 data 字段，统一规范化
              const records = Array.isArray(journeyData.data) ? journeyData.data : (Array.isArray(journeyData) ? journeyData : [])
              // 1) subsection_task_tocomplete：从数据集 B 中找出 time_checked 非空的记录的 tID，并从 A 集中过滤掉这些任务
              const checkedIDs = new Set(
                records
                  .filter(r => !!r?.time_checked)
                  .map(r => r?.tID)
                  .filter(Boolean)
              )
              const filtered = allTasks.filter(t => !checkedIDs.has(t.tID))
              if (isMounted) setPendingTasks(filtered)

              // 2) subsection_task_toclaim：使用数据集 B 中 time_claimed 为空的记录
              // 3) subsection_task_claimed：使用数据集 B 中 time_claimed 非空的记录
              const taskMap = new Map(allTasks.map(t => [t.tID, t]))
              const toClaimList = records
                .filter(r => !r?.time_claimed)
                .map(r => {
                  const base = taskMap.get(r.tID) || {}
                  return {
                    tlistID: r.jID,
                    tID: r.tID,
                    title: base.title || `任务 #${r.tID}`,
                    note: base.note || '',
                    time_claimed: r.time_claimed || 0,
                    points: typeof base.points === 'number' ? base.points : (base.points ? Number(base.points) : 0),
                  }
                })
              const claimedList = records
                .filter(r => !!r?.time_claimed)
                .map(r => {
                  const base = taskMap.get(r.tID) || {}
                  return {
                    tlistID: r.jID,
                    tID: r.tID,
                    title: base.title || `任务 #${r.tID}`,
                    note: base.note || '',
                    time_claimed: r.time_claimed || 0,
                    points_claimed: typeof r.points_claimed === 'number' ? r.points_claimed : (r.points_claimed ? Number(r.points_claimed) : 0),
                  }
                })
              if (isMounted) {
                setPendingRewardTasks(toClaimList)
                setCompletedTasks(claimedList)
              }
            }
          } catch (error) {
            if (error?.name === 'AbortError') return
            console.warn('Failed to load journey/user for filtering, keep all tasks as pending:', error)
            // 保持 allTasks 作为待完成任务
            if (isMounted) setPendingTasks(allTasks)
          }
        } else {
          // 没有用户ID，则直接将数据集 A 作为待完成任务
          const allTasks = Array.isArray(window.tasksData) ? window.tasksData : []
          if (isMounted) setPendingRewardTasks([])
          if (isMounted) setCompletedTasks([])
          if (isMounted) setPendingTasks(allTasks)
        }
        
        // 加载用户宝箱（用于资产倒计时/概览）
        try {
          const storedUser = localStorage.getItem('user')
          if (storedUser) {
            const u = JSON.parse(storedUser)
            if (u?.token) {
              const chestsResp = await fetch('/api/chest', {
                headers: { 'Authorization': `Bearer ${u.token}` },
                signal,
              })
              if (chestsResp.ok) {
                const chestsData = await chestsResp.json()
                if (chestsData.success) {
                  const chests = chestsData.data || []
                  if (isMounted) setUserChests(chests)
                  const count = chests.filter(c => c.is_active).length
                  if (isMounted) setOpenableChestCount(count)
                }
              }
            }
          }
        } catch (error) {
          if (error?.name === 'AbortError') return
          console.warn('Failed to load user chests:', error)
        }

        // 加载日历事件（仅使用真实后端）
        try {
          const calendarResponse = await fetch('/api/calendar', { signal })
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
            const mapped = Array.isArray(calendarData.data) ? calendarData.data.map(ev => ({
              title: ev.title,
              start: ev.start_time,
              end: ev.end_time,
              url: ev.url,
            })) : []
            if (isMounted) setCalendarEvents(mapped)
          }
        } catch (error) {
          if (error?.name === 'AbortError') return
          console.warn('Failed to load calendar events:', error)
          toast.error(t('error') + ': ' + (error.message || 'Load calendar failed'))
          if (isMounted) setCalendarEvents([])
        }
      } catch (error) {
        console.error('Error loading data:', error)
        if (error?.name !== 'AbortError') {
          toast.error(t('error') + ': ' + error.message)
        }
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
  }, [t, currentUser])

  // 独立初始化当前用户，避免 useEffect 因对象引用变化导致的循环触发
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      try {
        const u = JSON.parse(user)
        setCurrentUser(u)
      } catch (e) {
        console.warn('Failed to parse user from localStorage')
      }
    }
  }, [])

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
    <div id="container" className="container mx-auto px-4 py-8">
      {/* 欢迎信息 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 swedish-title">{t('welcome')}</h1>
        <p className="text-text-secondary">
          {currentUser ? 
            `${t('welcome')}, ${currentUser.EVM ? `${currentUser.EVM.slice(0, 6)}...${currentUser.EVM.slice(-4)}` : '用户'}` : 
            t('welcome')
          }
        </p>
        <p className="mt-2 text-sm text-text-muted">{t('slogan')}</p>
      </div>
      
      {/* 加密日历：section_calender */}
      <section id="section_calender" className="mb-12">
        <h2 className="text-2xl font-bold mb-6 swedish-title">{t('CryptoCalender')}</h2>
        {/* 两列布局：左侧 2/3 日历卡片，右侧 1/3 新闻卡片；均为蓝色主题卡片 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 日历卡片（左侧占 2 列） */}
          <div className="card card-proceed p-4 lg:col-span-2">
            <div className="calendar-container">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                locale={getCurrentLang()}
                firstDay={1}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,dayGridWeek,dayGridDay'
                }}
                height="auto"
              />
            </div>
          </div>

          {/* 新闻卡片（右侧占 1 列） */}
          <div className="card card-proceed p-4 lg:col-span-1">
            <h3 className="text-xl font-semibold mb-4">{t('cryptoNews') || '加密新闻'}</h3>
            <div className="space-y-3">
              <div className="p-3 rounded bg-bg-muted/40">
                <p className="text-sm">比特币突破关键阻力位，链上活跃度提升 8%，市场情绪回暖。</p>
              </div>
              <div className="p-3 rounded bg-bg-muted/40">
                <p className="text-sm">以太坊质押总量再创新高，L2 生态扩张，Gas 费用阶段性走低。</p>
              </div>
              <div className="p-3 rounded bg-bg-muted/40">
                <p className="text-sm">主流交易所上新热门代币，24 小时交易量升至月度高点。</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* 社群福利：section_gift 显示所有可用奖励 */}
      <section id="section_gift" className="mb-12">
        <h2 className="text-2xl font-bold mb-6 swedish-title">{t('rewardsList')}</h2>
        {gifts.filter(g => g.is_open !== false).length === 0 ? (
          <div className="card p-8 text-center">
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gifts.filter(g => g.is_open !== false).map((gift) => (
              <div key={gift.gift_id || gift.gID} className="card p-6 tone-gold">
                {(() => {
                  const nowSec = Math.floor(Date.now() / 1000)
                  const rem = (gift.time_end || 0) - nowSec
                  const labels = { hours: 'Hours left', days: 'Days left', weeks: 'Weeks left', limited: 'Limited' }
                  let label = labels.limited
                  if (rem > 0) {
                    const day = 24 * 60 * 60
                    const week = 7 * day
                    const month = 30 * day
                    if (rem <= day) label = labels.hours
                    else if (rem <= week) label = labels.days
                    else if (rem <= month) label = labels.weeks
                    else label = labels.limited
                  }
                  return (
                    <div className="badge-gift badge-gift-primary"><span>{label}</span></div>
                  )
                })()}
                <div className="card-split">
                  <div className="card-top grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">{gift.gift_name}</h3>
                    </div>
                    <div className="flex items-start justify-end gap-2">
                      {(() => {
                        const val = typeof gift.gift_points === 'number' ? gift.gift_points : (gift.gift_points ? Number(gift.gift_points) : 0)
                        const str = String(val)
                        const major = str.charAt(0)
                        const minor = str.slice(1)
                        return (
                          <div className="price-tag tag-price-primary" role="group" aria-label={`${val} ${t('points')}`}>
                            <div className="points-price">
                              <span className="points-major">{major || '0'}</span>
                              <span className="points-minor">{minor || ''}</span>
                            </div>
                            <span className="junit" title={t('points')}><span className="j">J</span></span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="card-bottom grid grid-cols-2 items-center">
                    <div className="flex flex-col justify-start">
                      <p className="text-text-secondary text-sm">{gift.gift_description}</p>
                      <div className="text-xs text-text-muted mt-2">{gift.stock || '-'} {t('available')}</div>
                    </div>
                    <div className="flex justify-end items-center">
                      {gift.is_actived ? (
                        <button className="btn btn-inactive" disabled>
                          {t('Actived') || '已激活'}
                        </button>
                      ) : gift.is_claimed ? (
                        <Link to={buildPath('task')} className="btn btn-proceed">
                          {t('CanActive') || '可激活'}
                        </Link>
                      ) : (
                        <Link to={buildPath('task')} className="btn btn-primary">
                          {t('CanClaim') || '可领取'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* 社区任务：section_task 显示用户的任务清单和状态 */}
      <section id="section_task" className="mb-12">
        <h2 className="text-2xl font-bold mb-6 swedish-title">{t('tasks')}</h2>
        {/* 用户资产：subsection_asset */}
        <div id="subsection_asset" className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* asset-detail */}
            <div id="asset-detail" className="card card-proceed p-6">
              <h3 className="text-xl font-semibold mb-4">{t('assetDetail') || '资产详情'}</h3>
              <div className="space-y-3">
                <div id="asset_balance" className="flex justify-between">
                  <span className="text-text-secondary">{t('assetBalance') || '资产余额'}</span>
                  <span className="font-bold">{assetBalance !== null ? assetBalance : (currentUser ? '暂不可用' : '登录后显示')}</span>
                </div>
                <div id="asset_countdown" className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <span className="text-text-secondary">{t('assetCountdown') || '倒计时打开宝箱'}</span>
                  <span className="font-bold">{openableChestCount > 0 ? `有 ${openableChestCount} 个可打开` : '暂无可打开宝箱'}</span>
                  <div id="chest-wrap" className="w-full md:w-1/2 max-w-[400px]">
                    <div className="chest-placeholder p-4 bg-bg-muted rounded text-center">
                      <span className="text-4xl">🎁</span>
                      <p className="text-sm text-text-secondary mt-2">宝箱功能即将上线</p>
                    </div>
                  </div>

<div id="open-chest">Åben kiste</div>
<div id="reset-chest">Reset animation</div>
                </div>
              </div>
            </div>
            {/* asset-future */}
            <div id="asset-future" className="card card-proceed p-6">
              <h3 className="text-xl font-semibold mb-4">{t('assetFuture') || '资产趋势'}</h3>
              <div id="asset_seven_days" className="flex space-x-2">
                {[...Array(7)].map((_, idx) => {
                  const d = new Date()
                  d.setDate(d.getDate() + idx)
                  const label = `${d.getMonth() + 1}/${d.getDate()}`
                  return (
                    <div key={idx} className="flex-1 text-center">
                      <div className="h-8 bg-bg-muted rounded"></div>
                      <div className="text-xs text-text-secondary mt-1">{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        
        {/* 待完成的任务：subsection_task_tocomplete */}
        <div id="subsection_task_tocomplete" className="mb-8">
          <h3 className="text-xl font-semibold mb-4">{t('tasksToComplete')}</h3>
          {pendingTasks.length === 0 ? (
            <div className="card card-primary p-6 text-center">
              <p>{t('noData')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingTasks.map((task) => (
                <div key={task.tID} className="card card-primary p-6">
                  <div className="card-split">
                  <div className="card-top grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-medium">{task.title}</h4>
                      </div>
                      <div className="flex items-start justify-end gap-2">
                        {(() => {
                          const val = typeof task.points === 'number' ? task.points : (task.points ? Number(task.points) : 0)
                          const str = String(val)
                          const major = str.charAt(0)
                          const minor = str.slice(1)
                          return (
                            <div className="price-tag tag-price-primary" role="group" aria-label={`${val} ${t('points')}`}>
                              <div className="points-price">+
                                <span className="points-major">{major || '0'}</span>
                                <span className="points-minor">{minor || ''}</span>
                              </div>
                              <span className="junit" title={t('points')}><span className="j">J</span></span>
                            </div>
                          )
                        })()}
                        {(() => {
                          const map = {
                            0: 'Join to Earn',
                            1: 'Trade to Earn',
                            2: 'Vote to Earn',
                            3: 'IRL Meetup to Earn'
                          }
                          const label = map[Number(task.type || 0)] || 'Join to Earn'
                          return (
                            <div className="badge badge-primary">
                              <span className="badge__icon">❖</span>
                              <div className="badge__text">
                                <div className="badge__sub">{label}</div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="card-bottom grid grid-cols-2 items-center">
                      <div className="flex flex-col justify-start">
                        <p className="text-text-secondary text-sm">{task.note}</p>
                        {task.linkA && (
                          <a href={task.linkA} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm mt-2 inline-block">
                            {t('viewDetails')}
                          </a>
                        )}
                        <div className="tag-status tag-status-primary mt-2">
                          <span className="tag-status__text"></span>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => handleCompleteTask(task)} className="btn btn-primary">
                          {t('goComplete')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 待领取奖励的任务：subsection_task_toclaim */}
        <div id="subsection_task_toclaim" className="mb-8">
          <h3 className="text-xl font-semibold mb-4">{t('tasksToClaimReward')}</h3>
          {pendingRewardTasks.length === 0 ? (
            <div className="card card-proceed p-6 text-center">
              <p>{t('noData')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingRewardTasks.map((task) => (
                <div key={task.tlistID} className="card card-proceed p-6">
                  <div className="card-split">
                  <div className="card-top grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-medium">{task.title}</h4>
                      </div>
                      <div className="flex items-start justify-end gap-2">
                        {(() => {
                          const val = typeof task.points === 'number' ? task.points : (task.points ? Number(task.points) : 0)
                          const str = String(val)
                          const major = str.charAt(0)
                          const minor = str.slice(1)
                          return (
                            <div className="price-tag tag-price-proceed" role="group" aria-label={`${val} ${t('points')}`}>
                              <div className="points-price">+
                                <span className="points-major">{major || '0'}</span>
                                <span className="points-minor">{minor || ''}</span>
                              </div>
                              <span className="junit" title={t('points')}><span className="j">J</span></span>
                            </div>
                          )
                        })()}
                        {(() => {
                          const base = task
                          const map = {
                            0: 'Join to Earn',
                            1: 'Trade to Earn',
                            2: 'Vote to Earn',
                            3: 'IRL Meetup to Earn'
                          }
                          const label = map[Number(base.type || 0)] || 'Join to Earn'
                          return (
                            <div className="badge badge-proceed">
                              <span className="badge__icon">❖</span>
                              <div className="badge__text">
                                <div className="badge__sub">{label}</div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="card-bottom grid grid-cols-2 items-center">
                      <div className="flex flex-col justify-start">
                        <p className="text-text-secondary text-sm">{task.note}</p>
                        <div className="tag-status tag-status-proceed mt-2">
                          <span className="tag-status__text"></span>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => handleClaimReward(task)} className="btn btn-proceed">
                          {t('claimReward')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        
        
        {/* 已领取奖励的任务：subsection_task_claimed */}
        <div id="subsection_task_claimed">
          <h3 className="text-xl font-semibold mb-4">{t('tasksClaimed')}</h3>
          {completedTasks.length === 0 ? (
            <div className="card card-inactive p-6 text-center">
              <p>{t('noData')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedTasks.map((task) => {
                const _fmt = (v) => {
                  try {
                    const num = typeof v === 'number' ? v : Number(v)
                    const ms = Number.isFinite(num) ? (num < 1e12 ? num * 1000 : num) : v
                    const d = new Date(ms)
                    if (isNaN(d.getTime())) return ''
                    const pad = (n) => String(n).padStart(2, '0')
                    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
                  } catch { return '' }
                }
                const hoverTitle = task.time_claimed ? `TimeClaimed ${_fmt(task.time_claimed)}` : undefined
                return (
                <div key={task.tlistID} className="card card-inactive p-6">
                  <div className="card-split" title={hoverTitle}>
                    <div className="card-top grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-medium">{task.title}</h4>
                      </div>
                      <div className="flex items-start justify-end gap-2">
                        {(() => {
                          const val = typeof task.points_claimed === 'number' ? task.points_claimed : (task.points_claimed ? Number(task.points_claimed) : 0)
                          const str = String(val)
                          const major = str.charAt(0)
                          const minor = str.slice(1)
                          return (
                            <div className="price-tag tag-price-inactive" role="group" aria-label={`${val} ${t('points')}`}>
                              <div className="points-price">+
                                <span className="points-major">{major || '0'}</span>
                                <span className="points-minor">{minor || ''}</span>
                              </div>
                              <span className="junit" title={t('points')}><span className="j">J</span></span>
                            </div>
                          )
                        })()}
                        {(() => {
                          const base = task
                          const map = {
                            0: 'Join to Earn',
                            1: 'Trade to Earn',
                            2: 'Vote to Earn',
                            3: 'IRL Meetup to Earn'
                          }
                          const label = map[Number(base.type || 0)] || 'Join to Earn'
                          return (
                            <div className="badge badge-inactive">
                              <span className="badge__icon">❖</span>
                              <div className="badge__text">
                                <div className="badge__sub">{label}</div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="card-bottom grid grid-cols-2 items-center">
                      <div className="flex flex-col justify-start">
                        <p className="text-text-secondary text-sm">{task.note}</p>
                        <div className="tag-status tag-status-inactive mt-2">
                          <span className="tag-status__text claimed-time">
                            {task.time_claimed ? `${t('timeClaimed')}: ${_fmt(task.time_claimed)}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end"></div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </section>
      
      {/* 模态框 */}
      <ClaimRewardModal
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
