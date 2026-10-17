/**
 * Neng（质检员）独立质检共用夹具 —— 本仓「首页商品卡片 UI 改造」v1.20 §22
 * 单号：NENG-QA-CARDUI-DS-A（承 JING-SPEC-CARDUI-DS / -DS-B + KONG 实现单）
 *
 * 纪律（逐条）：
 *   · 零服务 / 零端口 / 零后端 / 零库写：`context.route` 把 `http://sf.local/**` 映射到磁盘 dist；
 *     参考图 `ops/ui-card-ref-20261017/shots/ref-xianyu.png` **只读、不触碰**（`serverReadOnly` 只白名单 dist）。
 *   · 探针 = 质检方自写自跑；**不采信实现方读数**（kong-* 只作对照，不作证据）。
 *   · 禁动画：`reducedMotion:'reduce'` + 注入 `animation:none!important;transition:none!important` + rAF 稳态窗。
 *   · 只采可见元素：`el.getClientRects().length > 0`。
 *   · 结构键 = `tag + 全 class + 同名序号`；**坐标从不进键**（坐标只在「值」里参与比对）。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

export const REPO = '/Users/kevin/bistro/seafood'
export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const ORIGIN = 'http://sf.local'
export const HOSTNAME = 'sf.local'
export const CUR_DIST = path.join(REPO, 'frontend/dist')
export const PARENT_DIST = '/Users/kevin/.hermes/profiles/zang/cache/scratch/neng-ac5/parent/frontend/dist'

export const require_ = createRequire(path.join(REPO, 'frontend/package.json'))
export const { chromium } = require_('playwright')

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// ---- 夹具：**真实感商品文案**（Kevin 目视用；不用 FIXTURE / 探针夹具 一类占位字） ----------------
export const PRIZES = [
  { bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%，原装盒充电线齐全', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆', points: 6600, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: '自用一年 MacBook Air M2 13 英寸 星空色', description: '循环次数 88 次，附原装 35W 双口充电器', points: 3200, stores_count: 0, claims_count: 0, time_end: '2026-12-31' },
  { bID: 4, name: '宜家 BEKANT 电动升降桌 160x80 白面', description: '无划痕，自提优先，可代叫货拉拉', points: 1200, stores_count: 2, claims_count: 4 },
  { bID: 5, name: '索尼 WH-1000XM5 头戴式降噪耳机', description: '耳罩无脱皮，附收纳包与 3.5mm 线', points: 900, stores_count: 1, claims_count: 1 },
  { bID: 6, name: '捷安特 ATX860 山地车 27.5 寸 21 速', description: '去年买的，骑行不到 300 公里，保养过', points: 2600, stores_count: 1, claims_count: 0 },
]

export const TASKS = [
  { tID: 1, title: '招募：周末市集摊位布展协助', note: '六日两天 10:00-16:00', is_open: true, points: 10, participants_count: 3 },
  { tID: 2, title: '代取快递并配送至驿站', note: '两小时内完成', is_open: true, points: 5, participants_count: 1 },
]

export const apiResponse = (method, pathname) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/home') return data({ tasks: TASKS, prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  if (pathname.startsWith('/api/task/all')) return data(TASKS)
  if (pathname.startsWith('/api/prize/all')) return data(PRIZES)
  if (pathname === '/api/prize-item') return data([])
  if (pathname === '/api/prize/1') return data(PRIZES[0])
  if (pathname.startsWith('/api/prize/')) return data(PRIZES.find((p) => String(p.bID) === pathname.split('/').pop()) || null)
  if (pathname === '/api/messages/unread-count') return data({ unread_total: 0 })
  if (pathname === '/api/messages') return data({ threads: [], next_cursor: null, total: 0 })
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

/** 造一个 context + page，并把 sf.local 映射到 dist（只读磁盘） */
export async function open(browser, { theme, viewport, dist = CUR_DIST, locale = 'zh-CN' } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: locale || 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== HOSTNAME) return route.abort()
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    }
    const rel = decodeURIComponent(u.pathname)
    let file = path.join(dist, rel)
    // 只允许读 dist 内的文件（防越界读参考图等）
    if (!path.resolve(file).startsWith(path.resolve(dist))) return route.fulfill({ status: 403, body: '' })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(dist, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  return { context, page }
}

/** 禁动画 + rAF 稳态窗（≥2–3 帧） */
export async function settle(page, max = 90) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(`(()=>{const r=document.getElementById('root');return (r?r.innerHTML.length:0)+'|'+document.querySelectorAll('*').length})()`)
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

export async function goto(page, url, { waitSel = null, timeout = 12000 } = {}) {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (waitSel) {
    try { await page.waitForSelector(waitSel, { timeout }) } catch (e) { /* 由调用方记录 */ }
  }
  await settle(page)
}

export const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
export const sha256s = (s) => crypto.createHash('sha256').update(s).digest('hex')

