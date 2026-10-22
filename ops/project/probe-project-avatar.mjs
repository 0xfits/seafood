/**
 * 项目头像写口探针（Kevin 2026-10-22②：项目页头部换头像 / 恢复默认）
 *
 * 判据（逐条对齐派单验证项）：
 *   ① 入口显隐两臂：owner 见相机钮（`aria-label` = zh `project.avatarChange`，`accept=image/*` 的
 *      文件选择器在）；**普通用户零入口、零 input、零 PATCH**（头像本身仍渲染）；
 *   ② 真上传：选一张 PNG ⇒ 客户端压缩 ⇒ `POST /api/media` ⇒ `PATCH /api/project/11`
 *      **载荷恰 `{avatar_url:'/api/media/901'}`**（键集逐字）⇒ 静默重拉 ⇒ 头像 `<img src>` 变
 *      `/api/media/901`（页面无刷新、无成功弹窗）；
 *   ③ 恢复默认：点【恢复默认】只出**行内二次确认**（此时零 PATCH），确认后 `PATCH {avatar_url:null}`
 *      ⇒ 重拉 ⇒ 头像回到项目名首字兜底；
 *   ④ 几何两档（390 / 1536）：`scrollWidth - clientWidth = 0`（页面与头像块都不横向溢出）+ 零 pageerror。
 *
 * 手法（同 `ops/project-page/probe-project-page.mjs` 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 `context.route` 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node ops/project/probe-project-avatar.mjs [out.json]
 *   退出码 0 = 全部判据为真；1 = 任一为假（明细见输出 JSON）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/project/readings/probe-project-avatar.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const OWNER_UID = 970213
const OTHER_UID = 555001
/** 1×1 PNG（真图，canvas 可解码 ⇒ 压缩链路真跑一遍，不是 mock）。 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单，按批结算。',
  status: 'recruiting',
  headcount: 3,
  hired_count: 1,
  recruit_min_account_days: 7,
  wage_batt_par_claim: 30,
  wage_batt_per_claim: 30,
  wage_cid: null,
  wage_currency_amount: 0,
  wage_interval_hours: 4,
  owner_uid: OWNER_UID,
  avatar_url: null,
  campaigns: [],
  ...patch,
})

const ok = (data) => ({ success: true, data })

/** 单臂会话：自截 API + 磁盘 dist 静态服务；返回该臂的 STATE（调用记录 / 可见行）。 */
const makeArm = async (browser, { viewerUid, view }) => {
  const STATE = { view, media: [], patch: [], reads: 0, calls: [] }
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ uid }) => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: uid, uid, token: `probe-${uid}`, bio: 'probe', name: 'Probe' }))
    localStorage.setItem('token', `probe-${uid}`)
  }, { uid: viewerUid })

  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.origin !== ORIGIN) return route.fulfill({ status: 404, body: '' })
    if (u.pathname.startsWith('/api/')) {
      const method = req.method()
      let body = null
      try { body = req.postData() ? JSON.parse(req.postData()) : null } catch { body = null }
      STATE.calls.push({ method, path: u.pathname })
      if (u.pathname === '/api/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ uID: viewerUid })) })
      if (u.pathname === '/api/currencies') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([{ cid: 1, symbol: '$' }])) })
      if (u.pathname === '/api/project/sui') {
        STATE.reads += 1
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(STATE.view)) })
      }
      if (u.pathname === '/api/media' && method === 'POST') {
        STATE.media.push(body)
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ok({ media_id: 901, url: '/api/media/901', sha256: 'probe', size_bytes: 128, deduplicated: false })),
        })
      }
      if (u.pathname === '/api/project/11' && method === 'PATCH') {
        STATE.patch.push(body)
        Object.assign(STATE.view, body || {})
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(STATE.view)) })
      }
      if (u.pathname === '/api/batt') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(ok({ batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true, bttc: { balance: '0', status: 'listed', canMint: false, canBurn: false, usdBalance: '0', policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1 } } })),
        })
      }
      if (u.pathname === '/api/messages/unread-count') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ unread_total: 0 })) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' },
      body: fs.readFileSync(file),
    })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  return { context, page, STATE, pageErrors }
}

const settle = async (page) => {
  await page.waitForTimeout(120)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(120)
}

