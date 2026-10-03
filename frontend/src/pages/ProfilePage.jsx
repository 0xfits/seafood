import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, Mail, Calendar, Trophy, Star, Edit3, Save, X } from 'lucide-react'

// 新的 UI 组件
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'
import { useTranslation } from 'react-i18next'
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../utils'
import { contentStatus, pickLocalized } from '../i18n-content'
import TranslatingBadge from '../components/i18n/TranslatingBadge'
// P9②：电量卡 + 签到区（用户面 · §28.7「既有渲染点接新取数 · 不新增独立页面」）
import BattCheckinPanel from '../components/BattCheckinPanel'
// 招工线 / 我的 共用的 token + 栅格层（P4-B4c-ii-a）：与 TaskPage 招工线族同一份样式表
import './jobs/jobs.css'
import { fetchApiJson, fetchCurrentUser, getAuthHeaders, updateMyProfile } from '../auth'
import { useAuth } from '../auth-context'
import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../ledger-api'

const toDate = (value) => new Date(typeof value === 'number' ? value * 1000 : value)

const ProfilePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, updateSession, user: sessionUser } = useAuth()
  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）+ 用户录入内容 `bio` 的当前语言值。
  //   ★ 编辑态口径：`bio`/`tempBio` 一律持**原文**（`user.bio`），只有**展示**走 `displayBio`
  //     —— 否则保存时会把译文当原文写回（`updateMyProfile({bio: tempBio})`）。
  const lang = getLanguageFromUrl(location.pathname)
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
  // 批 7-A：「流水」= 已注册读口 `GET /api/user/ledger`（DL25/R95 keyset 分页）的真数据。
  //   `next` = `next_before_txid` 游标（`null` = 到底，不渲染「加载更多」）；真·零流水 ⇒ 空态。
  const [ledger, setLedger] = useState({ rows: [], next: null, message: '' })
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
          loadLedger(null),
        ])
      } catch (error) {
        console.error('Error loading user info:', error)
        toast.error(t('profilePage.loadFailed', { message: error.message }))
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

  // 四项确认 ④：`/api/shard` 已 sunset（恒空态 + 顶层 `deprecated:true`；§5.2「**禁止**新代码再调」）
  //   ⇒ **移除调用**、只保留空态容忍；迁移目标 `GET /api/user/points` **未注册**（现取 `grep` = 0 命中）⇒ 不迁、登记。
  //   （同页 `/api/prize-item` 的调用**保留**：实测该路径 = `listing_order` **买家轴**读面、**未 sunset**，报告 §2-④ 已登记。）
  const loadShardHoldings = async () => {
    setShardHoldings([])
  }

  // 批 7-A：「流水」读口接线（`GET /api/user/ledger`，**已注册**；DL25 keyset 分页）。
  //   `beforeTxid=null` ⇒ 首页；「加载更多」传上一页 `next_before_txid`。真·零流水时才显示空态。
  const loadLedger = async (beforeTxid) => {
    // 收口四 R-2（统一未登录口径）：与 `market/MarketPage.loadLedger` 对齐 ——
    //   未登录 ⇒ **不发请求**、直接本地登录提示（旧行为 = 发出去吃 401 再把服务端错误串当文案）。
    if (!isAuthenticated) {
      setLedger({ rows: [], next: null, message: t('pleaseLogin') })
      return
    }
    try {
      const { rows, nextBeforeTxid } = await fetchMyLedger({
        user: sessionUser,
        beforeTxid: beforeTxid || null,
        limit: LEDGER_PAGE_SIZE,
      })
      setLedger((prev) => ({
        rows: beforeTxid ? [...prev.rows, ...rows] : rows,
        next: nextBeforeTxid,
        message: '',
      }))
    } catch (error) {
      console.warn('Failed to load ledger:', error)
      setLedger((prev) => ({ ...prev, message: String(error?.message || t('error')) }))
    }
  }

  // 加载任务统计
  const loadTaskStats = async (uID) => {
    try {
      const headers = getAuthHeaders(sessionUser)
      const [taskProgressItems, prizeItems] = await Promise.all([
        fetchApiJson('/api/task-progress', { headers }),
        fetchApiJson('/api/prize-item', { headers }).catch(() => []),
      ])

      const stats = {
        totalTasks: (taskProgressItems || []).length,
        completedTasks: 0,
        pendingTasks: 0,
        pendingRewards: 0,
        totalPoints: 0,
        claimedRewards: (prizeItems || []).length,
      }

      for (const taskProgress of taskProgressItems || []) {
        if (taskProgress.time_claimed) {
          stats.completedTasks++
          stats.totalPoints += taskProgress.points_claimed || 0
        } else if (taskProgress.time_checked) {
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
        toast.error(t('profilePage.bioTooShort'))
        return
      }

      const updatedUser = await updateMyProfile({ bio: nextBio }, sessionUser)
      const nextUser = updateSession(updatedUser)
      setUser(nextUser)
      setBio(nextUser.bio || nextBio)
      setTempBio(nextUser.bio || nextBio)
      setIsEditing(false)
      toast.success(t('profilePage.bioSaved'))
    } catch (error) {
      toast.error(t('profilePage.saveFailed', { message: error.message }))
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
        <LoadingPage message={t('common.loadingUser')} />
      </ResponsiveContainer>
    )
  }

  if (!user) {
    return (
      <ResponsiveContainer>
        <Card variant="inactive">
          <CardContent className="text-center py-12">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-4">{t('pleaseLogin')}</p>
            <Button variant="primary" onClick={() => navigate(buildLocalizedPath(lang, '/login'))}>
              {t('profilePage.goLogin')}
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
              {t('profilePage.title')}
            </h1>
            <p className="text-xl text-gray-600">
              {t('profilePage.subtitle')}
            </p>
          </div>
        </FadeIn>

        {/* P9②：电量卡 + 签到区（用户面） */}
        <BattCheckinPanel />

        {/* 用户基本信息 */}
        <SlideUp delay={200}>
          <Card variant="primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{t('profilePage.basicInfo')}</CardTitle>
                {!isEditing ? (
                  <Button
                    variant="proceed"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    {t('common.edit')}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={saveBio}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {t('common.save')}
                    </Button>
                    <Button
                      variant="inactive"
                      size="sm"
                      onClick={cancelEdit}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {t('cancel')}
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
                      {user.EVM ? formatEvmAddress(user.EVM) : t('profilePage.unknownUser')}
                    </h2>
                    {user.is_admin && (
                      <Badge variant="warning" size="sm">{t('common.admin')}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {t('profilePage.registeredAt')}: {user.time_reg ? toDate(user.time_reg).toLocaleDateString() : t('common.unknown')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {t('profilePage.walletAddress')}: {user.EVM ? formatEvmAddress(user.EVM) : t('common.notSet')}
                    </div>
                  </div>
                </div>
              </div>

              {/* 用户简介 */}
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {t('profilePage.bio')}
                  {/* 「翻译中」小标（`i18n_status ∈ {pending, partial}`；ready/缺省 ⇒ null） */}
                  <TranslatingBadge status={contentStatus(user)} />
                </h3>
                {isEditing ? (
                  <textarea
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-500 focus:outline-none resize-none"
                    rows={4}
                    placeholder={t('profilePage.bioPlaceholder')}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg min-h-[100px]">
                    {/* TR-2：展示走当前语言（`bio_<lang>`；空串/缺字段 ⇒ 回落原文 `bio`） */}
                    {pickLocalized(user, 'bio', lang) || bio || t('profilePage.bioEmpty')}
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
              <CardTitle className="text-2xl">{t('profilePage.myAssets')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={2} md={4} gap={4}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {userAssets?.points || 0}
                  </div>
                  <div className="text-sm text-gray-600">{t('common.points')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {taskStats.pendingRewards}
                  </div>
                  <div className="text-sm text-gray-600">{t('common.pending')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {taskStats.claimedRewards}
                  </div>
                  <div className="text-sm text-gray-600">{t('profilePage.redeemedRewards')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {userAssets?.time_update ? toDate(userAssets.time_update).toLocaleDateString() : '—'}
                  </div>
                  <div className="text-sm text-gray-600">{t('profilePage.lastUpdate')}</div>
                </div>
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 账本读数（P4-B4c-ii-a · 「我的」）：余额 = 已注册读口 /api/user/asset/:uID；
            流水 = **已注册读口** `GET /api/user/ledger`（批 7-A 登记；DL25 keyset 分页 / 响应回传 next_before_txid）
            ⇒ 渲染真数据；**仅当真·零流水**时才显示空态。*/}
        <SlideUp delay={500}>
          <div className="sf-jobs" data-sf-m="jobs-profile">
            <div className="sf-jobs-panel" data-sf-m="jobs-balance">
              <h2 className="sf-jobs-title">{t('ledger.balance')}</h2>
              <div className="sf-jobs-row">
                <span className="sf-jobs-pay" data-sf-m="jobs-balance-amount">{userAssets?.points ?? 0}</span>
                <span className="sf-jobs-pay-unit">$</span>
              </div>
              <p className="sf-jobs-meta">{t('ledger.balanceNote')}</p>
            </div>
            <div className="sf-jobs-panel" data-sf-m="jobs-flow">
              <h2 className="sf-jobs-title">{t('ledger.flow')}</h2>
              {ledger.rows.length === 0
                ? <div className="sf-jobs-empty" data-sf-m="jobs-flow-empty">{ledger.message || t('ledger.flowEmpty')}</div>
                : (
                  <div data-sf-m="jobs-flow-list">
                    {ledger.rows.map((entry) => (
                      <div className="sf-jobs-item" key={String(entry.txid)} data-sf-m="jobs-flow-item">
                        <div className="sf-jobs-item-title">{t(`ledger.kind.${entry.kind}`)}</div>
                        <div className="sf-jobs-meta">
                          {`${Number(entry.delta) > 0 ? '+' : ''}${entry.delta}`}
                          {' · '}
                          {entry.time_created ? toDate(entry.time_created).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    ))}
                    {ledger.next != null && (
                      <button
                        type="button"
                        className="sf-jobs-btn"
                        data-sf-m="jobs-flow-more"
                        onClick={() => loadLedger(ledger.next)}
                      >
                        {t('ledger.flowMore')}
                      </button>
                    )}
                  </div>
                )}
            </div>
          </div>
        </SlideUp>

        {/* 任务统计 */}
        <SlideUp delay={600}>
          <Card variant="success">
            <CardHeader>
              <CardTitle className="text-2xl">{t('profilePage.taskAchievements')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={2} md={4} gap={4}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {taskStats.totalTasks}
                  </div>
                  <div className="text-sm text-gray-600">{t('profilePage.totalTasks')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {taskStats.completedTasks}
                  </div>
                  <div className="text-sm text-gray-600">{t('common.completed')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-1">
                    {taskStats.pendingTasks}
                  </div>
                  <div className="text-sm text-gray-600">{t('common.ongoing')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {taskStats.totalPoints}
                  </div>
                  <div className="text-sm text-gray-600">{t('profilePage.totalPoints')}</div>
                </div>
              </ResponsiveGrid>

              {/* 成就徽章 */}
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">{t('profilePage.achievements')}</h3>
                <div className="flex flex-wrap gap-2">
                  {taskStats.completedTasks >= 1 && (
                    <Badge variant="success" className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {t('profilePage.badgeNovice')}
                    </Badge>
                  )}
                  {taskStats.completedTasks >= 5 && (
                    <Badge variant="primary" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {t('profilePage.badgeExpert')}
                    </Badge>
                  )}
                  {taskStats.completedTasks >= 10 && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {t('profilePage.badgeMaster')}
                    </Badge>
                  )}
                  {taskStats.totalPoints >= 1000 && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {t('profilePage.badgePointsPro')}
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
                <CardTitle className="text-2xl">{t('profilePage.shardHoldings')}</CardTitle>
                <Link to={buildLocalizedPath(lang, '/shard')} className="text-sm text-blue-600 hover:text-blue-800 underline">
                  {t('common.goTrade')}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {shardHoldings.length === 0 ? (
                <p className="text-center text-gray-500 py-4">{t('profilePage.noHoldings')}</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {shardHoldings.map((h) => (
                    <div key={h.bID} className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-800">{h.symbol || h.bID}</span>
                      <span className="text-gray-600">{h.volume} {t('common.shardUnit')}</span>
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
