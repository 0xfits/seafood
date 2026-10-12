// zh@390 单点复跑（AC-1 首跑唯一 FAIL 档）—— v2：**落盘读数**（首版只打印，Neng 据此拒为 AC-1 背书）。
// 用法：node recheck-zh390.mjs  ⇒  覆写 readings/recheck-zh390.json
import { launch, openPage, isVisible, ITEM_ID, SELLER_UID, BUYER_UID, ARTDIR, BASE } from './lib.mjs'
import { gotoItemStable } from './ac1.mjs'
import { writeFileSync } from 'node:fs'

const CHAT = '[data-sf-m="item-chat-btn"]'
const ACTIONBAR = '[data-sf-m="item-actionbar"]'
const BUY = '[data-sf-m="item-buy-btn"]'

const b = await launch()
const out = { ac: 'AC-1 · zh@390 单点复跑', revision: 'v2-persisted', base: BASE, states: {} }
try {
  for (const [name, uID] of [['anon', null], ['sellerSelf', SELLER_UID], ['nonSeller', BUYER_UID]]) {
    const { context, page } = await openPage(b, { width: 390, uID })
    const nav = await gotoItemStable(page, `/item/${ITEM_ID}`)
    const chat = page.locator(CHAT)
    out.states[name] = {
      actionbarVisible: await isVisible(page, ACTIONBAR),
      chatVisible: await isVisible(page, CHAT),
      buyVisible: await isVisible(page, BUY),
      chatBtnCount: await chat.count(),
      chatText: await chat.textContent().catch(() => null),
      detailPhase: nav.phase,
      renderAttempts: nav.attempts,
    }
    await context.close()
  }
} finally {
  await b.close()
}
const a = out.states
out.verdicts = [
  ...(a.anon.chatVisible ? [] : ['zh@390 anon: 未登录未见第 3 格']),
  ...(a.sellerSelf.chatVisible || a.sellerSelf.chatBtnCount > 0 ? ['zh@390 sellerSelf【判负】: 卖家本人可见第 3 格'] : []),
  ...(a.nonSeller.chatVisible ? [] : ['zh@390 nonSeller: 登录∧非卖家不可见第 3 格']),
]
out.verdict = out.verdicts.length === 0 ? 'PASS' : 'FAIL'
writeFileSync(`${ARTDIR}/readings/recheck-zh390.json`, JSON.stringify(out, null, 1))
console.log('RECHECK zh@390（稳健等待 · 已落盘）', JSON.stringify(out))