export function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2))
  return p
}

// ---------------------------------------------------------------------------
// 归因式「不动面」采集器（AC-5）：只采**可见**元素；键 = tag + 全 class + 同名序号；**坐标不进键**
// ---------------------------------------------------------------------------
export const COLLECT = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  // ★ 注意：getComputedStyle(el).getPropertyValue('backgroundColor') 恒返回 ''（CSS 名是 kebab-case）
  //   ⇒ 取计算值必须用 camelCase 直接成员访问；本探针曾因此得到「颜色面恒 0 差异」的死尺子（已自证并修正）。
  const STYLE_PROPS = ['backgroundColor','color','borderTopColor','borderLeftColor','borderTopWidth','borderLeftWidth','boxShadow','outlineColor','filter','opacity']
  const out = []
  const all = document.querySelectorAll('body *')
  const seq = new Map()
  for (const el of all) {
    if (el.getClientRects().length === 0) continue            // 只采可见元素
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '')
    const base = el.tagName + '#' + cls
    const n = (seq.get(base) || 0); seq.set(base, n + 1)
    const key = base + '~' + n
    const r = el.getBoundingClientRect()
    const attrs = {}
    for (const a of el.attributes) {
      if (a.name === 'style' || a.name === 'class' || a.name === 'd') continue
      attrs[a.name] = a.value
    }
    const style = {}
    for (const p of STYLE_PROPS) style[p] = cs[p]                // ★ camelCase 直接访问
    out.push({
      key, tag: el.tagName, cls,
      attrs,
      rect: [round(r.x), round(r.y), round(r.width), round(r.height)],
      style,
      text: (el.children.length === 0 ? (el.textContent || '').trim().slice(0, 80) : ''),
    })
  }
  return {
    pathname: location.pathname,
    theme: document.documentElement.getAttribute('data-theme'),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    visibleCount: out.length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
    elements: out,
  }
})()`

/** 声明式归一化：剔除 alt / title 两个属性的「值」（属性在场仍计）—— 噪声源 = Footer.jsx:12 模块加载期 Math.random() */
export function normalize(snap) {
  return {
    ...snap,
    elements: snap.elements.map((e) => {
      const attrs = { ...e.attrs }
      if ('alt' in attrs) attrs.alt = '<NORMALIZED>'
      if ('title' in attrs) attrs.title = '<NORMALIZED>'
      return { ...e, attrs }
    }),
  }
}

const COLOR_FIELDS = new Set(['backgroundColor', 'color', 'borderTopColor', 'borderLeftColor', 'boxShadow', 'outlineColor'])
const GEOM_FIELDS = new Set(['rect'])

/** 逐元素差异集：返回 { diffKeys, geometry, color, structure, textDiff, onlyA, onlyB, details } */
export function diffSnaps(a, b) {
  const mapA = new Map(a.elements.map((e) => [e.key, e]))
  const mapB = new Map(b.elements.map((e) => [e.key, e]))
  const onlyA = [...mapA.keys()].filter((k) => !mapB.has(k))
  const onlyB = [...mapB.keys()].filter((k) => !mapA.has(k))
  const geometry = []; const color = []; const structure = []; const textDiff = []
  const details = []
  for (const [k, ea] of mapA) {
    const eb = mapB.get(k)
    if (!eb) continue
    const fields = []
    if (JSON.stringify(ea.rect) !== JSON.stringify(eb.rect)) { fields.push('rect'); geometry.push(k) }
    for (const p of Object.keys(ea.style)) {
      if (ea.style[p] !== eb.style[p]) { fields.push('style.' + p); color.push(k) }
    }
    if (JSON.stringify(ea.attrs) !== JSON.stringify(eb.attrs)) { fields.push('attrs'); structure.push(k) }
    if (ea.text !== eb.text) { fields.push('text'); textDiff.push(k) }
    if (fields.length) details.push({ key: k, fields, a: { rect: ea.rect, style: ea.style, attrs: ea.attrs, text: ea.text }, b: { rect: eb.rect, style: eb.style, attrs: eb.attrs, text: eb.text } })
  }
  const diffKeys = [...new Set([...onlyA, ...onlyB, ...details.map((d) => d.key)])]
  return { diffKeys, diffCount: diffKeys.length, geometry: [...new Set(geometry)], color: [...new Set(color)], structure: [...new Set(structure)], textDiff: [...new Set(textDiff)], onlyA, onlyB, details }
}

// ---------------------------------------------------------------------------
// WCAG 2.x 对比度
// ---------------------------------------------------------------------------
export const luminance = (rgbStr) => {
  const m = String(rgbStr).match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
  const [r, g, b] = parts
  const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (fg, bg) => {
  const l1 = luminance(fg); const l2 = luminance(bg)
  if (l1 == null || l2 == null) return null
  const hi = Math.max(l1, l2); const lo = Math.min(l1, l2)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 1000) / 1000
}
export const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`
}
