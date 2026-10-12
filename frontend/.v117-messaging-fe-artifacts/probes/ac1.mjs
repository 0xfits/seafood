// AC-1（`T100` 聊一聊三态 · v1.18 现行口径）真跑
//   ① 未登录 ⇒ 第 3 格**可见**（点击走既有登录引导）
//   ② 卖家本人 ⇒ 第 3 格**不可见**（判负项）
//   ③ 登录 ∧ 非卖家 ⇒ 可见，点击 ⇒ 有 `POST /api/messages/conversations` 网络痕迹
// 反事实 = 把 user.uid 换成 seller.uid（仅测量期）⇒ 该格必须消失。
import { launch, openPage, gotoL, isVisible, ITEM_ID, SELLER_UID, BUYER_UID, ARTDIR } from './lib.mjs'
import { writeFileSync } from 'node:fs'

export const CHAT = '[data-sf-m="item-chat-btn"]'
export const BUY = '[data-sf-m="item-buy-btn"]'
export const ACTIONBAR = '[data-sf-m="item-actionbar"]'

/** 单点状态读数（负控复用同一函数 ⇒ 判负能力可自证）。 */
export async function readChatState(page, url) {
  await gotoL(page, url)
  const bar = await isVisible(page, ACTIONBAR)
  const chat = await isVisible(page, CHAT)
  const buy = await isVisible(page, BUY)
  return { url, actionbarVisible: bar, chatVisible: chat, buyVisible: buy }
}

const LANGS = [
  ['zh', '/'],
  ['en', '/en/'],
  ['hk', '/hk/'],
  ['vn', '/vn/'],
]

export const run = async () => {
  const browser = await launch()
  const out = { ac: 'AC-1', spec: 'design-system.spec v1.18 §20.9 AC-1 / §20.3 T100 现行三态', states: {}, verdicts: [] }
  try {
    for (const width of [390, 1440]) {
      for (const [lang, prefix] of LANGS) {
        const path = `${prefix}item/${ITEM_ID}`
        const key = `${lang}@${width}`
        out.states[key] = {}

        // ① 未登录
        {
          const { context, page, reqs } = await openPage(browser, { width, uID: null })
          const s = await readChatState(page, path)
          out.states[key].anon = { ...s, chatBtnCount: await page.locator(CHAT).count() }
          // 点击 ⇒ 既有登录引导（/login + state.from）
          if (s.chatVisible) {
            await page.click(CHAT)
            await page.waitForTimeout(900)
            out.states[key].anon.clickPath = page.url().replace(BASEHOST, '')
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
              page.waitForResponse((r) => r.url().includes('/api/messages/conversations') && r.request().method() === 'POST', { timeout: 12000 }).catch(() => null),
              page.click(CHAT),
            ]).catch(() => [null])
            await page.waitForTimeout(1500)
            trace = resp ? { status: resp.status(), url: resp.url().replace(BASEHOST, '') } : null
            landed = page.url().replace(BASEHOST, '')
          }
          out.states[key].nonSeller = { ...s, postConversations: trace, landedPath: landed, reqsDelta: reqs.slice(before).map((r) => `${r.method} ${String(r.url).replace(BASEHOST, '')}`) }
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  // 判据（v1.18 现行 · 三态自洽）
  const fails = []
  for (const [key, s] of Object.entries(out.states)) {
    if (!s.anon?.chatVisible) fails.push(`AC1-① ${key}: 未登录未见第 3 格（现行口径应可见）`)
    if (s.anon?.clickPath && !s.anon.clickPath.includes('/login')) fails.push(`AC1-① ${key}: 未登录点击未走登录引导（landed=${s.anon.clickPath}）`)
    if (s.sellerSelf?.chatVisible || s.sellerSelf?.chatBtnCount > 0) fails.push(`AC1-②【判负】${key}: 卖家本人可见第 3 格`)
    if (!s.nonSeller?.chatVisible) fails.push(`AC1-③ ${key}: 登录∧非卖家却不可见第 3 格`)
    if (s.nonSeller?.chatVisible && !s.nonSeller?.postConversations) fails.push(`AC1-③【判负】${key}: 点击后无 POST conversations 网络痕迹`)
  }
  out.verdicts = fails
  out.verdict = fails.length === 0 ? 'PASS' : 'FAIL'
  writeFileSync(`${ARTDIR}/readings/ac1-t100-three-states.json`, JSON.stringify(out, null, 1))
  return out
}

const BASEHOST = 'http://127.0.0.1:5792'

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await run()
  console.log(JSON.stringify({ verdict: r.verdict, fails: r.verdicts, sample: r.states['zh@390'] }, null, 1))
}
