/**
 * 管理员编辑（0059）· 五臂探针的**负控（灵敏度自证）**
 * ============================================================================
 * 目的：证明 `probe-five-arms.mjs` 的每条判据**真的会变红**，而不是恒绿的空壳尺子。
 * 手法：不动产品代码，只在页面内**注入** ①反事实数据（管理员三键改成非管理员）、
 *       ②反事实样式（把入口挪到操作栏上），看对应判据是否翻红。
 *   ★ 注入仅存于本探针的内存夹具 / 页面内联样式，**零改仓内源码**、零库写。
 *
 * 四条负控：
 *   NC-1 管理员三键改成「非管理员」⇒ 入口必须消失（证 AC-1 正向不是恒真）
 *   NC-2 `mine` 含该商品 ⇒ `item-admin-note` 必须消失（证 AC-2 的提示条是归属判定、非恒渲染）
 *   NC-3 注入 `.sf-item-edit-link{position:fixed;bottom:0}` ⇒ 与操作栏相交面积必须 > 0
 *        （证 AC-5 的 overlap 判据有分辨力）
 *   NC-4 读口回 404 ⇒ 文案必须是 `notFound` 类、且不含 403 词（证 AC-4 的分流判据有分辨力）
 *
 * 用法：node ops/admin-edit/front/probe-negative-controls.mjs [out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  REPO, CHROME, ORIGIN, UID_ME, UID_OTHER, EDIT_ID, DETAIL_ID,
  makeState, makePage, rectOf, settle, chromium,
} from './probe-lib.mjs'

const OUT = process.argv[2] || path.join(REPO, 'ops/admin-edit/front/readings/negative-controls.json')

const overlap = (a, b) => {
  if (!a || !b) return 0
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return +(w * h).toFixed(2)
}

const nc1AdminFlagsTurnedOff = async (browser) => {
  // 反事实：夹具声称「管理员三键 = 非管理员」⇒ 入口必须消失
  const state = makeState({ admin: false, sellerUid: UID_OTHER })
  const { context, page, pageErrors } = await makePage(browser, { state })
  await page.goto(`${ORIGIN}/item/${DETAIL_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-detail-web-cols"]', { timeout: 8000 })
  await settle(page, 350)
  const link = await rectOf(page, '[data-sf-m="item-edit-link"]')
  const observed = { linkPresent: !!link, userProbeCount: state.seen.user, pageErrors }
  await context.close()
  return {
    id: 'NC-1',
    inject: '夹具：/api/user 的 admin 三键 = {can_access_admin:false,is_admin:false,permissions:[]}（卖家仍是他人）',
    expect: '入口**消失**（item-edit-link = null）',
    observed,
    // 灵敏度 = 注入后判据确实翻红；且必须真发生过探测（否则是「没取数」的假空）
    sensitive: observed.linkPresent === false && observed.userProbeCount >= 1 && pageErrors.length === 0,
  }
}

const nc2MineIncludesListing = async (browser) => {
  // 反事实：该行**在我发布的** ⇒ 提示条必须消失（归属判定臂）
  const state = makeState({ admin: true, mineRows: [{ listing_id: EDIT_ID }] })
  const { context, page, pageErrors } = await makePage(browser, { state })
  await page.goto(`${ORIGIN}/item/${EDIT_ID}/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-form"]', { timeout: 8000 })
  await settle(page, 450)
  const observed = await page.evaluate(() => ({
    noteText: document.querySelector('[data-sf-m="item-admin-note"]')?.textContent?.trim() ?? null,
    formPresent: !!document.querySelector('[data-sf-m="item-form"]'),
  }))
  await context.close()
  return {
    id: 'NC-2',
    inject: '夹具：GET /api/listing/mine ⇒ [{listing_id:501}]（该行属「我发布的」）',
    expect: '`item-admin-note` **不渲染**，表单照常在',
    observed: { ...observed, pageErrors },
    sensitive: observed.noteText === null && observed.formPresent === true && pageErrors.length === 0,
  }
}

const nc3ForceOverlap = async (browser, width = 390, height = 844) => {
  // 反事实：把入口 fixed 到视口底部 ⇒ 与固定操作栏必然相交（证 overlap 判据不是恒 0）
  const state = makeState({ admin: true, sellerUid: UID_OTHER })
  const { context, page, pageErrors } = await makePage(browser, { width, height, state })
  await page.goto(`${ORIGIN}/item/${DETAIL_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-edit-link"]', { timeout: 8000 })
  await settle(page, 300)
  const before = {
    link: await rectOf(page, '[data-sf-m="item-edit-link"]'),
    bar: await rectOf(page, '[data-sf-m="item-actionbar"]'),
  }
  if (!before.bar) throw new Error('操作栏未渲染 ⇒ 该档无法做 overlap 负控')
  await page.addStyleTag({
    // ★ 落点必须按**实测操作栏矩形**定（1536 档操作栏在右栏内、不在视口底部 ⇒
    //   写成 `bottom:8px` 反事实压根碰不到它，负控会假阴性）。
    content: `.sf-item-edit-link{position:fixed!important;left:${Math.round(before.bar.left) + 4}px!important;`
      + `top:${Math.round(before.bar.top) + 4}px!important;z-index:9!important;}`,
  })
  await settle(page, 250)
  const after = {
    link: await rectOf(page, '[data-sf-m="item-edit-link"]'),
    bar: await rectOf(page, '[data-sf-m="item-actionbar"]'),
  }
  const observed = {
    beforeOverlap: overlap(before.link, before.bar),
    afterOverlap: overlap(after.link, after.bar),
    beforeLink: before.link, afterLink: after.link, bar: after.bar,
    pageErrors,
  }
  await context.close()
  return {
    id: `NC-3@${width}x${height}`,
    inject: `页面内联样式 \`.sf-item-edit-link{position:fixed;left:8px;bottom:8px}\`（{width}×{height}）`.replace('{width}', width).replace('{height}', height),
    expect: '改前相交面积 = 0（真形态）／改后 > 0（尺子有分辨力）',
    observed,
    sensitive: observed.beforeOverlap === 0 && observed.afterOverlap > 0 && pageErrors.length === 0,
  }
}

const nc4NotFoundRouting = async (browser) => {
  // 反事实：读口 404 ⇒ 文案必须走 notFound 分支，不含 403/forbidden 词
  const state = makeState({ admin: true, editStatus: 404 })
  const { context, page, pageErrors } = await makePage(browser, { state })
  await page.goto(`${ORIGIN}/item/${EDIT_ID}/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-edit-load-error"]', { timeout: 8000 })
  await settle(page, 300)
  const observed = await page.evaluate(() => {
    const err = document.querySelector('[data-sf-m="item-edit-load-error"]')
    return {
      text: err ? err.textContent.trim() : null,
      formPresent: !!document.querySelector('[data-sf-m="item-form"]'),
    }
  })
  const text = observed.text || ''
  await context.close()
  return {
    id: 'NC-4',
    inject: '夹具：读口 404 `LEDGER_REF_NOT_FOUND`（对照 AC-4 的 403）',
    expect: '文案 = 未找到类（含「不存在/未找到」），**不含**「权限不足」；无表单',
    observed: { ...observed, pageErrors },
    sensitive: /未找到|不存在/.test(text) && !/权限不足/.test(text) && observed.formPresent === false && pageErrors.length === 0,
  }
}

const main = async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--host-resolver-rules=MAP sf.local 127.0.0.1', '--ignore-certificate-errors', '--no-first-run'],
  })
  const controls = []
  const run = async (fn, label) => {
    try {
      const r = await fn()
      controls.push(r)
      console.log(`${r.sensitive ? 'SENSITIVE' : 'NOT-SENSITIVE'}  ${r.id}  ${label}`)
    } catch (error) {
      controls.push({ id: label, sensitive: false, error: String(error && error.message ? error.message : error) })
      console.log(`NOT-SENSITIVE  ${label}  ${error && error.message ? error.message : error}`)
    }
  }
  await run(() => nc1AdminFlagsTurnedOff(browser), 'NC-1 三键关掉 ⇒ 入口消失')
  await run(() => nc2MineIncludesListing(browser), 'NC-2 行属我 ⇒ 提示条消失')
  await run(() => nc3ForceOverlap(browser, 390, 844), 'NC-3 强制压操作栏 ⇒ 相交 > 0（390）')
  await run(() => nc3ForceOverlap(browser, 1536, 900), 'NC-3 强制压操作栏 ⇒ 相交 > 0（1536）')
  await run(() => nc4NotFoundRouting(browser), 'NC-4 404 分流 ⇒ 文案不同源')
  await browser.close()

  const result = {
    probe: 'ops/admin-edit/front/probe-negative-controls.mjs',
    purpose: '五臂探针的灵敏度自证：反事实注入后对应判据必须翻红；本文件绿 = 尺子有分辨力（≠ 产品通过）',
    generatedAt: new Date().toISOString(),
    verdict: controls.every((c) => c.sensitive) ? 'SENSITIVE' : 'NOT_SENSITIVE',
    controls,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`\nverdict=${result.verdict}  controls=${controls.length}  out=${OUT}`)
  process.exit(result.verdict === 'SENSITIVE' ? 0 : 1)
}

main().catch((error) => { console.error(error); process.exit(2) })
