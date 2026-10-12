// AC-4（触控/字号 · ★ 双 CTA 并置窄屏几何）/ AC-5（桌面档行为）/ AC-6（主题同构 + 像素读数）真跑
import {
  launch, openPage, gotoL, settle, waitQuiet, waitMessagesStable, sha256, VISIBLE_SNAPSHOT_NO_THEME_ICON, TEXT_READINGS, isVisible,
  ITEM_ID, SELLER_UID, BUYER_UID, CONV_ID, ARTDIR,
} from './lib.mjs'
import { writeFileSync } from 'node:fs'

setTimeout(() => { console.error('WATCHDOG 8min'); process.exit(3) }, 480000).unref()

const CHAT = '[data-sf-m="item-chat-btn"]'
const BUY = '[data-sf-m="item-buy-btn"]'
const BAR = '[data-sf-m="item-actionbar"]'

/** 页面内：双 CTA 几何（含并置判定、重叠、溢出）。 */
const CTA_GEO = `(() => {
  const pick = (s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
      fontSize: parseFloat(cs.fontSize), minHeight: cs.minHeight, minWidth: cs.minWidth,
      display: cs.display, visible: el.getClientRects().length > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' }
  }
  const buy = pick('[data-sf-m="item-buy-btn"]')
  const chat = pick('[data-sf-m="item-chat-btn"]')
  const bar = pick('[data-sf-m="item-actionbar"]')
  const de = document.documentElement
  const round = (v) => Math.round(v * 100) / 100
  let overlap = null
  if (buy && chat) {
    const ox = Math.max(0, Math.min(buy.right, chat.right) - Math.max(buy.x, chat.x))
    const oy = Math.max(0, Math.min(buy.bottom, chat.bottom) - Math.max(buy.y, chat.y))
    overlap = round(ox * oy)
  }
  return {
    viewport: { w: innerWidth, h: innerHeight },
    buy: buy && { x: round(buy.x), y: round(buy.y), w: round(buy.w), h: round(buy.h), visible: buy.visible, fontSize: buy.fontSize, minHeight: buy.minHeight, display: buy.display },
    chat: chat && { x: round(chat.x), y: round(chat.y), w: round(chat.w), h: round(chat.h), visible: chat.visible, fontSize: chat.fontSize, minHeight: chat.minHeight, display: chat.display },
    bar: bar && { x: round(bar.x), y: round(bar.y), w: round(bar.w), h: round(bar.h), position: getComputedStyle(document.querySelector('[data-sf-m="item-actionbar"]')).position },
    bothVisible: Boolean(buy && buy.visible && chat && chat.visible),
    sameRow: Boolean(buy && chat && Math.abs(buy.y - chat.y) < 2),
    gapPx: (buy && chat) ? round(Math.max(buy.x, chat.x) - Math.min(buy.right, chat.right)) : null,
    ctasOverlapPx2: overlap,
    docOverflowX: de.scrollWidth - de.clientWidth,
    barBottom: bar ? round(bar.bottom) : null,
    barFixedAtViewportBottom: bar ? Math.abs(bar.bottom - innerHeight) < 2 : null,
  }
})()`

