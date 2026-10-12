// A5 站内信前端 · AC 真跑共用夹具（Kong · 2026-10-12）
// 受控实例：前端 http://127.0.0.1:5792 → 后端 http://127.0.0.1:5793（新路由）
// 不改仓内任何配置：vite 配置落 frontend/node_modules/.hermes-vite-eval.mjs（gitignore 内）。
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'

export const BASE = 'http://127.0.0.1:5792'
export const ARTDIR = '/Users/kevin/bistro/seafood/frontend/.v117-messaging-fe-artifacts'

// 现取（5793 真实后端 + 共享 dev 库）：
//   listing 19 = 「海鲜礼盒测试丙：虾蟹双拼」· seller uid = 1
//   uid 7 = 非卖家（买家，已有会话 18 + 1 条未读）
export const ITEM_ID = 19
export const SELLER_UID = 1
export const BUYER_UID = 7
export const CONV_ID = 18

export const TOKENS = JSON.parse(
  await import('node:fs').then((fs) => fs.readFileSync('/Users/kevin/.hermes/profiles/zang/cache/scratch/ac/tokens.json', 'utf8')),
)

/** 登录态种子（localStorage['user'] = 既有 auth.js 契约）。 */
export const session = (uID) => ({
  uID: Number(uID),
  uid: Number(uID),
  token: TOKENS[String(uID)],
  access_token: TOKENS[String(uID)],
  evm: `0x${String(uID).padStart(40, '0')}`,
  nickname: `u${uID}`,
  bio: 'ac-run',
})

/**
 * 打开一个页面。opts: { width, height, theme, uID (null ⇒ 未登录), lang }
 * 采数前禁动画（外场伪影）。
 */
export async function openPage(browser, { width = 390, height = 844, theme = 'light', uID = null, ls = {} } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  })
  await context.addInitScript(
    ([t, uid, sess, extra]) => {
      try {
        localStorage.setItem('theme', t)
        if (sess) localStorage.setItem('user', JSON.stringify(sess))
        else localStorage.removeItem('user')
        for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v)
      } catch (e) { /* noop */ }
    },
    [theme, uID, uID == null ? null : session(uID), ls],
  )
  const page = await context.newPage()
  // 请求日志（AC-1 网络痕迹 / AC-3 无轮询）
  const reqs = []
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), t: Date.now() }))
  return { context, page, reqs }
}

export const NO_ANIM = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

/** 稳定窗：注入禁动画 + 等 ≥3 帧。 */
export async function settle(page, ms = 350) {
  await page.addStyleTag({ content: NO_ANIM })
  await page.evaluate(() => new Promise((res) => {
    let n = 0
    const tick = () => { n += 1; if (n >= 3) res(); else requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }))
  await page.waitForTimeout(ms)
}

export const sha256 = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')

/** 页面内：采集「可见元素」的几何快照（结构键，不含坐标进键）。 */
export const VISIBLE_SNAPSHOT = `(() => {
  const out = []
  const all = document.querySelectorAll('body *')
  for (const el of all) {
    if (el.getClientRects().length === 0) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const cls = Array.from(el.classList).join('.')
    out.push({
      tag: el.tagName,
      cls,
      hook: el.getAttribute('data-sf-m') || '',
      nav: el.getAttribute('data-sf-nav') || '',
      x: Math.round(r.x * 1000) / 1000,
      y: Math.round(r.y * 1000) / 1000,
      w: Math.round(r.width * 1000) / 1000,
      h: Math.round(r.height * 1000) / 1000,
    })
  }
  return out
})()`

/** 页面内：可见文本的实测字号（computed）+ 绘制文本盒高度（Range 实测像素）。 */
export const TEXT_READINGS = `(() => {
  const out = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walk.nextNode())) {
    const txt = (n.nodeValue || '').trim()
    if (!txt) continue
    const parent = n.parentElement
    if (!parent) continue
    if (parent.getClientRects().length === 0) continue
    const s = getComputedStyle(parent)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    const range = document.createRange()
    range.selectNodeContents(n)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    out.push({
      txt: txt.slice(0, 40),
      hook: parent.closest('[data-sf-m]')?.getAttribute('data-sf-m') || '',
      fontSizePx: parseFloat(s.fontSize),
      textBoxH: Math.round(rect.height * 100) / 100,
      textBoxW: Math.round(rect.width * 100) / 100,
    })
  }
  return out
})()`

/** 页面内：rect + 检出函数（对单元素）。 */
export const rectOf = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)})
  if (!el) return null
  const r = el.getBoundingClientRect()
  const s = getComputedStyle(el)
  return {
    x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100,
    w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
    visible: el.getClientRects().length > 0 && s.visibility !== 'hidden' && s.display !== 'none',
    display: s.display, visibility: s.visibility, position: s.position,
    overflowX: (() => { const d = document.documentElement; return d.scrollWidth - d.clientWidth })(),
  }
})()`

export const isVisible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return false
  const st = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  return el.getClientRects().length > 0 && st.visibility !== 'hidden' && st.display !== 'none'
    && r.width > 0 && r.height > 0
}, sel)

export const countOf = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel)

export async function gotoL(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1200)
}

export async function launch() {
  const browser = await chromium.launch({
    executablePath: '/Users/kevin/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  })
  return browser
}
