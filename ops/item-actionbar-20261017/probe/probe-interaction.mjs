/**
 * /item/:id 操作栏交互语义探针（Kong 实现单）
 * 判据：① 未登录 ⇒ 立即购买 disabled（不提交）、聊一聊/收藏点击走既有登录引导（转 /login + state.from）
 *       ② 登录 ⇒ 收藏 toggle 真打 /api/favorites（POST / DELETE 各一次）+ data-sf-fav / aria-pressed / 星标 fill 同步
 *       ③ 登录 ⇒ 聊一聊 POST /api/messages/conversations 后**就地叠加**（pathname 不变、search 加 msg=1）
 * 零 dev server（route 映射 dist）/ 零真后端（route 内存自截）/ 零库写
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const DIST = path.join(REPO, 'frontend/dist')
const OUT = path.join(REPO, 'ops/item-actionbar-20261017/readings/probe-interaction.json')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
const MY_UID = 970213
const calls = []
let failChat = false // 第 ⑤ 态：让 POST /api/messages/conversations 失败 ⇒ 验 `item-chat-status` 钩子仍在（错误态条件渲染）

const api = (method, pathname) => {
  const ok = (d) => ({ success: true, data: d })
  if (/^\/api\/prize\/\d+$/.test(pathname)) {
    return ok({ bID: 888, listing_id: 888, status: 'listed', stock: 1, name: '九成新 尼康 Z fc', title: '九成新 尼康 Z fc', points: 2680, price: 2680, description: '自用不到一年。', seller: { uid: 970301 } })
  }
  if (pathname === '/api/favorites' && method === 'GET') return ok([])
  if (pathname === '/api/favorites' && method === 'POST') return ok({ listing_id: 888 })
  if (/^\/api\/favorites\/\d+$/.test(pathname) && method === 'DELETE') return ok({ ok: true })
  if (pathname === '/api/messages/conversations' && method === 'POST') {
    if (failChat) return { success: false, error: { code: 'MSG_SELF_CONVERSATION', i18n_key: 'msg.err.MSG_SELF_CONVERSATION' } }
    return ok({ conversation_id: 7, created: false })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const out = { probe: 'probe-interaction.mjs (Kong)', states: {}, pageErrors: [] }

const open = async (auth) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript((a) => {
    localStorage.setItem('theme', 'light')
    if (a) {
      localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
      localStorage.setItem('token', 'qa-token')
    } else { localStorage.removeItem('user'); localStorage.removeItem('token') }
  }, auth)
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      calls.push(`${req.method()} ${u.pathname}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(api(req.method(), u.pathname)) })
    }
    let f = path.join(DIST, u.pathname)
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory() || !path.extname(f)) f = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) })
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => out.pageErrors.push(String(e && e.message)))
  await page.goto('http://sf.local/item/888', { waitUntil: 'load' })
  await page.waitForSelector('[data-sf-m="item-actionbar"]')
  await page.waitForTimeout(300)
  return { context, page }
}
const favState = (page) => page.evaluate(() => {
  const b = document.querySelector('[data-sf-m="fav-toggle"]')
  const svg = b && b.querySelector('svg')
  return { dataSfFav: b && b.getAttribute('data-sf-fav'), ariaPressed: b && b.getAttribute('aria-pressed'), label: b && b.textContent.trim(), fill: svg && (svg.getAttribute('fill') || null), computedFill: svg && getComputedStyle(svg).fill }
})
const where = (page) => page.evaluate(() => ({ pathname: location.pathname, search: location.search }))

// ① 未登录
{
  calls.length = 0
  const { context, page } = await open(false)
  const before = await where(page)
  const buyDisabled = await page.evaluate(() => document.querySelector('[data-sf-m="item-buy-btn"]').disabled)
  await page.evaluate(() => document.querySelector('[data-sf-m="item-buy-btn"]').click())
  await page.waitForTimeout(250)
  const afterBuyClick = await where(page)
  out.states.anon_buy = { before, buyDisabled, afterBuyClick, buyApiCalls: calls.filter((c) => /\/buy$/.test(c)) }
  calls.length = 0
  await page.evaluate(() => document.querySelector('[data-sf-m="item-chat-btn"]').click())
  await page.waitForTimeout(400)
  out.states.anon_chat = { after: await where(page), calls: [...calls] }
  await context.close()
}
{
  calls.length = 0
  const { context, page } = await open(false)
  await page.evaluate(() => document.querySelector('[data-sf-m="fav-toggle"]').click())
  await page.waitForTimeout(400)
  out.states.anon_fav = { after: await where(page), calls: [...calls] }
  await context.close()
}

// ② 登录：收藏 toggle 真打写口
{
  calls.length = 0
  const { context, page } = await open(true)
  const s0 = await favState(page)
  await page.click('[data-sf-m="fav-toggle"]')
  await page.waitForTimeout(500)
  const s1 = await favState(page)
  await page.click('[data-sf-m="fav-toggle"]')
  await page.waitForTimeout(500)
  const s2 = await favState(page)
  out.states.auth_fav = { before: s0, afterAdd: s1, afterRemove: s2, calls: [...calls] }
  await context.close()
}

// ③ 登录：聊一聊 = POST 后就地叠加（pathname 不变）
{
  calls.length = 0
  const { context, page } = await open(true)
  const before = await where(page)
  await page.click('[data-sf-m="item-chat-btn"]')
  await page.waitForTimeout(700)
  const after = await where(page)
  out.states.auth_chat = { before, after, pathnameIdentical: before.pathname === after.pathname, calls: [...calls], panelMounted: await page.evaluate(() => !!document.querySelector('.sf-mp')) }
  await context.close()
}

// ⑤ 登录 + 聊一聊失败 ⇒ `item-chat-status` 仍渲染，且落在按钮行**下方**
{
  calls.length = 0
  failChat = true
  const { context, page } = await open(true)
  await page.click('[data-sf-m="item-chat-btn"]')
  await page.waitForTimeout(700)
  const st = await page.evaluate(() => {
    const el = document.querySelector('[data-sf-m="item-chat-status"]')
    const btns = [...document.querySelectorAll('[data-sf-m="item-chat-btn"],[data-sf-m="item-buy-btn"],[data-sf-m="fav-toggle"]')]
      .filter((b) => b.getClientRects().length > 0).map((b) => b.getBoundingClientRect().bottom)
    const r = el && el.getBoundingClientRect()
    return {
      present: !!el, text: el && el.textContent.trim(),
      rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      buttonsBottom: btns.length ? Math.round(Math.max(...btns)) : null,
      belowButtons: r ? r.top >= Math.max(...btns) : null,
      barHeight: document.querySelector('[data-sf-m="item-actionbar"]').getBoundingClientRect().height,
    }
  })
  out.states.auth_chat_error = { ...st, calls: [...calls] }
  failChat = false
  await context.close()
}

out.finishedAt = new Date().toISOString()
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 1))
await browser.close()
