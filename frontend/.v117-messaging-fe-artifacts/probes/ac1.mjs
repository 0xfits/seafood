// AC-1（`T100` 聊一聊三态 · v1.18 现行口径）真跑 —— **v2 · 稳健等待版（2026-10-12 · Kong）**
//   ① 未登录 ⇒ 第 3 格**可见**（点击走既有登录引导）
//   ② 卖家本人 ⇒ 第 3 格**不可见**（判负项）
//   ③ 登录 ∧ 非卖家 ⇒ 可见，点击 ⇒ 有 `POST /api/messages/conversations` 网络痕迹 + 落 `/messages?c=…`
//
// ★ v2 改了什么（只为「测量稳健性」，**判据一字未动**）：
//   首跑（v1）用 lib.gotoL = `goto + 固定 1200ms` ⇒ 冷启动时详情取数未落地，读到的是
//   `detail.phase='loading'` 的**空态占位**（`item-actionbar` 尚不存在）⇒ zh@390 的 anon/sellerSelf
//   被记成 `actionbarVisible=false / chatVisible=false` 的**测量伪影**（reading 里 verdicts 只有这一条 FAIL）。
//   ⇒ v2 换成**稳健等待**：等 `[data-sf-m="item-actionbar"]`（仅 `detail.phase==='ok'` 才渲染）
//     出现；若落到 `item-detail-empty[data-sf-phase]` 的非 loading 终态（网络/DB 抖动的真错误态），
//     做**有界重载重试**（≤3 次）并在读数里记 `attempts` / `detailPhase` 供审计。
//   判据仍是 §20.9 AC-1 的三态自洽（未登录可见且点击落 /login；卖家 count=0；登录∧非卖家 POST 200 落 /messages?c=）。
import { launch, openPage, isVisible, waitQuiet, ITEM_ID, SELLER_UID, BUYER_UID, ARTDIR, BASE } from './lib.mjs'
import { writeFileSync } from 'node:fs'

export const CHAT = '[data-sf-m="item-chat-btn"]'
export const BUY = '[data-sf-m="item-buy-btn"]'
export const ACTIONBAR = '[data-sf-m="item-actionbar"]'
const EMPTY = '[data-sf-m="item-detail-empty"]'

/** 等详情「渲染完成」（actionbar 出现）或落到**非 loading** 的终态空/错态。 */
async function waitItemRendered(page, { timeoutMs = 30000 } = {}) {
  await page.waitForFunction((s) => {
    if (document.querySelector(s)) return true
    const e = document.querySelector('[data-sf-m="item-detail-empty"]')
    const ph = e && e.getAttribute('data-sf-phase')
    return Boolean(ph && ph !== 'loading')
  }, ACTIONBAR, { timeout: timeoutMs, polling: 150 }).catch(() => {})
  const st = await page.evaluate((s) => {
    if (document.querySelector(s)) return { rendered: true, phase: 'ok' }
    const e = document.querySelector('[data-sf-m="item-detail-empty"]')
    return { rendered: false, phase: e ? String(e.getAttribute('data-sf-phase')) : '(absent)' }
  }, ACTIONBAR)
  if (st.rendered) await waitQuiet(page, { quietMs: 450, timeoutMs: 8000 })
  return st
}

/** 稳健导航：`rendered` 才返回；否则有界重载（仅测量侧，不改产品代码/判据）。 */
export async function gotoItemStable(page, path, { attempts = 3 } = {}) {
  let st = { rendered: false, phase: '(no-attempt)' }
  let n = 0
  for (let i = 1; i <= attempts; i += 1) {
    n = i
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
    st = await waitItemRendered(page)
    if (st.rendered) break
    await page.waitForTimeout(700)
  }
  return { ...st, attempts: n }
}

/** 单点状态读数（负控复用同一函数 ⇒ 判负能力可自证）。 */
export async function readChatState(page, url) {
  const nav = await gotoItemStable(page, url)
  const bar = await isVisible(page, ACTIONBAR)
  const chat = await isVisible(page, CHAT)
  const buy = await isVisible(page, BUY)
  return {
    url,
    actionbarVisible: bar,
    chatVisible: chat,
    buyVisible: buy,
    detailPhase: nav.phase,
    renderAttempts: nav.attempts,
  }
}

const LANGS = [
  ['zh', '/'],
  ['en', '/en/'],
  ['hk', '/hk/'],
  ['vn', '/vn/'],
]

