/**
 * 管理员编辑（0059）· 探针共享夹具/装配层（五臂探针 + 负控探针共用）
 * ============================================================================
 * 只读性：全部 API 在 `context.route` 内内存自截（零真后端 / 零库写 / 零生产数据），
 *        静态面 = `context.route` 把 http://sf.local/** 映射到磁盘 `frontend/dist`（零 dev server）。
 * 登录态：`addInitScript` 预置 `localStorage.user`（按 `auth.js` 的读形状：`{uID, evm, token}`）。
 *
 * 五臂（与本单 AC 编号一一对应）：
 *   AC-1 入口可见性三态：本人 / 陌生人（非管理员）/ 管理员看他人商品  ⇒ `item-edit-link` 在场性
 *   AC-2 管理员编辑页：五项预填（description/price/stock/item_type 级联/media）+ 页头 `item-admin-note`
 *   AC-3 管理员保存：改价 ⇒ `PATCH /api/listing/501` 载荷恰 `{price:15}` ⇒ 回列表（不留在表单）
 *   AC-4 普通用户直访他人编辑页：读口 403 ⇒ `item-edit-load-error` 有文案、无表单、不白屏、零 pageerror
 *   AC-5 入口位置：390 / 1536 两档 —— 不压底栏（`.sf-tabbar`）/ 不压操作胶囊（`item-actionbar`）、
 *        零横向溢出、零 pageerror
 *
 * 用法：node ops/admin-edit/front/probe-five-arms.mjs [out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require("playwright")

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/admin-edit/front/readings/five-arms.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（内存 JSON） -------------------------------------------------------
const UID_ME = 7001
const UID_OTHER = 9001
const EDIT_ID = 501
const DETAIL_ID = 9

const ADMIN_FLAGS = { can_access_admin: true, is_admin: false, permissions: ['manage_rewards'] }
const NO_ADMIN_FLAGS = { can_access_admin: false, is_admin: false, permissions: [] }

const detailRow = (sellerUid, status = 'listed') => ({
  listing_id: DETAIL_ID,
  title: '九成新折叠桌子',
  description: '九成新折叠桌子\n自提，仅限本周末',
  price: 120, cid: 1, status, stock: 2, media_urls: [], wants: 3, views: 11,
  item_type: 'PhysicalFreeShip', condition: 'LikeNew',
  seller: { uid: sellerUid, nickname: '0x12**cd', credit: 'new' },
})

const editRow = {
  listing_id: EDIT_ID,
  title: '旧描述首行',
  price: 9, cid: 1, status: 'listed', stock: 4,
  media_urls: ['/api/media/11'],
  time_created: '2026-10-20 10:00:00',
  description: '旧描述首行\n旧描述第二行',
  item_type: 'PhysicalFreeShip',
  condition: 'LikeNew',
}

const ok = (data) => ({ success: true, data })
const fail = (status, code, reason) => ({
  status,
  body: { success: false, error: { code, i18n_key: `uiError.${code === 'AUTH_FORBIDDEN' ? 'forbidden' : 'notFound'}`, ...(reason ? { details: { reason } } : {}) } },
})

/** 每臂一个 state（`admin` / `sellerUid` / `editStatus` / `mineRows` / `seen`）。 */
const makeState = (over = {}) => ({
  admin: false, sellerUid: UID_OTHER, editStatus: 200, mineRows: [], seen: { user: 0, patch: [] },
  ...over,
})

const handleApi = (state) => (method, pathname, rawBody) => {
  if (pathname === '/api/user') {
    state.seen.user += 1
    return ok({ uID: UID_ME, evm: '0xprobe', admin: state.admin ? ADMIN_FLAGS : NO_ADMIN_FLAGS })
  }
  if (pathname === `/api/prize/${DETAIL_ID}`) return ok(detailRow(state.sellerUid))
  if (pathname === '/api/favorites') return ok([])
  if (pathname === '/api/listing/mine') return ok(state.mineRows)
  if (pathname === `/api/listing/${EDIT_ID}/edit`) {
    if (state.editStatus === 403) return fail(403, 'AUTH_FORBIDDEN', 'ACTOR_NOT_ALLOWED')
    if (state.editStatus === 404) return fail(404, 'LEDGER_REF_NOT_FOUND')
    return ok(editRow)
  }
  if (pathname === `/api/listing/${EDIT_ID}` && method === 'PATCH') {
    let body = null
    try { body = JSON.parse(rawBody || '{}') } catch (e) { body = { parse_error: String(e) } }
    state.seen.patch.push(body)
    return ok({ ...editRow, price: body?.price ?? editRow.price })
  }
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: '社区积分' }])
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (pathname === '/api/home') return ok({ prizes: [], tasks: [], user_points: 0, claimed_prize_ids: [] })
  if (pathname === '/api/listing-orders/bought' || pathname === '/api/listing-orders/sold') return ok([])
  if (pathname === '/api/prize-item') return ok([])
  if (method === 'GET') return ok([])
  return ok({})
}

// ---- 页面装配 -----------------------------------------------------------------
async function makePage(browser, { width = 1440, height = 900, state }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'zh-CN',
  })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  // 登录态：预置 `localStorage.user`（token 无 `exp` ⇒ `isAuthenticatedUser` 视为有效，绝不误踢）
  await context.addInitScript(([uid]) => {
    try {
      localStorage.setItem('user', JSON.stringify({ uID: uid, evm: '0xprobe', token: 'probe-token', bio: 'probe' }))
      localStorage.setItem('token', 'probe-token')
      localStorage.setItem('theme', 'light')
    } catch (e) { /* noop */ }
  }, [UID_ME])

  await context.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.pathname.startsWith('/api/')) {
      const res = handleApi(state)(req.method(), url.pathname, req.postData())
      if (res.status && res.body) {
        return route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.body) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) })
    }
    let rel = decodeURIComponent(url.pathname)
    let file = path.join(DIST, rel)
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html') // SPA 回退（与 vercel rewrite 同形）
    }
    const ext = path.extname(file).toLowerCase()
    return route.fulfill({
      status: 200,
      contentType: MIME[ext] || 'application/octet-stream',
      body: fs.readFileSync(file),
    })
  })

  // 禁动画（几何判据的前置）
  await context.addInitScript(() => {
    const css = '*,*::before,*::after{animation:none!important;transition:none!important}'
    const apply = () => {
      const s = document.createElement('style')
      s.textContent = css
      document.head ? document.head.appendChild(s) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s))
    }
    apply()
  })
  return { context, page, pageErrors, consoleErrors }
}

const rectOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el || !el.getClientRects().length) return null
  const r = el.getBoundingClientRect()
  return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), left: +r.left.toFixed(2), right: +r.right.toFixed(2), top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2) }
}, sel)

const overlapArea = (a, b) => {
  if (!a || !b) return 0
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return +(w * h).toFixed(2)
}

async function settle(page, ms = 250) {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}


export {
  REPO, DIST, OUT, CHROME, ORIGIN, UID_ME, UID_OTHER, EDIT_ID, DETAIL_ID,
  ADMIN_FLAGS, NO_ADMIN_FLAGS, detailRow, editRow, makeState, handleApi, makePage,
  rectOf, overlapArea, settle,
}

export { chromium }
