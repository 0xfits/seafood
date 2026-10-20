/**
 * 管理员编辑（0059）· 前端五臂浏览器探针
 * ============================================================================
 * 夹具 / 页面装配见 `probe-lib.mjs`（与负控探针共用，保证「改尺子 = 改两处」不会漂）。
 * 只读性：API 全在 `context.route` 内内存自截（零真后端 / 零库写），静态面 = dist。
 *
 * 五臂（与本单 AC 一一对应）：
 *   AC-1 入口可见性三态：本人 / 陌生人 / 管理员看他人商品
 *   AC-2 管理员编辑页五项预填 + 页头 `item-admin-note`
 *   AC-3 管理员保存：`PATCH {price:15}` 一次 ⇒ 回列表
 *   AC-4 普通用户直访他人编辑页 403 ⇒ 有文案、无表单、不白屏、零 pageerror
 *   AC-5 390 / 1536 入口不压底栏/胶囊、零横向溢出、零 pageerror
 *
 * 用法：node ops/admin-edit/front/probe-five-arms.mjs [out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  DIST, OUT, CHROME, ORIGIN, UID_ME, UID_OTHER, EDIT_ID, DETAIL_ID,
  editRow, makeState, makePage, rectOf, settle, chromium,
} from './probe-lib.mjs'

// ---- 各臂 ---------------------------------------------------------------------
async function armEntryVisibility(browser) {
  const cases = []
  const one = async (name, stateOpts, expectPresent) => {
    const state = makeState(stateOpts)
    const { context, page, pageErrors, consoleErrors } = await makePage(browser, { state })
    await page.goto(`${ORIGIN}/item/${DETAIL_ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-m="item-detail-web-cols"]', { timeout: 8000 })
    await settle(page, 350)
    const link = await rectOf(page, '[data-sf-m="item-edit-link"]')
    // ★ 负向臂的元素**本就不该存在** ⇒ 不能对 `getAttribute` 用默认等待（会干等 30s 抛超时，
    //   把「按预期不渲染」误报成探针异常）。只在元素真在场时取 href。
    const href = link ? await page.getAttribute('[data-sf-m="item-edit-link"]', 'href', { timeout: 2000 }) : null
    cases.push({
      arm: name, expectPresent, present: !!link, href, rect: link,
      userProbeCount: state.seen.user, sellerUid: state.sellerUid, meUid: UID_ME,
      pageErrors, consoleErrors,
      pass: (!!link === expectPresent) && (expectPresent ? href === `/item/${DETAIL_ID}/edit` : href === null)
        && pageErrors.length === 0,
    })
    await context.close()
  }
  await one('本人看自己的商品（seller.uid === me）', { sellerUid: UID_ME, admin: false }, true)
  await one('陌生人（非本人 ∧ 非管理员）', { sellerUid: UID_OTHER, admin: false }, false)
  await one('管理员看他人商品（can_access_admin ∧ manage_rewards）', { sellerUid: UID_OTHER, admin: true }, true)
  return {
    id: 'AC-1',
    title: '详情页【编辑】入口可见性（本人 / 陌生人 / 管理员）',
    pass: cases.every((c) => c.pass),
    cases,
  }
}

async function armPrefillNote(browser) {
  const state = makeState({ admin: true, mineRows: [] }) // 读口行不在「我发布的」⇒ 他人商品
  const { context, page, pageErrors, consoleErrors } = await makePage(browser, { state })
  await page.goto(`${ORIGIN}/item/${EDIT_ID}/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-form"]', { timeout: 8000 })
  await page.waitForSelector('[data-sf-m="item-admin-note"]', { timeout: 8000 })
  await settle(page)

  const read = await page.evaluate(() => {
    const v = (k) => document.querySelector(`[data-sf-m="${k}"]`)
    const checked = (k) => !!v(k)?.checked
    return {
      description: v('item-input-note')?.value ?? null,
      price: v('item-input-price')?.value ?? null,
      stock: v('item-input-stock')?.value ?? null,
      typePhysical: checked('item-input-type-physical'),
      typeDigital: checked('item-input-type-digital'),
      shipFree: checked('item-input-ship-free'),
      shipBuyer: checked('item-input-ship-buyer'),
      deliverAuto: checked('item-input-deliver-auto'),
      conditionLikeNew: checked('item-input-condition-likeNew'),
      existingMedia0: !!v('item-image-existing-0'),
      cidReadonly: (() => { const el = v('item-cid-readonly'); return !!el && (el.hasAttribute('readonly') || el.disabled === true) })(),
      noteText: v('item-admin-note')?.textContent?.trim() ?? null,
      formPresent: !!v('item-form'),
    }
  })

  const checks = {
    descriptionPrefilled: read.description === editRow.description,
    pricePrefilled: read.price === '9',
    stockPrefilled: read.stock === '4',
    itemTypeCascade: read.typePhysical === true && read.typeDigital === false
      && read.shipFree === true && read.shipBuyer === false && read.deliverAuto === false,
    conditionPrefilled: read.conditionLikeNew === true,
    mediaPrefilled: read.existingMedia0 === true,
    cidReadonly: read.cidReadonly === true,
    adminNotePresent: read.noteText !== null && read.noteText.length > 0,
    zeroPageError: pageErrors.length === 0,
  }
  await context.close()
  return {
    id: 'AC-2',
    title: '管理员编辑页：五项预填 + `item-admin-note` 提示条',
    pass: Object.values(checks).every(Boolean),
    checks,
    observed: { ...read, pageErrors, consoleErrors, userProbeCount: state.seen.user },
  }
}

async function armAdminSave(browser) {
  const state = makeState({ admin: true, mineRows: [] })
  const { context, page, pageErrors, consoleErrors } = await makePage(browser, { state })
  await page.goto(`${ORIGIN}/item/${EDIT_ID}/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-admin-note"]', { timeout: 8000 })
  await settle(page)

  await page.fill('[data-sf-m="item-input-price"]', '15')
  await page.click('[data-sf-m="item-primary"]')
  // 等 PATCH 落地 + 路由离开编辑页
  await page.waitForFunction(() => !document.querySelector('[data-sf-m="item-form"]'), null, { timeout: 10000 })
  await settle(page, 400)

  const patch = state.seen.patch
  const body = patch[0] || null
  const checks = {
    patchOnce: patch.length === 1,
    patchPriceOnly: !!body && Object.keys(body).length === 1 && body.price === 15,
    noTitleNoCid: !!body && !('title' in body) && !('cid' in body),
    leftForm: (await page.$('[data-sf-m="item-form"]')) === null,
    pathname: page.url(),
    backToList: /\/profile\/trades\/published/.test(new URL(page.url()).pathname),
    zeroPageError: pageErrors.length === 0,
  }
  await context.close()
  return {
    id: 'AC-3',
    title: '管理员保存（字段支 PATCH）⇒ 恰一次 `{price:15}` ⇒ 回列表',
    pass: checks.patchOnce && checks.patchPriceOnly && checks.noTitleNoCid && checks.leftForm && checks.backToList && checks.zeroPageError,
    checks,
    observed: { patch, consoleErrors },
  }
}

async function armForbidden(browser) {
  const state = makeState({ admin: false, editStatus: 403 })
  const { context, page, pageErrors } = await makePage(browser, { state })
  await page.goto(`${ORIGIN}/item/${EDIT_ID}/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-edit-load-error"]', { timeout: 8000 })
  await settle(page)

  const read = await page.evaluate(() => {
    const err = document.querySelector('[data-sf-m="item-edit-load-error"]')
    return {
      errorPresent: !!err,
      errorText: err ? err.textContent.trim() : null,
      backLink: !!err?.querySelector('a[href="/"]'),
      formPresent: !!document.querySelector('[data-sf-m="item-form"]'),
      rootChildren: document.querySelector('#root')?.children.length ?? 0,
      rootHtmlLen: document.querySelector('#root')?.innerHTML.length ?? 0,
    }
  })
  const checks = {
    errorRendered: read.errorPresent && (read.errorText || '').length > 0,
    notForbiddenLeak: !/AUTH_FORBIDDEN|ACTOR_NOT_ALLOWED|403/.test(read.errorText || ''),
    noForm: read.formPresent === false,
    notBlank: read.rootChildren > 0 && read.rootHtmlLen > 2000,
    zeroPageError: pageErrors.length === 0,
  }
  await context.close()
  return {
    id: 'AC-4',
    title: '普通用户直访他人编辑页：403 ⇒ 有文案、无表单、不白屏、零 pageerror',
    pass: Object.values(checks).every(Boolean),
    checks,
    observed: { ...read, pageErrors },
  }
}

async function armGeometry(browser, width, height) {
  const state = makeState({ admin: true, sellerUid: UID_OTHER })
  const { context, page, pageErrors } = await makePage(browser, { width, height, state })
  await page.goto(`${ORIGIN}/item/${DETAIL_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="item-edit-link"]', { timeout: 8000 })
  await settle(page, 400)

  const g = await page.evaluate(() => {
    const R = (el) => {
      if (!el || !el.getClientRects().length) return null
      const r = el.getBoundingClientRect()
      return { left: +r.left.toFixed(2), right: +r.right.toFixed(2), top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }
    }
    const link = document.querySelector('[data-sf-m="item-edit-link"]')
    const bar = document.querySelector('[data-sf-m="item-actionbar"]')
    const tab = document.querySelector('.sf-tabbar')
    const topbar = document.querySelector('[data-sf-m="item-back"]')?.parentElement || null
    return {
      link: R(link), actionbar: R(bar), tabbar: R(tab), topbar: R(topbar),
      tabbarDisplay: tab ? getComputedStyle(tab).display : null,
      tabbarClass: tab ? tab.className : null,
      linkFontSize: link ? getComputedStyle(link).fontSize : null,
      linkBg: link ? getComputedStyle(link).backgroundColor : null,
      linkFg: link ? getComputedStyle(link).color : null,
      overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    }
  })
  const ov = (a, b) => {
    if (!a || !b) return 0
    const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    return +(w * h).toFixed(2)
  }
  const checks = {
    linkPresent: !!g.link,
    insideViewport: !!g.link && g.link.left >= 0 && g.link.right <= g.viewport.w + 0.5 && g.link.top >= 0,
    notOverTabbar: ov(g.link, g.tabbar) === 0,
    notOverActionbar: ov(g.link, g.actionbar) === 0,
    inTopbarRow: !!g.topbar && !!g.link && g.link.top >= g.topbar.top - 0.5 && g.link.bottom <= g.topbar.bottom + 0.5,
    touchTargetOk: !g.link || width > 767 || g.link.h >= 44,
    fontMin: !g.link || parseFloat(g.linkFontSize) >= 12,
    zeroOverflow: g.overflowPx === 0,
    zeroPageError: pageErrors.length === 0,
  }
  await context.close()
  return {
    id: `AC-5@${width}x${height}`,
    title: `入口位置（${width}×${height}）：不压底栏 / 不压操作胶囊 / 零溢出 / 零 pageerror`,
    pass: Object.values(checks).every(Boolean),
    checks,
    observed: { ...g, tabbarOverlap: ov(g.link, g.tabbar), actionbarOverlap: ov(g.link, g.actionbar), pageErrors },
  }
}

// ---- main ---------------------------------------------------------------------
const main = async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`DIST 缺 index.html：${DIST}`)
    process.exit(3)
  }
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--host-resolver-rules=MAP sf.local 127.0.0.1', '--ignore-certificate-errors', '--no-first-run'],
  })
  const arms = []
  const run = async (fn, label) => {
    try {
      const r = await fn()
      arms.push(r)
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${label}`)
    } catch (error) {
      arms.push({ id: label, pass: false, error: String(error && error.message ? error.message : error) })
      console.log(`FAIL  ${label}  ${error && error.message ? error.message : error}`)
    }
  }

  await run(() => armEntryVisibility(browser), 'AC-1 入口可见性')
  await run(() => armPrefillNote(browser), 'AC-2 预填 + 提示条')
  await run(() => armAdminSave(browser), 'AC-3 管理员保存')
  await run(() => armForbidden(browser), 'AC-4 403 不白屏')
  await run(() => armGeometry(browser, 390, 844), 'AC-5 390')
  await run(() => armGeometry(browser, 1536, 900), 'AC-5 1536')

  await browser.close()
  const result = {
    probe: 'ops/admin-edit/front/probe-five-arms.mjs',
    generatedAt: new Date().toISOString(),
    dist: DIST,
    head: process.env.PROBE_HEAD || null,
    verdict: arms.every((a) => a.pass) ? 'PASS' : 'FAIL',
    arms,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`\nverdict=${result.verdict}  arms=${arms.length}  out=${OUT}`)
  process.exit(result.verdict === 'PASS' ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
