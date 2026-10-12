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

/**
 * ★ DOM 变更静默等待（几何尺子的确定性前提，2026-10-12 · Kong）。
 * 为什么需要：日/夜几何快照的**元素级差异**里，除被显式排除的主题图标子树外，还有两类
 * **与主题无关的时序竞态**（实测 ac456 循环 24 档中偶发 5–7 档误判负）：
 *   ① 未读角标 `SPAN.sf-badge-count`（`tabbar-unread-badge` / `floatmenu-unread-badge`）：
 *      进入 `/messages?c=` 会推进读水位 ⇒ unread_total 归零 ⇒ 角标被移除；它落地的时刻相对
 *      快照的先后在两次取数间可不同 ⇒ 一侧有角标、另一侧没有。
 *   ② 消息流取数竞态：`fetchConversationMessages` 落地前渲染的是
 *      `P.sf-msg-status.sf-msg-err[data-sf-m=messages-thread-status]`（失败态），落地后才是
 *      `DIV.sf-msg-thread` + 气泡；两次取数间可能一侧还在失败态。
 * 二者都是「网络响应落地 ⇒ React 重渲染 ⇒ DOM 变更」⇒ 等 DOM 连续 quietMs 无变更即可收敛到同一态。
 * 只加等待，不改任何判据/阈值。
 */
export async function waitQuiet(page, { quietMs = 600, timeoutMs = 12000 } = {}) {
  return page.evaluate(([qm, tm]) => new Promise((resolve) => {
    let done = false
    let idle = null
    const finish = (why) => { if (done) return; done = true; try { obs.disconnect() } catch (e) { /* noop */ } clearTimeout(hard); clearTimeout(idle); resolve(why) }
    const obs = new MutationObserver(() => { clearTimeout(idle); idle = setTimeout(() => finish('quiet'), qm) })
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true })
    const hard = setTimeout(() => finish('timeout'), tm)
    idle = setTimeout(() => finish('quiet'), qm)
  }), [quietMs, timeoutMs])
}

/**
 * 等 /messages 详情态收敛到**终态**（几何尺子的确定性前提之补强）。
 * 为什么 waitQuiet 不够：消息流取数在飞时，DOM 停在「loading」态（只有 `messages-thread-status` 一个 <p>），
 * **没有变更 ⇒ mutation-quiet 会提前返回**，随后一侧取数已落地（`messages-thread`+气泡）、另一侧仍停在
 * loading/error ⇒ 日/夜 hash 仍不同（实测 waitQuiet-only 复现 5/24）。故必须等**显式终态**：
 *   ① 消息流渲染完成（`[data-sf-m="messages-thread"]` 出现）或落到**真错误态**（`data-sf-phase="error"`）；
 *   ② 未读角标落地：进详情推进读水位 ⇒ unread_total 归零 ⇒ `tabbar/floatmenu-unread-badge` 被移除
 *      （等它消失 ⇒ 与主题无关的 badge 竞态收敛）。
 * 返回 `{ ok, phase, badgeAbsent }`；`ok=false && phase==='error'` 时调用方**有界重载**（不改判据）。
 */
export async function waitMessagesStable(page, { timeoutMs = 12000, badgeTimeoutMs = 8000 } = {}) {
  const S = '[data-sf-m="messages-thread"]'
  const ST = '[data-sf-m="messages-thread-status"]'
  await page.waitForFunction(([s, st]) => {
    if (document.querySelector(s)) return true
    const e = document.querySelector(st)
    return Boolean(e && e.getAttribute('data-sf-phase') === 'error')
  }, [S, ST], { timeout: timeoutMs, polling: 200 }).catch(() => {})
  const state = await page.evaluate(([s, st]) => {
    if (document.querySelector(s)) return { ok: true, phase: 'ok' }
    const e = document.querySelector(st)
    return { ok: false, phase: e ? e.getAttribute('data-sf-phase') : '(absent)' }
  }, [S, ST])
  const badgeAbsent = await page.waitForFunction(() => !document.querySelector('[data-sf-m="tabbar-unread-badge"]') && !document.querySelector('[data-sf-m="floatmenu-unread-badge"]'), { timeout: badgeTimeoutMs, polling: 150 }).then(() => true).catch(() => false)
  await waitQuiet(page, { quietMs: 500 })
  return { ...state, badgeAbsent }
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

/**
 * 页面内：可见元素几何快照，**排除「主题开关 Sun/Moon 图标子树」**。
 * ★ 口径对齐（2026-10-12 · Kong，防后人再踩）：
 *   `src/test/unit/theme-shell-isomorphism.test.jsx:35-56,185-187` 是项目既有的「主题同构」判据 ——
 *   它把主题开关按钮内部的 Sun/Moon 图标子树**显式排除**出结构签名，并另有一条断言证明
 *   「全局元素数差 == 该子树元素数差」（即差异确实被局限在这棵子树内）。
 *   ⇒ 本探针的日/夜几何 hash 必须排除**同一**子树，否则尺子口径与项目既有定义不同，会把
 *     一个既有的、已被显式批准的主题图标差异误判成判负（实测 rawEq=false / noIconEq=true）。
 * ★ 选择器差异：单元测试里 i18n 被 mock（`t: (k)=>k`）⇒ 那边写 `button[aria-label="darkMode"]`；
 *   但**真实 DOM 里 aria-label 是译文**（zh=深夜模式 / en=Dark Mode …）⇒ 该选择器在真页命中 0 个。
 *   故此处改用 lucide 图标类名定位：`svg.lucide-sun` / `svg.lucide-moon` 的最近 button（= owner），
 *   排除 owner 的整棵子树（口径等价于测试里的 `el.closest(THEME_ICON_OWNER)`）。
 */
export const VISIBLE_SNAPSHOT_NO_THEME_ICON = `(() => {
  const out = []
  const owners = Array.from(document.querySelectorAll('svg.lucide-sun, svg.lucide-moon'))
    .map((s) => s.closest('button') || s)
  const inThemeIcon = (el) => owners.some((o) => o === el || o.contains(el))
  const all = document.querySelectorAll('body *')
  for (const el of all) {
    if (inThemeIcon(el)) continue
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
