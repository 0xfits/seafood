import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import { Button, Card, CardContent } from '../components/ui'
import { RewardCard } from '../components/reward/RewardCard'
// ★ route §49.16：商品链接段统一取 `item_code`（缺失回落数字 id）。
import { itemLinkId } from '../item-link'
import { SlideUp } from '../components/ui/Motion'
import { ResponsiveContainer } from '../components/ui/Responsive'
import { fetchApiJson, getAuthHeaders } from '../auth'
import { useAuth } from '../auth-context'
import { fetchHomeCampaignTasks, fetchHomeCurrencies } from '../home-api'
import { buildHomeCampaignCards } from '../home-campaign'
import HomeCampaignCard from '../components/campaign/HomeCampaignCard'
import { pickLocalized } from '../i18n-content'
import { PLACEHOLDER_IMAGE } from '../assets/placeholder'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'

// ============================================================================
// 首页（**2026-10-11 合并单** · Kevin 追加裁定）
//   ★ 首页 = **唯一的「闲置物品」列表面**（原 `ListingsPage` 的列表渲染已删 —— 两者本就取同一份 feed
//     `/api/prize/all`，见下方 `loadLegacyHomePayload` / `/api/home` 聚合读口 ⇒ 「不要两份实现」）。
//   并入自 `RewardPage`（已删）的两项能力：① 「我的积分」展示；② 分类筛选（限量版 / 高价值 / 已兑换）。
//     分类筛选的数据面依据（`/api/prize/all` 实际字段，现取，见报告 §筛选判据）：
//       · 限量版   ← `gift_limit` / `time_end`（字段在响应内，本页 `limited` 已派生）
//       · 高价值   ← `points`（字段在响应内，本页 `rarity==='epic'` 已派生，阈值 >5000 承 `RewardPage`）
//       · 已兑换   ← `/api/prize-item`（本页已取，`claimed_prize_ids`）⇒ 三档**均可筛**，故保留（非「永远筛不动」控件）。
//   「我的订单」整块（列表 + 退款/发货/收货 + 空态）**已于 2026-10-14（D7 变更）移出首页**：
//     渲染点迁至 /profile 我的交易-我买到的（组件 `./item/MyOrdersPanel` 保留复用，三写动作仍可达）。
//   ★ 原 `/reward`、`/listing*` 路由已随本单**硬删**（不 301）；卡片动作由「领取」改为「查看详情」（`item.viewDetail`）。
// ============================================================================
/**
 * FEED-PAGING-v1（2026-10-19 · Kevin 指令）
 *   首页商品 = **统一分页读口** `GET /api/prize/all?skip=<n>&limit=36`：
 *     ① 首屏 36 条（= 6 行 × 6 列，列数单另行裁定，本单只管数据面）；
 *     ② 滚到底继续 36/页，**直到某页返回 < 36（或空）**即终止；
 *     ③ 按 `bID` 去重（综合排序稳定，但分页期间新发商品插队会让相邻页出现重叠行）；
 *     ④ 失败即停：保留已加载行 + 「重试」按钮，**不自动重试**（避免无限重试打后端）。
 *   `/api/home` 仍用于 tasks / user_points / claimed_prize_ids（响应形状不动），
 *   **其 `prizes` 字段不再被首页消费** ⇒ 不存在「8 条聚合口」与「36 条分页口」两份实现。
 */
const FEED_PAGE_SIZE = 36

/** 逐页并入 + 按 bID 去重（同一 bID 在后续页重复出现时保留首见行） */
const mergeRewardPage = (prev, incoming) => {
  const seen = new Set(prev.map((row) => row.bID ?? row.listing_id))
  const merged = [...prev]
  for (const row of incoming) {
    const key = row.bID ?? row.listing_id
    if (key == null || key === '' || seen.has(key)) continue
    seen.add(key)
    merged.push(row)
  }
  return merged
}

/**
 * HOME-CAMP-v1（2026-10-21 · Kevin 派单 · 前端半）
 *   首页「热门任务」版块 = **campaign 体系**：改拉公开读口
 *   `GET /api/home/campaign-tasks`（行含 task_id / title / status / joined_count /
 *   reward_* / campaign_title / project_title / project_slug / project_avatar_url
 *   ＋ campaign_id）。
 *   「第一轮」task = 主卡（不在首位 ⇒ 排到第一）；卡 = **读口行的一一映射**（最多 5 张）。
 *   ★ **零 mock / 零补位**：行少就卡少，无（可见）行 ⇒ 版块空态、不造卡 —— 保证首页与
 *   `/campaign` 看到的是**同一批任务**（同一谓词，见 `home-campaign.js`）。
 *   **旧 jobs 悬赏拉取（`/api/home` 的 tasks 消费 + `/api/task/all` 回落）已整块删除，
 *   不再是本页数据面**。
 */
