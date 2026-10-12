// AC-2（可达性 / 入口不丢失 · §19.8 详情页返回 + §20.9 /messages 真页）+ AC-3（未读角标 · T103）真跑
import {
  launch, openPage, gotoL, settle, isVisible, countOf, ITEM_ID, SELLER_UID, BUYER_UID, CONV_ID, ARTDIR,
} from './lib.mjs'
import { writeFileSync } from 'node:fs'

setTimeout(() => { console.error('WATCHDOG 8min'); process.exit(3) }, 480000)

const BACK = '[data-sf-m="item-back"]'
const MSG_BACK = '[data-sf-m="messages-back"]'
const TAB_BADGE = '[data-sf-m="tabbar-unread-badge"]'
const FM_BADGE = '[data-sf-m="floatmenu-unread-badge"]'

const run = async () => {
  const browser = await launch()
  const out = { ac: 'AC-2/AC-3', spec: 'design-system.spec v1.18 §19.8 AC-2 + §20.9 AC-2/AC-3', ac2: {}, ac3: {} }
  try {
    // ================= AC-2 · §19.8 详情页返回入口（7 种路径形态）=================
    const PATHS = [
      ['zh', '/item/19'], ['zh-prefix', '/zh/item/19'], ['en', '/en/item/19'],
      ['hk', '/hk/item/19'], ['vn', '/vn/item/19'], ['zh-query', '/item?id=19'], ['en-query', '/en/item?id=19'],
    ]
    {
      const { context, page } = await openPage(browser, { width: 390, uID: null })
      out.ac2.itemBack = {}
      for (const [tag, p] of PATHS) {
        await gotoL(page, p)
        const rec = await page.evaluate((sel) => {
          const els = document.querySelectorAll(sel)
          const el = els[0]
          if (!el) return { count: 0 }
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          return {
            count: els.length, href: el.getAttribute('href'),
            w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
            visible: el.getClientRects().length > 0 && cs.display !== 'none' && cs.visibility !== 'hidden',
          }
        }, BACK)
        // 底栏在该页已被隐藏 → 返回箭头承担可达性
        rec.tabbarDisplayOnDetail = await page.evaluate(() => {
          const t = document.querySelector('.sf-tabbar')
          return t ? getComputedStyle(t).display : '(absent)'
        })
        // 可达路由集合：返回箭头目标 + 首页可达的底栏 5 目标
        rec.reachableTargets = await page.evaluate(() => {
          const back = document.querySelector('[data-sf-m="item-back"]')
          const tabs = Array.from(document.querySelectorAll('.sf-tabbar a[data-sf-nav]')).map((a) => a.getAttribute('data-sf-nav'))
          return { backHref: back ? back.getAttribute('href') : null, tabTargets: tabs }
        })
        out.ac2.itemBack[tag] = rec
      }
      await context.close()
    }

    // ================= AC-2 · §20.9 /messages 真页 =================
    {
      const { context, page } = await openPage(browser, { width: 390, uID: BUYER_UID })
      out.ac2.messages = {}
      for (const [tag, p] of [['zh', '/messages'], ['en', '/en/messages'], ['hk', '/hk/messages'], ['vn', '/vn/messages']]) {
        await gotoL(page, p)
        await settle(page)
        out.ac2.messages[tag] = await page.evaluate(() => ({
          pageHooks: document.querySelectorAll('[data-sf-m="messages-page"]').length,
          placeholderHooks: document.querySelectorAll('[data-sf-m="messages-x-placeholder"]').length,
          listHook: document.querySelectorAll('[data-sf-m="messages-list"]').length,
          listEmptyHook: document.querySelectorAll('[data-sf-m="messages-list-empty"]').length,
          convRows: document.querySelectorAll('[data-sf-m="messages-conversation-item"]').length,
          rawKeyLeak: /messagesPage\.[a-zA-Z]/.test(document.body.innerText),
          text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
        }))
      }
      // 详情态返回入口
      await gotoL(page, `/messages?c=${CONV_ID}`)
      await settle(page)
      out.ac2.messages.backInDetail = await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (!el) return { count: 0 }
        const r = el.getBoundingClientRect()
        return { count: document.querySelectorAll(sel).length, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
          href: el.getAttribute('href'), visible: el.getClientRects().length > 0 }
      }, MSG_BACK)
      out.ac2.messages.detailHooks = await page.evaluate(() => ({
        thread: document.querySelectorAll('[data-sf-m="messages-thread"]').length,
        msgMine: document.querySelectorAll('[data-sf-m="messages-msg-mine"]').length,
        msgTheirs: document.querySelectorAll('[data-sf-m="messages-msg-theirs"]').length,
        input: document.querySelectorAll('[data-sf-m="messages-input"]').length,
        sendBtn: document.querySelectorAll('[data-sf-m="messages-send-btn"]').length,
        unreadRows: document.querySelectorAll('[data-sf-m="messages-conversation-unread"]').length,
      }))
      // 可达性：底栏第 4 格 + 桌面悬浮菜单消息项
      out.ac2.reach = await page.evaluate(() => {
        const tab = document.querySelector('.sf-tabbar a[data-sf-nav="messages"]')
        const fm = document.querySelector('.sf-fm [data-sf-fm="messages"]')
        return { tabbarHref: tab ? tab.getAttribute('href') : null, floatMenuHref: fm ? fm.getAttribute('href') : null }
      })
      await context.close()
    }
    // 1440 档悬浮菜单消息项
    {
      const { context, page } = await openPage(browser, { width: 1440, height: 900, uID: BUYER_UID })
      await gotoL(page, '/messages')
      await settle(page)
      out.ac2.reach.desktopFloatMenuHref = await page.evaluate(() => {
        const fm = document.querySelector('.sf-fm [data-sf-fm="messages"]')
        return fm ? { href: fm.getAttribute('href'), visible: fm.getClientRects().length > 0 } : null
      })
      await context.close()
    }

    // ================= AC-3 · 未读角标 =================
    // ① 登录 + 存在未读 ⇒ 两挂点同值
    for (const width of [390, 1440]) {
      const { context, page, reqs } = await openPage(browser, { width, height: 844, uID: BUYER_UID })
      await gotoL(page, '/messages')
      await settle(page, 800)
      await page.waitForTimeout(2500) // 观察窗：无轮询则请求数不再增长
      const before = reqs.filter((r) => r.url.includes('/api/messages/unread-count')).length
      await page.waitForTimeout(6000)
      const after = reqs.filter((r) => r.url.includes('/api/messages/unread-count')).length
      out.ac3[`loggedIn@${width}`] = await page.evaluate(([tb, fb]) => {
        const t = document.querySelector(tb)
        const f = document.querySelector(fb)
        const vis = (el) => Boolean(el && el.getClientRects().length > 0)
        return {
          tabbarBadge: t ? t.textContent : null, tabbarBadgeVisible: vis(t),
          floatMenuBadge: f ? f.textContent : null, floatMenuBadgeVisible: vis(f),
          tabbarA11y: t ? t.getAttribute('aria-label') : null,
        }
      }, [TAB_BADGE, FM_BADGE])
      out.ac3[`loggedIn@${width}`].unreadReqCountWindowA = before
      out.ac3[`loggedIn@${width}`].unreadReqCountWindowB = after
      out.ac3[`loggedIn@${width}`].unreadReqTimestamps = reqs.filter((r) => r.url.includes('unread-count')).map((r) => r.t)
      out.ac3[`loggedIn@${width}`].allApiReqs = reqs.filter((r) => r.url.includes('/api/')).length
      await context.close()
    }

    // ② 未登录 ⇒ 零角标 + 零 unread 请求（反事实）
    {
      const { context, page, reqs } = await openPage(browser, { width: 390, uID: null })
      await gotoL(page, '/messages')
      await page.waitForTimeout(3000)
      out.ac3['anon@390'] = {
        badgeHooks: await countOf(page, TAB_BADGE) + await countOf(page, FM_BADGE),
        unreadReqs: reqs.filter((r) => r.url.includes('unread-count')).length,
      }
      await context.close()
    }

    // ③ >99 ⇒ 99+（测量期 stub · 真实后端无法造 100 条未读）
    {
      const { context, page } = await openPage(browser, { width: 390, uID: BUYER_UID })
      await page.route('**/api/messages/unread-count', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data: { unread_total: 137 } }),
      }))
      await gotoL(page, '/messages')
      await settle(page)
      out.ac3['cap99'] = await page.evaluate((tb) => {
        const t = document.querySelector(tb)
        return { text: t ? t.textContent : null }
      }, TAB_BADGE)
      await context.close()
    }

    // ④ 进入会话详情 ⇒ 读水位推进 ⇒ unread-count 重取值下降（真实链路）
    {
      const { context, page, reqs } = await openPage(browser, { width: 390, uID: BUYER_UID })
      await gotoL(page, '/messages')
      await settle(page, 800)
      const unreadBefore = await page.evaluate(async () => {
        const r = await fetch('/api/messages/unread-count', { headers: { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('user')).token } })
        return (await r.json())?.data?.unread_total
      })
      await page.goto(`http://127.0.0.1:5792/messages?c=${CONV_ID}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(4000)
      const unreadAfter = await page.evaluate(async () => {
        const r = await fetch('/api/messages/unread-count', { headers: { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('user')).token } })
        return (await r.json())?.data?.unread_total
      })
      out.ac3.readWatermark = {
        unreadBefore, unreadAfter,
        readPostSeen: reqs.some((r) => r.url.includes('/read') && r.method === 'POST'),
        unreadReqs: reqs.filter((r) => r.url.includes('unread-count')).length,
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  // ------- 判据 -------
  const fails = { ac2: [], ac3: [] }
  for (const [tag, r] of Object.entries(out.ac2.itemBack)) {
    if (r.count !== 1) fails.ac2.push(`AC2【判负】${tag}: .sf-item-back 计数=${r.count}（应恒 1）`)
    if (!r.visible) fails.ac2.push(`AC2【判负】${tag}: 返回箭头不可见`)
    if (!(r.w >= 44 && r.h >= 44)) fails.ac2.push(`AC2【判负】${tag}: 返回箭头 ${r.w}×${r.h} < 44×44（≤767 档）`)
    if (!r.reachableTargets?.tabTargets?.length) fails.ac2.push(`AC2【判负】${tag}: 底栏 5 目标不可枚举`)
    if (r.tabbarDisplayOnDetail !== 'none') fails.ac2.push(`AC2 ${tag}: 详情页底栏 display=${r.tabbarDisplayOnDetail}（应 none）`)
  }
  for (const [tag, m] of Object.entries(out.ac2.messages)) {
    if (m.pageHooks < 1) fails.ac2.push(`AC2【判负】${tag}: messages-page 钩子缺失`)
    if (m.placeholderHooks !== 0) fails.ac2.push(`AC2【判负】${tag}: 占位钩子 messages-x-placeholder 仍存在 ${m.placeholderHooks}（T101 显式删除项）`)
    if (m.rawKeyLeak) fails.ac2.push(`AC2【判负】${tag}: 渲染裸键名 messagesPage.*`)
  }
  if (out.ac2.messages.backInDetail.count < 1) fails.ac2.push('AC2【判负】详情态无 messages-back 入口')
  if (out.ac2.messages.backInDetail.w < 44 || out.ac2.messages.backInDetail.h < 44) fails.ac2.push(`AC2【判负】messages-back ${out.ac2.messages.backInDetail.w}×${out.ac2.messages.backInDetail.h} < 44×44`)
  if (out.ac2.reach.tabbarHref !== '/messages') fails.ac2.push(`AC2【判负】底栏第 4 格 href=${out.ac2.reach.tabbarHref}`)
  if (out.ac2.reach.desktopFloatMenuHref?.href !== '/messages') fails.ac2.push(`AC2【判负】桌面悬浮菜单消息项 href=${JSON.stringify(out.ac2.reach.desktopFloatMenuHref)}`)

  for (const w of [390, 1440]) {
    const a = out.ac3[`loggedIn@${w}`]
    if (a.tabbarBadge !== '1') fails.ac3.push(`AC3【判负】${w}: 底栏角标=${a.tabbarBadge}（应 1）`)
    if (a.floatMenuBadge !== a.tabbarBadge) fails.ac3.push(`AC3【判负】${w}: 两挂点不同值（tabbar=${a.tabbarBadge} floatmenu=${a.floatMenuBadge}）`)
    if (a.unreadReqCountWindowB > 3) fails.ac3.push(`AC3【判负】${w}: unread-count 请求 ${a.unreadReqCountWindowB} 次 > 3（疑轮询）`)
    if (a.unreadReqCountWindowB !== a.unreadReqCountWindowA) fails.ac3.push(`AC3【判负】${w}: 静置窗口内 unread-count 仍在增长（${a.unreadReqCountWindowA}⇒${a.unreadReqCountWindowB}）`)
  }
  if (out.ac3['anon@390'].badgeHooks !== 0) fails.ac3.push(`AC3【判负】未登录仍有 ${out.ac3['anon@390'].badgeHooks} 个角标 DOM`)
  if (out.ac3['anon@390'].unreadReqs !== 0) fails.ac3.push(`AC3【判负】未登录发起了 ${out.ac3['anon@390'].unreadReqs} 次 unread-count 请求`)
  if (out.ac3.cap99.text !== '99+') fails.ac3.push(`AC3【判负】137 未读显示为 ${out.ac3.cap99.text}（应 99+）`)
  if (!(out.ac3.readWatermark.unreadAfter < out.ac3.readWatermark.unreadBefore)) fails.ac3.push(`AC3【判负】读水位后未读未下降（${out.ac3.readWatermark.unreadBefore}⇒${out.ac3.readWatermark.unreadAfter}）`)
  if (!out.ac3.readWatermark.readPostSeen) fails.ac3.push('AC3【判负】未见 POST /read 回执')

  out.verdicts = fails
  out.verdict = Object.values(fails).every((a) => a.length === 0) ? 'PASS' : 'FAIL'
  writeFileSync(`${ARTDIR}/readings/ac23-reachability-badge.json`, JSON.stringify(out, null, 1))
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await run()
  console.log('VERDICT', r.verdict)
  console.log('AC2', JSON.stringify(r.verdicts.ac2, null, 1))
  console.log('AC3', JSON.stringify(r.verdicts.ac3, null, 1))
  console.log('AC2 itemBack zh', JSON.stringify(r.ac2.itemBack?.zh))
  console.log('AC3 loggedIn@390', JSON.stringify(r.ac3['loggedIn@390']))
  console.log('AC3 readWatermark', JSON.stringify(r.ac3.readWatermark))
}
