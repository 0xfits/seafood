// 判负（负控）≥2 · 每条都要求「探针真报红」，用完复原 + cmp 自证
//   ① 反事实构建：`聊一聊` 对卖家也渲染 ⇒ AC-1 的②判据必红
//   ② 反事实构建：角标改 `setInterval` 轮询 ⇒ AC-3 的无轮询判据必红
//   ③ 尺子灵敏度：注入 9px 可见文本 ⇒ AC-6 的像素读数（最小字号）必红
import { launch, openPage, gotoL, settle, isVisible, ITEM_ID, SELLER_UID, BUYER_UID, ARTDIR } from './lib.mjs'
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

setTimeout(() => { console.error('WATCHDOG 8min'); process.exit(3) }, 480000)

const FE = '/Users/kevin/bistro/seafood/frontend'
const SCR = '/Users/kevin/.hermes/profiles/zang/cache/scratch/ac'
const CHAT = '[data-sf-m="item-chat-btn"]'

const ITEM_FILE = `${FE}/src/pages/item/ItemDetailPage.jsx`
const UNREAD_FILE = `${FE}/src/shell/unread-context.jsx`

const backup = (f, name) => copyFileSync(f, `${SCR}/${name}`)
const restore = (f, name) => { copyFileSync(`${SCR}/${name}`, f); return execFileSync('cmp', ['-s', `${SCR}/${name}`, f], { encoding: 'utf8' }) }
const cmpOK = (f, name) => { try { execFileSync('cmp', ['-s', `${SCR}/${name}`, f]); return true } catch { return false } }
const sha = (p) => execFileSync('shasum', ['-a', '256', p], { encoding: 'utf8' }).trim().split(/\s+/)[0]

const out = { ac: 'NEGCTL', controls: [], selfProof: {} }