const HomePage = () => {
  // 聚合口 `/api/home` 的 `prize_limit` 参数**保留**（响应形状与其它消费不动）；
  // ★ 但首页商品**不再消费**该字段 —— 见下方 FEED_PAGING 口径；`tasks` 字段同样不再消费。
  const HOME_REWARD_LIMIT = 8
  const navigate = useNavigate()
  const location = useLocation()
  // P6-MISC-FIX ②：站内链接统一走唯一构造器（当前语言前缀），本单补齐 5 处硬编码绝对路径
  const lang = getLanguageFromUrl(location.pathname)
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  // 首页「热门任务」原始行集（campaign 体系；装配 = `buildHomeCampaignCards` 纯映射，零补位）
  const [campaignRows, setCampaignRows] = useState([])
  // 公开币种表 { cid → symbol }（只用于次币符号；失败 ⇒ 空表 ⇒ 次币行不渲染）
  const [symbols, setSymbols] = useState({})
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  // ★ FEED-PAGING-v1 分页态：`feedLoadingMore` = 下一页在飞；`feedHasMore` = 还有下一页；
  //   `feedError` = 某页失败（**失败即停**：不自动重试、只给按钮）
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [feedError, setFeedError] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  // 分类筛选（并入自 `RewardPage`）：all / limited / highValue / claimed
  const [itemFilter, setItemFilter] = useState('all')

  // 分页游标 / 并发闸 / sentinel 锚点。游标只在**请求成功后**前推 ⇒ 失败重试复用同一 skip。
  const feedSkipRef = useRef(0)
  const feedHasMoreRef = useRef(true)
  const feedInFlightRef = useRef(false)
  const feedCtxRef = useRef(null)
  const feedSentinelRef = useRef(null)
  const feedLoadMoreRef = useRef(null)

  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // ★ P6-I18N-LIT-B5 必做②（D7 最后一项）：首页的**旧三目链**（语言后缀 + 空值合并运算符）收口为共用
  //   `pickLocalized`（`src/i18n-content.js`），与其余 8 处已接页一致。
  const mapRewardsForHome = (prizeRows, lang, claimedPrizeIds = new Set()) => (
    (prizeRows || []).map((prize) => {
      const isClaimed = claimedPrizeIds.has(prize.bID)
      const storesCount = prize.stores_count || 0
      return {
        ...prize,
        // 商品分类（迁移 0054 四值 · 承 0053）：`DigitalAutoDeliver` / `DigitalManualDeliver` /
        // `PhysicalFreeShip` / `PhysicalBuyerShip` / `NULL`（裸 `Digital` 已退役）。
        // 读口已透出 `item_type`（route §49.11 ④）⇒ 此处**显式透传**给卡片（`...prize` 已带，写明防丢）。
        // 卡片只在 `PhysicalFreeShip` 时于标题前渲染「包邮」贴纸（design §26.12.1）。
        item_type: prize.item_type ?? null,
        title: pickLocalized(prize, 'name', lang),
        description: pickLocalized(prize, 'description', lang),
        points_required: prize.points || 0,
        status: isClaimed ? 'claimed' : storesCount > 0 ? 'available' : 'locked',
        statusText: isClaimed ? t('common.redeemed') : storesCount > 0 ? t('common.redeemable') : t('common.outOfStock'),
        rarity: prize.points > 5000 ? 'epic' : prize.points > 2000 ? 'rare' : 'common',
        // 媒体单前端阶段 A：真图优先（media_urls[0]）> 旧字段 > 机械鱼占位（assets/placeholder）
        image: prize.media_urls?.[0] || prize.image_url || prize.url_image || PLACEHOLDER_IMAGE,
        claimed: prize.claims_count || 0,
        total: (prize.claims_count || 0) + storesCount,
        limited: Boolean(prize.gift_limit || prize.time_end),
        brand: {
          // 2026-10-11 合并单：品牌行改用**当前语言**的商品名（原 `prize.name` 会把中文原名带进 en/hk/vn 档）
          name: pickLocalized(prize, 'name', lang),
          logo: prize.image_url || prize.url_image || '',
        },
      }
    })
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const { signal } = controller

    // 每次（路由 / 身份变化）都从头分页；游标、并发闸、分页态一并复位
    feedSkipRef.current = 0
    feedHasMoreRef.current = true
    feedInFlightRef.current = false
    setRewards([])
    setFeedHasMore(true)
    setFeedError(false)
    setFeedLoadingMore(false)
    setLoading(true)

    // 本次运行的上下文（供 sentinel 触发的 `loadMore` 读取；卸载时置 cancelled ⇒ 迟到响应一律丢弃）
    const ctx = { signal, cancelled: false, lang: 'zh', claimedIds: new Set() }
    feedCtxRef.current = ctx

    const fetchFeedPage = async (skip) => {
      const rows = await fetchApiJson(
        `/api/prize/all?skip=${skip}&limit=${FEED_PAGE_SIZE}`,
        { signal },
      )
      return Array.isArray(rows) ? rows : []
    }

    // 聚合口不可用时的逐口回落（**只回落 claimed ids / points**；商品仍走分页口、
    // 任务走 campaign 读口 —— 旧 `/api/task/all` 悬赏回落已随 HOME-CAMP-v1 整块删除）
    const loadLegacyHomeMeta = async () => {
      if (!isAuthenticated || !user?.uID) {
        return {
          claimed_prize_ids: [],
          user_points: 0,
        }
      }

      const [claimedPrizeItems, asset] = await Promise.all([
        fetchApiJson('/api/prize-item', { headers: getAuthHeaders(user), signal }).catch(() => []),
        fetchApiJson(`/api/user/asset/${user.uID}`, { signal }).catch(() => ({ points: 0 })),
      ])

      return {
        claimed_prize_ids: (claimedPrizeItems || []).map((prizeItem) => prizeItem.bID),
        user_points: asset?.points || 0,
      }
    }

    const loadData = async () => {
      try {
        const currentLang = getCurrentLang()
        ctx.lang = currentLang
        const headers = isAuthenticated ? getAuthHeaders(user) : undefined

        // 聚合口（points / claimed ids）与**首屏 36 条**、campaign 任务、币种表并行；
        //   任一失败各自独立处置：聚合口失败 ⇒ 既有逐口回落（再失败才 toast）；
        //   首屏商品页失败 ⇒ 列表区出「重试」；campaign 读口失败 ⇒ 空行集 ⇒ 版块空态（零假卡，不塌）；
        //   币种表失败 ⇒ 空表 ⇒ 次币行不渲染。
        const metaTask = fetchApiJson(
          `/api/home?prize_limit=${HOME_REWARD_LIMIT}`,
          { headers, signal },
        ).catch(async (homeError) => {
          console.warn('Home aggregate endpoint failed, falling back to legacy requests:', homeError)
          return loadLegacyHomeMeta()
        })
        // ★ HOME-CAMP-v1：热门任务改拉 campaign 读口（**独立失败处置**，失败不阻断页首其余数据）
        const campaignTask = fetchHomeCampaignTasks(user)
          .then((rows) => (Array.isArray(rows) ? rows : []))
          .catch((campaignError) => {
            console.warn('Home campaign tasks endpoint failed, rendering empty state:', campaignError)
            return []
          })
        const currenciesTask = fetchHomeCurrencies(user)
          .then((currencies) => {
            const map = {}
            for (const currency of (Array.isArray(currencies) ? currencies : [])) {
              if (currency?.cid != null && currency?.symbol) map[String(currency.cid)] = String(currency.symbol)
            }
            return map
          })
          .catch(() => ({}))
        const firstPageTask = fetchFeedPage(0).then(
          (rows) => ({ ok: true, rows }),
          (error) => ({ ok: false, error }),
        )

        const homePayload = await metaTask
        const [campaignRowsData, symbolsData, firstPage] = await Promise.all([campaignTask, currenciesTask, firstPageTask])
        if (cancelled) return

        const claimedPrizeIds = new Set(homePayload?.claimed_prize_ids || [])
        ctx.claimedIds = claimedPrizeIds
        setCampaignRows(campaignRowsData)
        setSymbols(symbolsData)
        setUserPoints(homePayload?.user_points || 0)

        if (firstPage.ok) {
          feedSkipRef.current = firstPage.rows.length
          setRewards(mergeRewardPage([], mapRewardsForHome(firstPage.rows, currentLang, claimedPrizeIds)))
          const hasMore = firstPage.rows.length >= FEED_PAGE_SIZE
          feedHasMoreRef.current = hasMore
          setFeedHasMore(hasMore)
        } else {
          console.error('Load feed error:', firstPage.error)
          setFeedError(true)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Load data error:', error)
          toast.error(t('homePage.loadFailed', { message: error.message }))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // ★ 下一页：同一时刻**只允许一个在飞**（并发防重）；返回 < 36 ⇒ 终止。
    const loadMore = async () => {
      if (cancelled || ctx.cancelled) return
      if (feedInFlightRef.current || !feedHasMoreRef.current) return
      feedInFlightRef.current = true
      setFeedLoadingMore(true)
      setFeedError(false)
      try {
        const rows = await fetchFeedPage(feedSkipRef.current)
        if (cancelled || ctx.cancelled) return
        feedSkipRef.current += rows.length
        setRewards((prev) => mergeRewardPage(prev, mapRewardsForHome(rows, ctx.lang, ctx.claimedIds)))
        const hasMore = rows.length >= FEED_PAGE_SIZE
        feedHasMoreRef.current = hasMore
        setFeedHasMore(hasMore)
      } catch (error) {
        // 失败即停：不自动重试，交给「重试」按钮（复用同一 skip）
        if (!cancelled && !ctx.cancelled) {
          console.error('Load more feed error:', error)
          setFeedError(true)
        }
      } finally {
        feedInFlightRef.current = false
        if (!cancelled && !ctx.cancelled) setFeedLoadingMore(false)
      }
    }
    feedLoadMoreRef.current = loadMore

    loadData()
    return () => {
      cancelled = true
      ctx.cancelled = true
      feedInFlightRef.current = false
      controller.abort()
    }
  }, [isAuthenticated, location.pathname, user?.uID, user?.token, user?.access_token])

  // 底部 sentinel 观察器：**只在「已出列表 ∧ 还有下一页 ∧ 无错误 ∧ 首屏已完成」时挂载**，卸载即 disconnect。
  // 依赖里带 `rewards.length` ⇒ 一页落地后重挂：若 sentinel 仍在视口内（列表未铺满屏）会立刻再取下一页，
  // 直到某页返回 < 36（自然终止）。★ 不读 `window.innerWidth` / `matchMedia`（外壳禁令口径）。
  useEffect(() => {
    if (loading || feedError || !feedHasMore) return undefined
    const node = feedSentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        const loadMore = feedLoadMoreRef.current
        if (typeof loadMore === 'function') loadMore()
      },
      { rootMargin: '320px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading, feedError, feedHasMore, rewards.length])

  // ★ 合并单：卡片动作 = 「查看该闲置物品详情」（原 `/reward` 已硬删）。
  //   `RewardCard` 的 `actionLabelKey='item.viewDetail'` 同时**解禁**按钮（查看不受积分门槛约束）。
  //   ★ route §49.16：链接段 = `item_code`（规范形），缺失回落数字 `listing_id`（旧读口降级）。
  const handleRewardAction = (reward) => {
    const id = itemLinkId(reward)
    if (id == null) return
    navigate(buildLocalizedPath(lang, `/item/${id}`))
  }

  // 「重试」按钮：**只在用户点**时才重发（失败即停口径，绝不自动循环重试）；复用同一 skip。
  const handleFeedRetry = () => {
    setFeedError(false)
    const loadMore = feedLoadMoreRef.current
    if (typeof loadMore === 'function') loadMore()
  }

  // ★ v1.20 §22 `T112`（整卡可点击）：卡片链接目标 —— 与 `handleRewardAction` 同一 id 口径，
  //   仍走**唯一构造器** `buildLocalizedPath`（`utils.js:115`）；id 缺失 ⇒ 不传 `to`（卡片回落非链接容器）。
  const rewardPath = (reward) => {
    const id = itemLinkId(reward)
    return id == null ? undefined : buildLocalizedPath(lang, '/item/' + id)
  }

  const FILTERS = [
    { key: 'all', labelKey: 'item.filterAll', count: rewards.length },
    { key: 'limited', labelKey: 'item.filterLimited', count: rewards.filter((r) => r.limited).length },
    { key: 'highValue', labelKey: 'item.filterHighValue', count: rewards.filter((r) => r.rarity === 'epic').length },
    { key: 'claimed', labelKey: 'item.filterClaimed', count: rewards.filter((r) => r.status === 'claimed').length },
  ]
  const filteredRewards = rewards.filter((r) => {
    if (itemFilter === 'limited') return r.limited
    if (itemFilter === 'highValue') return r.rarity === 'epic'
    if (itemFilter === 'claimed') return r.status === 'claimed'
    return true
  })

  // ★ HOME-CAMP-v1：版块卡 = 读口行的**纯映射**（第一轮置首 / 最多 5 张 / 零补位）。
  //   空数组 ⇒ 渲染层走空态（不造假卡）。装配是纯函数 ⇒ 每次渲染重算的代价与原先一致。
  const homeCampaignCards = buildHomeCampaignCards(campaignRows)

  if (loading) {
    return (
      <ResponsiveContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-gray-600">{t('homePage.loading')}</div>
        </div>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8" data-sf-m="home-item-list">
        {/* ★ 2026-10-21（Kevin）：首页**去除动画容器** —— hero 直接落 `<section>`，
            不再套 `FadeIn`（`animate-fade-in` 的 `<div>`）。`Motion.jsx` / `animations.css` 的
            `.animate-fade-in` 保留（其它页仍用），此处只是首页零容器。 */}
        <section className="bg-gradient-to-r from-yellow-50 to-blue-50 rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('homePage.welcome')}</h1>
          <p className="text-xl text-gray-600 mb-6">
            {t('homePage.heroLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>{t('homePage.heroTail')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={isAuthenticated ? '/task' : '/register'}>
              <Button variant="primary" size="lg">
                {isAuthenticated ? t('homePage.continueTask') : t('homePage.registerNow')}
              </Button>
            </Link>
            {/* 发布入口（Kevin 裁定④）：原「查看奖励」→ 首页唯一列表的发布入口 `/item/new` */}
            <Link to={buildLocalizedPath(lang, '/item/new')} data-sf-m="home-publish-link">
              <Button variant="secondary" size="lg">{t('item.publish')}</Button>
            </Link>
          </div>
        </section>

        {/* 「我的积分」卡已于 2026-10-21（Kevin 裁定）**整体迁出**首页 ⇒ `/profile/assets`
            （钩子 `assets-my-points`，数据面 = 同页 `GET /api/user/balances` 的 `$`（cid 1）值）。
            首页不留空壳 / 占位：本位置**零渲染**。 */}

        <SlideUp delay={200}>
          {/* HOME-CAMP-v1：「热门任务」= campaign 体系卡（第一轮主卡置首）。
              ★ 卡 = 读口行的一一映射（最多 5 张），**零 mock / 零补位**：无可见行 ⇒ 空态
              （复用既有键 `taskPage.emptyAvailable/Hint`，零新增 i18n），版块不造假卡 ——
              与 `/campaign` 同一谓词、同一批任务。
              「查看全部」指向活动列表 `/campaign`（旧 jobs 悬赏拉取已删 ⇒ 不再指 `/task`）。 */}
          <section data-sf-m="home-camp">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('homePage.hotTasks')}</h2>
                <p className="text-gray-600">{t('homePage.hotTasksLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span></p>
              </div>
              <Link to={buildLocalizedPath(lang, '/campaign')}>
                <Button variant="proceed">{t('common.viewAll')}</Button>
              </Link>
            </div>

            {homeCampaignCards.length === 0 ? (
              <div className="sf-home-camp-empty" data-sf-m="home-camp-empty">
                <p className="text-lg text-gray-600">{t('taskPage.emptyAvailable')}</p>
                <p className="text-sm mt-2 text-gray-500">{t('taskPage.emptyAvailableHint')}</p>
              </div>
            ) : (
              <div className="sf-home-camp-grid" data-sf-m="home-camp-grid">
                {homeCampaignCards.map((card) => (
                  <HomeCampaignCard
                    key={`task-${String(card.taskId)}`}
                    card={card}
                    lang={lang}
                    t={t}
                    symbols={symbols}
                  />
                ))}
              </div>
            )}
          </section>
        </SlideUp>

        <SlideUp delay={400}>
          <section data-sf-m="home-items">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('homePage.featuredRewards')}</h2>
              <p className="text-gray-600">{t('homePage.featuredLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>{t('homePage.featuredTail')}</p>
            </div>

            {/* 分类筛选（并入自 `RewardPage`）—— 计数随数据面实时派生（三档均可筛，见文件头判据） */}
            <div className="flex flex-wrap gap-2 mb-6" data-sf-m="home-item-filter" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={itemFilter === f.key}
                  className={`px-3 py-1.5 rounded-md text-sm border ${itemFilter === f.key ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'}`}
                  data-sf-filter={f.key}
                  onClick={() => setItemFilter(f.key)}
                >
                  {t(f.labelKey)} ({f.count})
                </button>
              ))}
            </div>

            {filteredRewards.length > 0 ? (
              /* ★ 2026-10-21（Kevin）：卡**直落网格子项** —— 去掉了 `StaggerContainer`（本身即
                 `space-y-4` + 逐子 `FadeIn` = 两层 `animate-fade-in` 容器）与逐卡 `FadeIn`。
                 卡根 `RewardCard` 的 `.sf-reward-card` 直接成为 `.sf-grid` 的子项，几何由
                 `reward-card.css`（卡高 392 / 图 240 / 四行 48|32|24|48）与 CSS 断点列数保证。
                 本页因此零 `animate-fade-in`；`Motion.jsx` / `animations.css` 原样保留（其它页在用）。 */
              <>
                {/* 首屏 / 已加载商品容器（受测钩子 `feed-grid`；卡数 = 子节点卡数）
                    ★ T121（design v1.24 §25）：列数**只由 CSS 断点决定**，禁 JS 宽度读数
                      （`ResponsiveGrid` 走 `window.innerWidth` ⇒ 不用于本网格）。
                      基础 768–1279 = 4 列（`--sf-st-feed-cols`，shell.css `.sf-grid`）；
                      ≥1280 = 6 列（styles.css 顶层 `@media (min-width:1280px)` 覆盖 `.sf-feed`）；
                      ≤767 = 2 列（`.sf-grid` 唯一 767 断点块，`--sf-st-feed-cols-m`）。 */}
                <div className="sf-grid sf-feed" data-sf-m="feed-grid">
                  {filteredRewards.map((reward) => (
                    <RewardCard
                      key={reward.bID}
                      reward={reward}
                      to={rewardPath(reward)}
                      onClaim={handleRewardAction}
                      userPoints={userPoints}
                      showStatus={true}
                      actionLabelKey="item.viewDetail"
                    />
                  ))}
                </div>
              </>
            ) : feedError ? (
              <Card variant="inactive">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500" data-sf-m="feed-error">{t('uiCommon.loadFailed')}</p>
                  <Button variant="secondary" size="sm" className="mt-4" data-sf-m="feed-retry" onClick={handleFeedRetry}>
                    {t('uiError.retry')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card variant="inactive">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">{t('item.empty')}</p>
                </CardContent>
              </Card>
            )}

            {/* ★ 无限加载锚点：IntersectionObserver 监听本节点 ⇒ 进视口即取下一页（36/页，<36 终止）。
                失败即停（不自动重试）⇒ 出「重试」按钮，复用同一 skip。到底 ⇒ 出「没有更多数据了」。 */}
            {rewards.length > 0 && (
              <div
                ref={feedSentinelRef}
                data-sf-m="feed-sentinel"
                aria-live="polite"
                className="mt-6 flex flex-col items-center gap-3"
              >
                {feedLoadingMore && (
                  <div data-sf-m="feed-loading" className="text-sm text-gray-500">{t('loading')}</div>
                )}
                {feedError && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm text-red-600" data-sf-m="feed-error">{t('uiCommon.loadFailed')}</span>
                    <Button variant="secondary" size="sm" data-sf-m="feed-retry" onClick={handleFeedRetry}>
                      {t('uiError.retry')}
                    </Button>
                  </div>
                )}
                {!feedHasMore && !feedError && !feedLoadingMore && (
                  <div data-sf-m="feed-end" className="text-sm text-gray-400">{t('uiCommon.noMoreData')}</div>
                )}
              </div>
            )}
          </section>
        </SlideUp>

        {/* D7 变更（2026-10-14）：「我的订单」整块移出首页 —— 渲染点迁至 /profile 我的交易-我买到的
            （`./item/MyOrdersPanel` 保留复用；退款/发货/收货三写动作在 profile 侧仍可达，首页零死钩子）。 */}
      </div>

      {/* HOME-CAMP-v1：旧 jobs 卡片动作已整块移出首页；`ActiveTaskModal` / `ClaimRewardModal`
          随 job 体系弃用（Kevin 2026-10-21）**连文件一并删除**，首页与 /task 列表页均不再消费。 */}
    </ResponsiveContainer>
  )
}

export default HomePage
