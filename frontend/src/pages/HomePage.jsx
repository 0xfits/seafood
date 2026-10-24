import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { FEED_SORTS, mergeFeedRows, normalizeFeedSort, sortFeedRows } from '../home-feed-order'
import { captureFeedCardRects, playFeedFlip } from '../home-feed-flip'

// ============================================================================
// 首页（**2026-10-11 合并单** · Kevin 追加裁定）
//   ★ 首页 = **唯一的「闲置物品」列表面**（原 `ListingsPage` 的列表渲染已删 —— 两者本就取同一份 feed
//     `/api/prize/all`，见下方 `loadLegacyHomePayload` / `/api/home` 聚合读口 ⇒ 「不要两份实现」）。
//   并入自 `RewardPage`（已删）的两项能力：① 「我的积分」展示（**2026-10-21 已迁出至 `/profile/assets`**）；
//     ② ~~分类筛选（限量版 / 高价值 / 已兑换）~~ —— **2026-10-22（Kevin）整块下架**：
//        四标签与其计数芯片、以及基于它们的客户端过滤（`filteredRewards`）一并删除，
//        改为两标签【推荐】(默认) / 【新发】，数据面由读口 `?sort=recommend|new` 承担
//        （口径见下方 FEED-SORT-v1；「限量版 / 高价值 / 已兑换」三档不再在首页出现）。
//   「我的订单」整块（列表 + 退款/发货/收货 + 空态）**已于 2026-10-14（D7 变更）移出首页**：
//     渲染点迁至 /profile 我的交易-我买到的（组件 `./item/MyOrdersPanel` 保留复用，三写动作仍可达）。
//   ★ 原 `/reward`、`/listing*` 路由已随本单**硬删**（不 301）；卡片动作由「领取」改为「查看详情」（`item.viewDetail`）。
// ============================================================================
/**
 * FEED-PAGING-v2（2026-10-22 · Kevin 改口：排序改回前端）
 *   首页商品 = **统一分页读口** `GET /api/prize/all?skip=<n>&limit=36`（**不带 `sort`**）：
 *     ① 首屏 36 条（= 6 行 × 6 列）；
 *     ② 滚到底继续 36/页，**直到某页返回 < 36（或空）**、或累计到 `FEED_MAX_ITEMS` 即终止；
 *        ⇒ 首页**不分页**（无页码 UI），滚动加载至多 **18 行**（6 列 × 18 = 108 件）；
 *     ③ 按 `bID` 去重（服务器默认序稳定，分页期间新发商品插队仍可能造成相邻页重叠行）；
 *     ④ 失败即停：保留已加载行 + 「重试」按钮，**不自动重试**（避免无限重试打后端）。
 *   ★ 读口只负责「取下一页」；**序在客户端**（`../home-feed-order.js`）——
 *     服务器默认顺序（score desc, time_created desc, id desc）保持不变 ⇒ 滚动加载不重不漏。
 *   `/api/home` 仍用于 tasks / user_points / claimed_prize_ids（响应形状不动），
 *   **其 `prizes` 字段不再被首页消费** ⇒ 不存在「8 条聚合口」与「36 条分页口」两份实现。
 */
const FEED_PAGE_SIZE = 36
/** 滚动加载上限：18 行 × 6 列 = 108 件（首页不分页，止于此）。 */
const FEED_MAX_ROWS = 18
const FEED_MAX_ITEMS = FEED_MAX_ROWS * 6 // 108 = 6 列 × 18 行