const run = async () => {
  const browser = await launch()
  const out = { ac: 'AC-4/AC-5/AC-6', spec: 'design-system.spec v1.18 §20.9 AC-4/AC-5/AC-6', cta: {}, desktop: {}, theme: {}, verdicts: {} }
  const WIDTHS = [320, 390, 1440]
  try {
    // ---- AC-4 双 CTA 并置窄屏几何（两态：未登录 / 登录∧非卖家）----
    for (const width of WIDTHS) {
      for (const theme of ['light', 'dark']) {
        for (const [uID, tag] of [[null, 'anon'], [BUYER_UID, 'nonSeller']]) {
          const { context, page } = await openPage(browser, { width, height: 844, theme, uID })
          await gotoL(page, `/item/${ITEM_ID}`)
          // [Kong 修·尺度稳健] 等操作栏渲染完再取几何：gotoL 只等 1200ms，首访/冷缓存时
          // 详情体会晚于该窗渲染 ⇒ 曾误读成 buy=null/chat=null（实测稳健等待后两档恒 44px）。
          // 只加「等元素」，不动任何判据/阈值。
          await page.waitForSelector(BAR, { timeout: 20000 }).catch(() => {})
          await settle(page)
          const g = await page.evaluate(CTA_GEO)
          const key = `${width}/${theme}/${tag}`
          out.cta[key] = g
          await context.close()
        }
      }
    }

    // ---- AC-5 桌面档行为（1440）----
    {
      const { context, page } = await openPage(browser, { width: 1440, height: 900, uID: BUYER_UID })
      await gotoL(page, `/item/${ITEM_ID}`)
      await page.waitForSelector(BAR, { timeout: 20000 }).catch(() => {})
      await settle(page)
      out.desktop = await page.evaluate(`(() => {
        const bar = document.querySelector('[data-sf-m="item-actionbar"]')
        const tab = document.querySelector('.sf-tabbar')
        const cs = getComputedStyle(bar)
        return {
          actionbarPosition: cs.position,
          actionbarInFlow: cs.position === 'static',
          tabbarDisplay: tab ? getComputedStyle(tab).display : '(absent)',
          tabbarHidden: tab ? getComputedStyle(tab).display === 'none' : null,
          tabbarPresent: Boolean(tab),
        }
      })()`)
      await context.close()
    }

    // ---- AC-6 日/夜几何同构 + 像素读数（四语 × 三档，/item/:id 与 /messages）----
    for (const width of WIDTHS) {
      for (const [lang, prefix] of [['zh', '/'], ['en', '/en/'], ['hk', '/hk/'], ['vn', '/vn/']]) {
        for (const page_ of [`${prefix}item/${ITEM_ID}`, `${prefix}messages?c=${CONV_ID}`]) {
          const shot = {}
          let threadRetries = 0
          const isMessages = page_.includes('messages')
          for (const theme of ['light', 'dark']) {
            const { context, page } = await openPage(browser, { width, height: 844, theme, uID: BUYER_UID })
            await gotoL(page, page_)
            // [Kong 修·尺度稳健] 等页面根渲染完再取几何快照（同 CTA 档理由，只加等待不改判据）
            await page.waitForSelector('[data-sf-m="item-actionbar"], [data-sf-m="messages-page"]', { timeout: 20000 }).catch(() => {})
            await settle(page)
            // [Kong 修·尺度稳健] 等异步面收敛到**终态**（详见 lib.mjs `waitMessagesStable` / `waitQuiet` 注释）。
            // 起因：24 档中偶发 5–7 档「日/夜 hash 不同」纯伪影，归因到两类**与主题无关**的时序竞态：
            //  ① 未读角标 sf-badge-count 的出现/移除（进详情推进读水位 ⇒ unread 归零）；
            //  ② 消息流取数：loading/失败态 `messages-thread-status` ↔ 成功态 `messages-thread`+气泡。
            // 消息流真错误态 ⇒ **有界重载**（最多 2 次）等「正确渲染」；重载次数记进读数。不改断言语义。
            if (isMessages) {
              let stable = await waitMessagesStable(page)
              for (let t = 0; t < 2 && !stable.ok; t += 1) {
                threadRetries += 1
                await gotoL(page, page_)
                await settle(page)
                stable = await waitMessagesStable(page)
              }
            } else {
              await waitQuiet(page)
            }
            // ★ 口径对齐：用「排除主题开关图标子树」的快照（理由见 lib.mjs VISIBLE_SNAPSHOT_NO_THEME_ICON 注释）
            const snap = await page.evaluate(VISIBLE_SNAPSHOT_NO_THEME_ICON)
            const text = await page.evaluate(TEXT_READINGS)
            shot[theme] = {
              nodes: snap.length,
              geoHash: sha256(snap),
              minFontPx: text.length ? Math.min(...text.map((t) => t.fontSizePx)) : null,
              minTextBoxH: text.length ? Math.min(...text.map((t) => t.textBoxH)) : null,
              smallText: text.filter((t) => t.fontSizePx < 12),
              textCount: text.length,
            }
            // 触控目标实测（≤767）：所有可点元素。带结构键（tag|cls|hook）供跨主题去重。
            if (width <= 767) {
              shot[theme].tapTargets = await page.evaluate(`(() => {
                const out = []
                for (const el of document.querySelectorAll('a,button,input,textarea,[role="button"]')) {
                  if (el.getClientRects().length === 0) continue
                  const cs = getComputedStyle(el)
                  if (cs.display === 'none' || cs.visibility === 'hidden') continue
                  const r = el.getBoundingClientRect()
                  if (r.width === 0 && r.height === 0) continue
                  out.push({ tag: el.tagName, hook: el.getAttribute('data-sf-m') || '', cls: String(el.className || '').slice(0, 80),
                    w: Math.round(r.width*100)/100, h: Math.round(r.height*100)/100 })
                }
                return out
              })()`)
            }
            await context.close()
          }
          const cross = shot.light.geoHash === shot.dark.geoHash
          // 跨主题去重：light/dark 两份拼接时同一元素会被计 2 次 ⇒ 按结构键（tag|cls|hook）分组，
          // 每键只保留前一半（= 单主题的那一份）。dome 同构已由 geoEqual 断言，故该去重是合法的。
          const allTaps = [...(shot.light.tapTargets || []), ...(shot.dark.tapTargets || [])]
          const byKey = new Map()
          for (const t of allTaps) {
            const k = `${t.tag}|${t.cls}|${t.hook}`
            if (!byKey.has(k)) byKey.set(k, [])
            byKey.get(k).push(t)
          }
          const tapUnique = []
          for (const arr of byKey.values()) tapUnique.push(...arr.slice(0, Math.ceil(arr.length / 2)))
          const under44Raw = tapUnique.filter((t) => t.w < 44 || t.h < 44)
          // 既有元素单列（不计入本单 AC-6 判负）：Footer 语言链接 `.sf-tap-inline`
          // （shell.css:232；由 Header.jsx/Footer.jsx 消费，二者**均不在本单 diff**）⇒ 28×44 < 44。
          const isExistingTap = (t) => /(^|\s)sf-tap-inline(\s|$)/.test(t.cls)
          const key = `${width}/${lang}/${page_}`
          out.theme[key] = {
            nodes: shot.light.nodes,
            geoHashLight: shot.light.geoHash,
            geoHashDark: shot.dark.geoHash,
            geoEqual: cross,
            minFontPx: Math.min(shot.light.minFontPx ?? 99, shot.dark.minFontPx ?? 99),
            minTextBoxH: Math.min(shot.light.minTextBoxH ?? 99, shot.dark.minTextBoxH ?? 99),
            smallText: [...shot.light.smallText, ...shot.dark.smallText],
            tapCountRaw: allTaps.length,
            tapCountUnique: tapUnique.length,
            threadRetries,
            under44: under44Raw.filter((t) => !isExistingTap(t)),
            under44Existing: under44Raw.filter(isExistingTap),
          }
        }
      }
    }
  } finally {
    await browser.close()
  }

  // ---- 判据 ----
  const fails = { ac4: [], ac5: [], ac6: [] }
  for (const [key, g] of Object.entries(out.cta)) {
    const width = Number(key.split('/')[0])
    if (!g.bothVisible) { fails.ac4.push(`AC4 ${key}: 两 CTA 未并置可见（buy=${g.buy && g.buy.visible} chat=${g.chat && g.chat.visible}）`); continue }
    if (width <= 767) {
      if (g.buy.w < 44 || g.buy.h < 44) fails.ac4.push(`AC4【判负】${key}: 立即购买 ${g.buy.w}×${g.buy.h} < 44×44`)
      if (g.chat.w < 44 || g.chat.h < 44) fails.ac4.push(`AC4【判负】${key}: 聊一聊 ${g.chat.w}×${g.chat.h} < 44×44`)
      if (g.ctasOverlapPx2 > 0) fails.ac4.push(`AC4【判负】${key}: 两 CTA 矩形相交 ${g.ctasOverlapPx2} px²`)
      if (g.buy.x < 0 || g.chat.right > g.viewport.w + 0.5) fails.ac4.push(`AC4【判负】${key}: CTA 溢出视口（buy.x=${g.buy.x} chat.right=${g.chat.right} vw=${g.viewport.w}）`)
    }
    if (g.docOverflowX > 0) fails.ac4.push(`AC4【判负】${key}: 横向溢出 ${g.docOverflowX}px`)
  }
  if (!out.desktop.actionbarInFlow) fails.ac5.push(`AC5【判负】1440 操作栏 position=${out.desktop.actionbarPosition}（应 static）`)
  if (!out.desktop.tabbarHidden) fails.ac5.push(`AC5【判负】1440 底栏 display=${out.desktop.tabbarDisplay}（应 none）`)
  for (const [key, t] of Object.entries(out.theme)) {
    if (!t.geoEqual) fails.ac6.push(`AC6【判负】${key}: 日/夜几何 hash 不同（${t.geoHashLight} vs ${t.geoHashDark}）`)
    if (t.minFontPx < 12) fails.ac6.push(`AC6【判负】${key}: 可见文本最小字号 ${t.minFontPx}px < 12px`)
    if (t.under44.length) fails.ac6.push(`AC6【判负】${key}: ${t.under44.length} 个触控目标 < 44（示例 ${JSON.stringify(t.under44.slice(0, 4))}）`)
  }
  out.verdicts = fails
  out.verdict = Object.values(fails).every((a) => a.length === 0) ? 'PASS' : 'FAIL'
  writeFileSync(`${ARTDIR}/readings/ac456-cta-desktop-theme.json`, JSON.stringify(out, null, 1))
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await run()
  console.log('VERDICT', r.verdict)
  console.log('CTA 320/light/anon', JSON.stringify(r.cta['320/light/anon']))
  console.log('CTA 320/light/nonSeller', JSON.stringify(r.cta['320/light/nonSeller']))
  console.log('CTA 390/light/anon', JSON.stringify(r.cta['390/light/anon']))
  console.log('CTA 390/light/nonSeller', JSON.stringify(r.cta['390/light/nonSeller']))
  console.log('CTA 1440/light/nonSeller', JSON.stringify(r.cta['1440/light/nonSeller']))
  console.log('DESKTOP', JSON.stringify(r.desktop))
  console.log('FAILS', JSON.stringify(r.verdicts, null, 1))
}