const run = async () => {
  const browser = await launch()
  try {
    // ================= 负控 ① =================
    backup(ITEM_FILE, 'ItemDetailPage.jsx.orig')
    const src = readFileSync(ITEM_FILE, 'utf8')
    const patched = src.replace('{!isSellerSelf ? (', '{true ? (')
    if (patched === src) throw new Error('负控① 注入锚点未命中（源码形态已变）')
    writeFileSync(ITEM_FILE, patched)
    out.selfProof.itemPatchedDiff = patched.length - src.length
    await new Promise((r) => setTimeout(r, 3500)) // 等 HMR

    let red1 = null
    {
      const { context, page } = await openPage(browser, { width: 390, uID: SELLER_UID })
      await gotoL(page, `/item/${ITEM_ID}`)
      const visible = await isVisible(page, CHAT)
      const count = await page.locator(CHAT).count()
      // 与 AC-1 ② 判据同一条谓词
      red1 = { sellerChatVisible: visible, sellerChatCount: count, JUDGE: (visible || count > 0) ? 'RED(判负·探针有灵敏度)' : 'GREEN(探针失灵)' }
      await context.close()
    }
    out.controls.push({ id: 'NEG-1', what: '聊一聊对卖家也渲染（测量期注入 ItemDetailPage.jsx）', expected: 'AC-1 ② 判据必红', ...red1 })

    restore(ITEM_FILE, 'ItemDetailPage.jsx.orig')
    out.controls[0].restoredCmpIdentical = cmpOK(ITEM_FILE, 'ItemDetailPage.jsx.orig')
    out.controls[0].restoredSha256 = sha(ITEM_FILE)
    await new Promise((r) => setTimeout(r, 3500))

    // ================= 负控 ② =================
    backup(UNREAD_FILE, 'unread-context.jsx.orig')
    const src2 = readFileSync(UNREAD_FILE, 'utf8')
    const anchor = "  // 取数时点 ①：外壳挂载（登录态）。\n  useEffect(() => { refresh() }, [refresh])"
    const inject = anchor + '\n  // [NEGCTL] 反事实：每 1.5s 轮询（T103 明禁）\n  useEffect(() => { const id = setInterval(() => { refresh() }, 1500); return () => clearInterval(id) }, [refresh])'
    const patched2 = src2.replace(anchor, inject)
    if (patched2 === src2) throw new Error('负控② 注入锚点未命中')
    writeFileSync(UNREAD_FILE, patched2)
    out.selfProof.unreadPatchedDiff = patched2.length - src2.length
    await new Promise((r) => setTimeout(r, 3500))

    let red2 = null
    {
      const { context, page, reqs } = await openPage(browser, { width: 390, uID: BUYER_UID })
      await gotoL(page, '/messages')
      await settle(page, 500)
      await page.waitForTimeout(10000)
      const n = reqs.filter((r) => r.url.includes('/api/messages/unread-count')).length
      // 与 AC-3 无轮询判据同一条谓词：>3 或静置窗口仍在增长 ⇒ 判负
      red2 = { unreadReqsIn10s: n, JUDGE: n > 3 ? 'RED(判负·探针有灵敏度)' : 'GREEN(探针失灵)' }
      await context.close()
    }
    out.controls.push({ id: 'NEG-2', what: '角标改 setInterval 轮询（测量期注入 unread-context.jsx）', expected: 'AC-3 无轮询判据必红', ...red2 })

    restore(UNREAD_FILE, 'unread-context.jsx.orig')
    out.controls[1].restoredCmpIdentical = cmpOK(UNREAD_FILE, 'unread-context.jsx.orig')
    out.controls[1].restoredSha256 = sha(UNREAD_FILE)
    await new Promise((r) => setTimeout(r, 3000))

    // ================= 复原后正控（同一条谓词应回绿）=================
    {
      const { context, page } = await openPage(browser, { width: 390, uID: SELLER_UID })
      await gotoL(page, `/item/${ITEM_ID}`)
      const visible = await isVisible(page, CHAT)
      const count = await page.locator(CHAT).count()
      out.selfProof.afterRestoreSellerChat = { visible, count, JUDGE: (visible || count > 0) ? 'RED' : 'GREEN(回基线)' }
      await context.close()
    }
    {
      const { context, page, reqs } = await openPage(browser, { width: 390, uID: BUYER_UID })
      await gotoL(page, '/messages')
      await settle(page, 500)
      await page.waitForTimeout(10000)
      const n = reqs.filter((r) => r.url.includes('/api/messages/unread-count')).length
      out.selfProof.afterRestoreUnreadReqs = { unreadReqsIn10s: n, JUDGE: n > 3 ? 'RED' : 'GREEN(回基线)' }
      await context.close()
    }

    // ================= 负控 ③ 尺子灵敏度（AC-6 像素读数）=================
    {
      const small = []
      const { context, page } = await openPage(browser, { width: 390, uID: BUYER_UID })
      await gotoL(page, `/item/${ITEM_ID}`)
      await settle(page)
      await page.addStyleTag({ content: '.sf-item-meta{font-size:9px !important}' })
      await page.waitForTimeout(300)
      const text = await page.evaluate(`(() => {
        const out = []
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let n
        while ((n = walk.nextNode())) {
          const txt = (n.nodeValue || '').trim(); if (!txt) continue
          const p = n.parentElement; if (!p || p.getClientRects().length === 0) continue
          if (getComputedStyle(p).display === 'none') continue
          out.push({ size: parseFloat(getComputedStyle(p).fontSize), hook: p.closest('[data-sf-m]')?.getAttribute('data-sf-m') || '' })
        }
        return { min: out.length ? Math.min(...out.map(o => o.size)) : null, under12: out.filter(o => o.size < 12).length }
      })()`)
      out.controls.push({ id: 'NEG-3', what: '注入 9px 可见文本（测量期 addStyleTag，不动仓库）', expected: 'AC-6「可见文本 ≥12px」像素读数必红', measuredMinFontPx: text.min, under12Count: text.under12, JUDGE: text.min < 12 ? 'RED(判负·尺子有分辨率)' : 'GREEN(尺子失灵)' })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  out.verdict = out.controls.every((c) => String(c.JUDGE).startsWith('RED'))
    && out.selfProof.afterRestoreSellerChat.JUDGE.startsWith('GREEN')
    && out.selfProof.afterRestoreUnreadReqs.JUDGE.startsWith('GREEN')
    && out.controls[0].restoredCmpIdentical && out.controls[1].restoredCmpIdentical ? 'PASS' : 'FAIL'
  writeFileSync(`${ARTDIR}/readings/negctl.json`, JSON.stringify(out, null, 1))
  return out
}

const r = await run()
console.log(JSON.stringify(r, null, 1))