/**
 * FEED-SORT-v2（2026-10-22 · Kevin 改口：「排序改回前端」）
 *   两标签【推荐】(默认) / 【新发】的**序由前端算**（`../home-feed-order.js` 纯函数，唯一真源）：
 *     · `recommend`：`feed_score` 降序 → `time_created` 降序 → `bID` 降序
 *       （`feed_score` = 后端 FEED-RANK-v2 五因子分的数字字符串，前端只读不算）；
 *     · `new`      ：`time_created` 降序 → `bID` 降序。
 *   ★ **切档零网络**：点标签只重排已加载行（`rewards` 是「到达序」源，渲染序 = 纯函数派生），
 *     既不发请求、也不重置游标、也不重拉聚合口 / campaign / 币种。
 *   ★ 每页 append 之后**重新应用当前档排序** ⇒ 新行落到该在的位置（不是简单追加到末尾）。
 *   ★ 缺 `feed_score` 的旧缓存行 ⇒ 按 0 处理（排序仍稳定，不清列表、不报错）。
 *   ★ 位置变化的**动态效果** = FLIP（`../home-feed-flip.js`，≤300ms，reduced-motion 瞬时降级）。
 *   ★ 闭集归一（`normalizeFeedSort`）保留：非法值一律回退 `recommend`。
 */

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
  // ★ FEED-PAGING-v2 分页态：`feedLoadingMore` = 下一页在飞；`feedHasMore` = 还有下一页；
  //   `feedError` = 某页失败（**失败即停**：不自动重试、只给按钮）
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [feedError, setFeedError] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  // ★ FEED-SORT-v2：两标签「推荐（默认）/ 新发」= **纯客户端排序档**（切档零网络请求）
  const [feedSort, setFeedSort] = useState('recommend')
  // 渲染序 = 到达序 × 当前档（纯函数派生；切档重算，不请求）。缺 `feed_score` 的行按 0 处理。
  const orderedRewards = useMemo(() => sortFeedRows(rewards, feedSort), [rewards, feedSort])

  // 分页游标 / 并发闸 / sentinel 锚点。游标只在**请求成功后**前推 ⇒ 失败重试复用同一 skip。
  const feedSkipRef = useRef(0)
  const feedHasMoreRef = useRef(true)
  const feedInFlightRef = useRef(false)
  const feedCtxRef = useRef(null)
  // 已到达行的**唯一真源**（到达序）：`rewards` 状态由它派生 ⇒ append 时先合并去重再入库
  const feedRowsRef = useRef([])
  // 已落地的元面（lang + claimed ids）：续页沿用同一批 claimed ids ⇒ 卡状态与首屏一致
  const feedMetaRef = useRef({ lang: 'zh', claimedIds: new Set() })
  const feedSentinelRef = useRef(null)
  const feedLoadMoreRef = useRef(null)
  // ★ FLIP：切档前记录的旧矩形 / 网格容器 / 续页滚动锚点（旧行保留不跳位）
  const feedGridRef = useRef(null)
  const flipBeforeRef = useRef(null)
  const scrollAnchorRef = useRef(null)

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

  /**
   * 落地一页行（首屏 / 续页共用）：合并去重 → 入库（到达序）→ 判是否还有下一页。
   * ★ 上限：累计到 `FEED_MAX_ITEMS`（108 = 6 列 × 18 行）即终止（首页不分页）。
   * ★ 排序不在这里做：渲染序由 `orderedRewards` 纯函数按**当前档**派生 ⇒ append 后自动归位。
   */
  const applyFeedRows = useCallback((incoming, { replace = false } = {}) => {
    const merged = mergeFeedRows(replace ? [] : feedRowsRef.current, incoming)
    // 上限截断（正常路径 = 3 页 × 36 = 108，恰好在界内；此处只兜满页边界）
    const next = merged.length > FEED_MAX_ITEMS ? merged.slice(0, FEED_MAX_ITEMS) : merged
    feedRowsRef.current = next
    const fullPage = Array.isArray(incoming) && incoming.length >= FEED_PAGE_SIZE
    const hasMore = fullPage && next.length < FEED_MAX_ITEMS
    feedHasMoreRef.current = hasMore
    setFeedHasMore(hasMore)
    setRewards(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const { signal } = controller

    // 游标、并发闸、分页态一并复位（真·重载 = 上下文变了：身份 / 语言前缀 / token）。
    // ★ 2026-10-22 起 `feedSort` **不在本 effect 的依赖里**：切档只重排已加载行（零网络）。
    feedSkipRef.current = 0
    feedHasMoreRef.current = true
    feedInFlightRef.current = false
    feedRowsRef.current = []
    setFeedError(false)
    setFeedLoadingMore(false)
    setFeedHasMore(true)
    setRewards([])
    setLoading(true)

    // 本次运行的上下文（供 sentinel 触发的 `loadMore` 读取；卸载时置 cancelled ⇒ 迟到响应一律丢弃）
    const ctx = {
      signal,
      cancelled: false,
      lang: feedMetaRef.current.lang,
      claimedIds: feedMetaRef.current.claimedIds,
    }
    feedCtxRef.current = ctx

    const fetchFeedPage = async (skip) => {
      // ★ 读口只负责「取下一页」：**不带 `sort`** ⇒ 服务器默认序（score desc, time desc, id desc）
      //   全档一致 ⇒ 滚动加载不重不漏；序在客户端按当前档算（`home-feed-order.js`）。
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

    // 首屏落地：成功 ⇒ 入库（到达序）+ 前推游标；失败 ⇒ 停（「重试」按钮复用同一 skip）
    const applyFirstPage = (firstPage, currentLang) => {
      if (firstPage.ok) {
        feedSkipRef.current = firstPage.rows.length
        applyFeedRows(mapRewardsForHome(firstPage.rows, currentLang, ctx.claimedIds), { replace: true })
        return
      }
      console.error('Load feed error:', firstPage.error)
      setFeedHasMore(false)
      setFeedError(true)
    }

    const loadData = async () => {
      try {
        const currentLang = getCurrentLang()
        ctx.lang = currentLang
        // 上下文变了 ⇒ 重排用的排序档**保持用户当前选择**（不因重载被重置）
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
        // ★ HOME-CAMP-v1：热门任务改拉 campaign 读口（**独立失败处置**，不阻断页首其余数据）
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
        feedMetaRef.current = { lang: currentLang, claimedIds: claimedPrizeIds }
        setCampaignRows(campaignRowsData)
        setSymbols(symbolsData)
        setUserPoints(homePayload?.user_points || 0)

        applyFirstPage(firstPage, currentLang)
      } catch (error) {
        if (!cancelled) {
          console.error('Load data error:', error)
          toast.error(t('homePage.loadFailed', { message: error.message }))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    // ★ 下一页：同一时刻**只允许一个在飞**（并发防重）；返回 < 36 或累计满 108 ⇒ 终止。
    const loadMore = async () => {
      if (cancelled || ctx.cancelled) return
      if (feedInFlightRef.current || !feedHasMoreRef.current) return
      feedInFlightRef.current = true
      setFeedLoadingMore(true)
      setFeedError(false)
      // ★ 续页滚动锚点：记下当前视口内第一张卡的位置 —— 新行按当前档插到上方时，
      //   布局位移用「同量回滚」抵消（见下方 `useLayoutEffect`）⇒ 用户视感不跳。
      const grid = feedGridRef.current
      scrollAnchorRef.current = null
      if (grid && typeof grid.children !== 'undefined') {
        for (const node of grid.children) {
          const rect = node.getBoundingClientRect()
          if (rect.bottom > 0) {
            scrollAnchorRef.current = { node, top: rect.top }
            break
          }
        }
      }
      try {
        const rows = await fetchFeedPage(feedSkipRef.current)
        if (cancelled || ctx.cancelled) return
        feedSkipRef.current += rows.length
        applyFeedRows(mapRewardsForHome(rows, ctx.lang, ctx.claimedIds))
      } catch (error) {
        // 失败即停：不自动重试，交给「重试」按钮（复用同一 skip）
        scrollAnchorRef.current = null
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
  }, [applyFeedRows, isAuthenticated, location.pathname, user?.uID, user?.token, user?.access_token])

  // ★ 续页滚动锚点回滚：新行按当前档插到已看内容上方时，浏览器会把视口「推下去」——
  //   这里把同一位移按 delta 反向滚回来（`prefers-reduced-motion` 也走这条：属布局修正，不是动画）。
  //   jsdom / 无布局环境下 `getBoundingClientRect` 恒 0 ⇒ delta 0 ⇒ 不触发（零副作用）。
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current
    scrollAnchorRef.current = null
    if (!anchor || !anchor.node) return
    if (anchor.node.isConnected === false) return // 节点已被换掉（例如重载）⇒ 不滚
    if (typeof anchor.node.getBoundingClientRect !== 'function') return
    const delta = anchor.node.getBoundingClientRect().top - anchor.top
    if (Math.abs(delta) >= 1 && typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
      window.scrollBy(0, delta)
    }
  }, [rewards])

  // ★ FLIP play 半步：切档 → 重排已在 render 里完成（`orderedRewards`）⇒ commit 之后
  //   逐卡从「旧矩形」平移到新位置（invert + play）；reduced-motion 由 `playFeedFlip` 内部降级为瞬时。
  useLayoutEffect(() => {
    const before = flipBeforeRef.current
    flipBeforeRef.current = null
    if (!before) return
    playFeedFlip(feedGridRef.current, before)
  }, [feedSort])

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

  // ★ FEED-SORT-v2（2026-10-22）：切档 = **纯客户端重排** —— 只改排序档，不发请求、
  //   不重置游标、不重拉聚合口 / campaign / 币种。FLIP 的「F」在此处先记录旧矩形（重排前）。
  const handleFeedSortChange = (next) => {
    const target = normalizeFeedSort(next)
    if (target === feedSort) return // 同档点击：零重排、零动画、零请求
    flipBeforeRef.current = captureFeedCardRects(feedGridRef.current)
    setFeedSort(target)
  }

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
        {/* ★ 2026-10-24（Kevin）：视觉隐藏 `<h1>` —— hero 删除后首页曾**零 h1**（大纲无起点）。
            口径：文案复用现役键 `siteBrand`（**零新 i18n 键**）；样式为**普通工具类**
            `.sf-visually-hidden`（`styles.css` 顶层，不入 @media、不加主题 token / CSS 变量）。
            该元素绝对定位 1px ⇒ 不参与文档流；`space-y-8` 只给它挂 margin-block-end，页面几何零变化。 */}
        <h1 className="sf-visually-hidden">{t('siteBrand')}</h1>
        {/* ★ 2026-10-24（Kevin）：首页 hero 版块**整块删除** —— 标题（`homePage.welcome`）、
            辅文（`heroLead` / `heroTail`）、两个 CTA（继续任务/立即注册 + 发布入口 `/item/new`）
            一并下线；发布入口**不从 UI 给出**（裁定：暂不给，也不留隐藏链接）。
            连带：首页现**零 `<h1>`**、零 `home-publish-link` 钩子。
            渐变背景（`bg-gradient-to-r from-yellow-50 to-blue-50` + `rounded-2xl` + `p-8`）
            **只移不改**，落到下方【热门任务】容器（`data-sf-m="home-camp"`，钩子名不变）。
            注：首页仍**零 `animate-fade-in`** 容器（`Motion.jsx` / `animations.css` 保留，其它页在用）。 */}

        {/* 「我的积分」卡已于 2026-10-21（Kevin 裁定）**整体迁出**首页 ⇒ `/profile/assets`
            （钩子 `assets-my-points`，数据面 = 同页 `GET /api/user/balances` 的 `$`（cid 1）值）。
            首页不留空壳 / 占位：本位置**零渲染**。 */}

        <SlideUp delay={200}>
          {/* HOME-CAMP-v1：「热门任务」= campaign 体系卡（第一轮主卡置首）。
              ★ 卡 = 读口行的一一映射（最多 5 张），**零 mock / 零补位**：无可见行 ⇒ 空态
              （复用既有键 `taskPage.emptyAvailable/Hint`，零新增 i18n），版块不造假卡 ——
              与 `/campaign` 同一谓词、同一批任务。
              「全部悬赏」指向活动列表 `/campaign`（旧 jobs 悬赏拉取已删 ⇒ 不再指 `/task`）。
              ★ 2026-10-24（Kevin）：hero 整块删除后，其渐变背景（`bg-gradient-to-r
              from-yellow-50 to-blue-50` + `rounded-2xl` + `p-8`）**只移到此容器** —— 零新类、
              零新 token（类名均已在 `styles/tailwind-compat.css`），且**不加** `text-center`、
              不加边框/阴影；钩子名 `home-camp` 不变（探针依赖）。 */}
          <section data-sf-m="home-camp" className="bg-gradient-to-r from-yellow-50 to-blue-50 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              {/* ★ 2026-10-24（Kevin）：标题与说明**并成一行**（原 h2 + 独立 <p> 两行）。
                  实现要点：① 同行容器 = `flex flex-wrap items-start gap-2`（`items-start` 使两盒顶边对齐，
                  探针判据「rect.top 差 ≤2px」由此成立；`items-baseline` 因字号差 24/14 会让顶差 ≈8px，
                  且本仓库 compat CSS 未登记该工具类）；② 说明降为 `<span>`（块级 <p> 无法同行）
                  且字号 16→14px（`text-sm`）；③ `flex-wrap` 窄屏自动换行 ⇒ 不挤压右侧 chip；
                  另加 `flex-1`（basis 0 ⇒ 本行按「剩余宽度」收缩、超宽时行内换行），
                  实测 390 档若无此项，行 max-content 会把右侧 chip 挤窄 ~2px 令其文字折行（基线 82×33.59）。
                  文案键 / 层级（仍 h2 + 说明文字）一字未改。 */}
              <div className="flex flex-wrap items-start gap-2 flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{t('homePage.hotTasks')}</h2>
                <span data-sf-m="home-camp-lead" className="text-sm text-gray-600">{t('homePage.hotTasksLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span></span>
              </div>
              <Link className="sf-chip" data-sf-m="home-viewall" to={buildLocalizedPath(lang, '/campaign')}>
                {/* ★ 2026-10-24（Kevin）二次收口：入口改用**公共 chip 类 `.sf-chip`**
                    （透明底 + 1px 细边框 + 次要文字色，hover 抬升 1px），不再取 `Button` 的
                    ghost 变体 —— 与首页两个 feed tab 同一套视觉语法，且弱于版块主位。
                    钩子 `home-viewall` 不变（探针/单测锤）。`<Link>` 本体承载类名 ⇒ 探针仅需一次
                    `querySelector('[data-sf-m="home-viewall"]')`。 */}
                {t('common.viewAll')}
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
            {/* ★ 2026-10-24（Kevin）：与【热门任务】同款改造 —— 标题与说明并成一行
                （`flex flex-wrap items-start gap-2` + 说明降 `<span>` 且 `text-sm`）。
                本块右侧无 chip ⇒ 不需要 `flex-1` 的收缩保护；窄屏 `flex-wrap` 自动换行。 */}
            <div data-sf-m="home-featured-head" className="mb-6 flex flex-wrap items-start gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{t('homePage.featuredRewards')}</h2>
              <span data-sf-m="home-featured-lead" className="text-sm text-gray-600">{t('homePage.featuredLead')}<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>{t('homePage.featuredTail')}</span>
            </div>

            {/* ★ FEED-SORT-v2（2026-10-22 · Kevin）：两标签【推荐】(默认) / 【新发】。
                切档 = **纯客户端重排已加载行**（零网络请求）+ FLIP 位移动画（≤300ms，
                `prefers-reduced-motion` ⇒ 瞬时）。不再改 `sort` 参数、不再重取首屏。 */}
            <div
              className="flex flex-wrap gap-2 mb-6"
              data-sf-m="home-item-filter"
              role="tablist"
            >
              {FEED_SORTS.map((sort) => (
                <button
                  key={sort.key}
                  type="button"
                  role="tab"
                  aria-selected={feedSort === sort.key}
                  className={`sf-chip${feedSort === sort.key ? ' is-active' : ''}`}
                  data-sf-sort={sort.key}
                  data-sf-m={`feed-tab-${sort.key}`}
                  onClick={() => handleFeedSortChange(sort.key)}
                >
                  {t(sort.labelKey)}
                </button>
              ))}
            </div>

            {/* 切档不再有「pending 首屏」阶段（零请求 ⇒ 无在飞）：提示块与 `aria-busy` 一并撤除 */}

            {orderedRewards.length > 0 ? (
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
                <div className="sf-grid sf-feed" data-sf-m="feed-grid" ref={feedGridRef}>
                  {orderedRewards.map((reward) => (
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
            {orderedRewards.length > 0 && (
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