const keyFails = (key, s) => {
  const f = []
  if (!s.anon?.chatVisible) f.push(`AC1-① ${key}: 未登录未见第 3 格（现行口径应可见）`)
  if (s.anon?.chatVisible && !String(s.anon.clickPath || '').includes('/login')) {
    f.push(`AC1-① ${key}: 未登录点击未走登录引导（landed=${s.anon.clickPath}）`)
  }
  if (s.sellerSelf?.chatVisible || s.sellerSelf?.chatBtnCount > 0) f.push(`AC1-②【判负】${key}: 卖家本人可见第 3 格`)
  if (!s.nonSeller?.chatVisible) f.push(`AC1-③ ${key}: 登录∧非卖家却不可见第 3 格`)
  if (s.nonSeller?.chatVisible && !s.nonSeller?.postConversations) f.push(`AC1-③【判负】${key}: 点击后无 POST conversations 网络痕迹`)
  if (s.nonSeller?.postConversations && s.nonSeller.postConversations.status !== 200) {
    f.push(`AC1-③ ${key}: POST conversations 非 200（got ${s.nonSeller.postConversations.status}）`)
  }
  if (s.nonSeller?.chatVisible && !String(s.nonSeller.landedPath || '').includes('/messages?c=')) {
    f.push(`AC1-③ ${key}: 点击后未落 /messages?c=…（landed=${s.nonSeller.landedPath}）`)
  }
  return f
}

export const run = async () => {
  const browser = await launch()
  const out = {
    ac: 'AC-1',
    revision: 'v2-robust-wait',
    spec: 'design-system.spec v1.18 §20.9 AC-1 / §20.3 T100 现行三态',
    method: '稳健等待：waitForSelector([data-sf-m=item-actionbar]) + DOM quiet 窗；落到非 loading 终态 ⇒ 有界重载 ≤3；不用固定 ms',
    states: {},
    verdicts: [],
  }
  try {
    for (const width of [390, 1440]) {
      for (const [lang, prefix] of LANGS) {
        const path = `${prefix}item/${ITEM_ID}`
        const key = `${lang}@${width}`
        out.states[key] = {}

        // ① 未登录
        {
          const { context, page } = await openPage(browser, { width, uID: null })
          const s = await readChatState(page, path)
          out.states[key].anon = { ...s, chatBtnCount: await page.locator(CHAT).count() }
          if (s.chatVisible) {
            await page.click(CHAT)
            await page.waitForURL((u) => String(u).includes('/login'), { timeout: 12000 }).catch(() => {})
            out.states[key].anon.clickPath = page.url().replace(BASE, '')
          }
          await context.close()
        }

        // ② 卖家本人（uid 1 = listing 19 的 seller_uid）
        {
          const { context, page } = await openPage(browser, { width, uID: SELLER_UID })
          const s = await readChatState(page, path)
          out.states[key].sellerSelf = { ...s, chatBtnCount: await page.locator(CHAT).count() }
          await context.close()
        }

        // ③ 登录 ∧ 非卖家（uid 7）
        {
          const { context, page, reqs } = await openPage(browser, { width, uID: BUYER_UID })
          const s = await readChatState(page, path)
          const before = reqs.length
          let trace = null
          let landed = null
          if (s.chatVisible) {
            const [resp] = await Promise.all([
              page.waitForResponse((r) => r.url().includes('/api/messages/conversations') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
              page.click(CHAT),
            ]).catch(() => [null])
            await page.waitForURL((u) => String(u).includes('/messages'), { timeout: 15000 }).catch(() => {})
            await waitQuiet(page, { quietMs: 500, timeoutMs: 8000 })
            trace = resp ? { status: resp.status(), url: resp.url().replace(BASE, '') } : null
            landed = page.url().replace(BASE, '')
          }
          out.states[key].nonSeller = {
            ...s,
            postConversations: trace,
            landedPath: landed,
            reqsDelta: reqs.slice(before).map((r) => `${r.method} ${String(r.url).replace(BASE, '')}`),
          }
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  // 判据（v1.18 现行 · 三态自洽）—— 逐键 verdict + 汇总。
  const fails = []
  out.keyVerdicts = {}
  for (const [key, s] of Object.entries(out.states)) {
    const f = keyFails(key, s)
    out.keyVerdicts[key] = f.length === 0 ? 'PASS' : 'FAIL'
    fails.push(...f)
  }
  out.verdicts = fails
  out.keys = Object.keys(out.states)
  out.keyCount = { total: out.keys.length, pass: Object.values(out.keyVerdicts).filter((v) => v === 'PASS').length, fail: Object.values(out.keyVerdicts).filter((v) => v === 'FAIL').length }
  out.verdict = fails.length === 0 ? 'PASS' : 'FAIL'
  writeFileSync(`${ARTDIR}/readings/ac1-t100-three-states.json`, JSON.stringify(out, null, 1))
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await run()
  console.log(JSON.stringify({ verdict: r.verdict, keyCount: r.keyCount, keyVerdicts: r.keyVerdicts, fails: r.verdicts, sample: r.states['zh@390'] }, null, 1))
}