const snap = (page) => page.evaluate(() => {
  const q = (name) => document.querySelector(`[data-sf-m="${name}"]`)
  const avatarImg = q('project-avatar-img')
  const change = q('project-avatar-change')
  const input = q('project-avatar-input')
  const reset = q('project-avatar-reset')
  const notice = q('project-avatar-notice')
  const root = document.querySelector('.sf-project-page')
  const doc = document.documentElement
  return {
    avatarPresent: Boolean(q('project-avatar')),
    avatarSrc: avatarImg ? avatarImg.getAttribute('src') : null,
    initialText: q('project-avatar-initial') ? q('project-avatar-initial').textContent : null,
    changePresent: Boolean(change),
    changeLabel: change ? change.getAttribute('aria-label') : null,
    changeTag: change ? change.tagName : null,
    changeBox: change ? (() => { const r = change.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })() : null,
    inputPresent: Boolean(input),
    inputAccept: input ? input.getAttribute('accept') : null,
    resetPresent: Boolean(reset),
    resetConfirmPresent: Boolean(q('project-avatar-reset-confirm')),
    noticeText: notice ? notice.textContent.trim() : null,
    overflow: {
      doc: doc.scrollWidth - doc.clientWidth,
      page: root ? root.scrollWidth - root.clientWidth : null,
      avatar: q('project-avatar') ? q('project-avatar').scrollWidth - q('project-avatar').clientWidth : null,
    },
  }
})

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/project/probe-project-avatar.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { project: 'sui', media: 'in-probe POST /api/media ⇒ media_id 901', auth: 'localStorage seed', writes: 'zero（全在 context.route 内截）' },
    states: {}, assertions: {}, pageErrors: {},
  }

  // ======================= 臂 1 · owner：入口 + 上传 + 恢复默认 + 两档几何 =======================
  const owner = await makeArm(browser, { viewerUid: OWNER_UID, view: viewOf() })
  await owner.page.goto(`${ORIGIN}/sui`, { waitUntil: 'load' })
  await settle(owner.page)
  const before = await snap(owner.page)
  out.states['owner_before'] = before
  out.assertions.ownerEntry = {
    avatarRendered: before.avatarPresent === true,
    changeEntryPresent: before.changePresent === true,
    changeLabelI18n: before.changeLabel === ZH.project.avatarChange,
    changeIsButton: before.changeTag === 'BUTTON',
    changeHitArea24: Boolean(before.changeBox) && before.changeBox.w >= 24 && before.changeBox.h >= 24,
    fileInputAcceptImage: before.inputAccept === 'image/*',
    initialFallback: before.initialText === '海' && before.avatarSrc === null,
    noResetWithoutAvatar: before.resetPresent === false,
  }

  // 真选图 ⇒ 压缩 ⇒ POST /api/media ⇒ PATCH
  await owner.page.setInputFiles('[data-sf-m="project-avatar-input"]', {
    name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX,
  })
  await owner.page.waitForFunction(
    () => document.querySelector('[data-sf-m="project-avatar-img"]')?.getAttribute('src') === '/api/media/901',
    { timeout: 8000 },
  ).catch(() => {})
  await settle(owner.page)
  const after = await snap(owner.page)
  out.states['owner_after_upload'] = after
  out.states['owner_media_payload'] = owner.STATE.media
  out.states['owner_patch_payload'] = owner.STATE.patch
  const mediaBody = owner.STATE.media[0] || null
  const patchBody = owner.STATE.patch[0] || null
  out.assertions.ownerUpload = {
    mediaCalledOnce: owner.STATE.media.length === 1,
    _mediaPayloadKeys: mediaBody ? Object.keys(mediaBody).sort() : [],
    mediaPayloadKeySetExact: Boolean(mediaBody)
      && JSON.stringify(Object.keys(mediaBody).sort()) === JSON.stringify(['content_type', 'data_base64']),
    mediaContentTypeImage: Boolean(mediaBody) && /^image\/(webp|jpeg|png)$/.test(String(mediaBody.content_type)),
    mediaBase64NonEmpty: Boolean(mediaBody) && typeof mediaBody.data_base64 === 'string' && mediaBody.data_base64.length > 0,
    patchCalledOnce: owner.STATE.patch.length === 1,
    patchPayloadExact: Boolean(patchBody)
      && JSON.stringify(Object.keys(patchBody)) === JSON.stringify(['avatar_url'])
      && patchBody.avatar_url === '/api/media/901',
    avatarSrcUpdated: after.avatarSrc === '/api/media/901',
    initialGone: after.initialText === null,
    resetEntryAppeared: after.resetPresent === true,
    silentReload: owner.STATE.reads >= 2,
    noErrorNotice: after.noticeText === null,
  }

  // 恢复默认：先确认行（零 PATCH）⇒ 取消零 PATCH ⇒ 再确认 ⇒ PATCH {avatar_url:null}
  const patchCountBeforeReset = owner.STATE.patch.length
  await owner.page.click('[data-sf-m="project-avatar-reset"]')
  await settle(owner.page)
  const patchAtConfirmOpen = owner.STATE.patch.length
  const confirming = await snap(owner.page)
  out.states['owner_reset_confirm'] = confirming
  await owner.page.click('[data-sf-m="project-avatar-reset-cancel"]')
  await settle(owner.page)
  const patchAtCancel = owner.STATE.patch.length
  const cancelled = await snap(owner.page)
  out.states['owner_reset_cancelled'] = cancelled
  await owner.page.click('[data-sf-m="project-avatar-reset"]')
  await settle(owner.page)
  await owner.page.click('[data-sf-m="project-avatar-reset-ok"]')
  await owner.page.waitForFunction(
    () => !document.querySelector('[data-sf-m="project-avatar-img"]'),
    { timeout: 8000 },
  ).catch(() => {})
  await settle(owner.page)
  const reset = await snap(owner.page)
  out.states['owner_after_reset'] = reset
  const resetPatch = owner.STATE.patch[owner.STATE.patch.length - 1] || null
  out.assertions.ownerReset = {
    confirmRowShown: confirming.resetConfirmPresent === true,
    zeroPatchBeforeConfirm: patchAtConfirmOpen === patchCountBeforeReset,
    cancelClosesRow: cancelled.resetConfirmPresent === false,
    zeroPatchAfterCancel: patchAtCancel === patchCountBeforeReset,
    patchAfterConfirm: owner.STATE.patch.length === patchCountBeforeReset + 1,
    resetPayloadExact: Boolean(resetPatch)
      && JSON.stringify(resetPatch) === JSON.stringify({ avatar_url: null }),
    avatarBackToInitial: reset.avatarSrc === null && reset.initialText === '海',
    resetEntryGone: reset.resetPresent === false,
  }

  // 两档几何（1536 已在上面采样；再走 390）+ 零 pageerror
  const geom = {}
  for (const width of [390, 1536]) {
    await owner.page.setViewportSize({ width, height: 900 })
    await settle(owner.page)
    const s = await snap(owner.page)
    geom[`w${width}`] = s.overflow
  }
  out.states.geometry = geom
  out.assertions.geometry = {
    noOverflow390: geom.w390.doc === 0 && geom.w390.page === 0,
    noOverflow1536: geom.w1536.doc === 0 && geom.w1536.page === 0,
    noAvatarBlockOverflow: geom.w390.avatar === 0 && geom.w1536.avatar === 0,
  }
  out.pageErrors.owner = owner.pageErrors
  await owner.context.close()

  // ======================= 臂 2 · 普通用户：零入口零 input 零写口 =======================
  const other = await makeArm(browser, { viewerUid: OTHER_UID, view: viewOf({ avatar_url: '/api/media/9' }) })
  await other.page.goto(`${ORIGIN}/sui`, { waitUntil: 'load' })
  await settle(other.page)
  const guest = await snap(other.page)
  out.states['other_viewer'] = guest
  out.assertions.otherViewer = {
    avatarVisible: guest.avatarPresent === true && guest.avatarSrc === '/api/media/9',
    noChangeEntry: guest.changePresent === false,
    noFileInput: guest.inputPresent === false,
    noResetEntry: guest.resetPresent === false,
    zeroWrites: other.STATE.patch.length === 0 && other.STATE.media.length === 0,
    noOverflow: guest.overflow.doc === 0 && guest.overflow.page === 0,
  }
  out.pageErrors.other = other.pageErrors
  await other.context.close()

  await browser.close()

  // ======================= 汇总 =======================
  const flat = {}
  for (const [group, row] of Object.entries(out.assertions)) {
    for (const [name, value] of Object.entries(row)) {
      if (name.startsWith('_')) continue // 展示字段（数组/字符串）不进汇总
      flat[`${group}.${name}`] = value === true
    }
  }
  const failed = Object.entries(flat).filter(([, v]) => !v).map(([k]) => k)
  out.summary = {
    assertions: Object.keys(flat).length,
    passed: Object.keys(flat).length - failed.length,
    failed,
    pageErrors: Object.values(out.pageErrors).flat().length,
    ok: failed.length === 0 && Object.values(out.pageErrors).flat().length === 0,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`[probe-avatar] ${out.summary.passed}/${out.summary.assertions} passed · pageErrors=${out.summary.pageErrors} ⇒ ${out.summary.ok ? 'OK' : 'FAIL'}`)
  if (failed.length) console.log(`[probe-avatar] failed: ${failed.join(', ')}`)
  console.log(`[probe-avatar] written: ${OUT}`)
  process.exit(out.summary.ok ? 0 : 1)
}

main().catch((error) => {
  console.error('[probe-avatar] crashed:', error)
  process.exit(1)
})
