/**
 * Neng 独立质检探针 ③ · 溢出尺子诊断 + 修饰键/中键（按 page 对象同一性）· v119 消息面板化
 * 用法：QA_DIST=<dist> node probe-diagnostics-qa3.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/v119-msg-panel/qa/diagnostics-qa.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }
const apiResponse = (pathname) => {
  if (pathname === '/api/messages/unread-count') return { success: true, data: { unread_total: 250 } }
  return { success: true, data: [] }
}
async function settle(page, max = 80) {
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
async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa' }))
    localStorage.setItem('token', 'qa-token')
  })
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(u.pathname)) })
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  const out = { probe: 'probe-diagnostics-qa3.mjs (Neng 独立质检 · 自写)', startedAt: new Date().toISOString() }
  const goto = async (url) => { await page.goto(ORIGIN + url, { waitUntil: 'load' }); await settle(page) }

  // ---- 溢出尺子诊断 ----
  await goto('/exchange')
  out.overflowDiagnosis = await page.evaluate(`(() => {
    const read = (tag) => ({ tag, docScrollWidth: document.documentElement.scrollWidth, docClientWidth: document.documentElement.clientWidth, bodyScrollWidth: document.body.scrollWidth, htmlOverflowX: getComputedStyle(document.documentElement).overflowX, bodyOverflowX: getComputedStyle(document.body).overflowX })
    const res = [read('baseline')]
    const el = document.querySelector('.sf-route-container')
    // ① 行内 style + !important
    el.style.setProperty('width', '3000px', 'important')
    const rect = el.getBoundingClientRect()
    res.push({ ...read('sf-route-container width=3000px !important'), elWidth: rect.width })
    el.style.removeProperty('width')
    // ② 行内 style + !important（main 自身）
    const main = document.getElementById('sf-route-container')
    main.style.setProperty('width', '3000px', 'important')
    res.push({ ...read('main#sf-route-container width=3000px !important'), mainWidth: main.getBoundingClientRect().width })
    main.style.removeProperty('width')
    // ③ 追加一个 static 定位、3000px 宽的 div 到 body
    const d = document.createElement('div'); d.style.cssText = 'width:3000px;height:10px;background:red'; document.body.appendChild(d)
    res.push({ ...read('appended static div width=3000px'), divWidth: d.getBoundingClientRect().width })
    d.remove()
    return res
  })()`)

  // ---- 修饰键 / 中键：按 page 对象同一性 ----
  const popup = async (mods, button) => {
    await goto('/exchange')
    const beforePages = context.pages().slice()
    let err = null
    try {
      if (button && button !== 'left') await page.click('[data-sf-fm="messages"]', { button, timeout: 5000 })
      else await page.click('[data-sf-fm="messages"]', { modifiers: mods || [], timeout: 5000 })
    } catch (e) { err = String(e.message).slice(0, 120) }
    await page.waitForTimeout(2000)
    const afterPages = context.pages().slice()
    const created = afterPages.filter((p) => !beforePages.includes(p))
    const createdUrls = []
    for (const p of created) { createdUrls.push({ url: p.url(), closed: p.isClosed() }) }
    const main = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, panel: !!document.querySelector('.sf-mp'), history: history.length }))
    for (const p of created) { try { await p.close() } catch (e) {} }
    return { modifiers: mods || null, button: button || 'left', clickError: err, newPageObjects: created.length, newPageUrls: createdUrls, mainPathname: main.pathname, mainSearch: main.search, mainPanelPresent: main.panel, mainHistoryLength: main.history }
  }
  out.popup_plain = await popup(null, 'left')
  out.popup_ctrl = await popup(['Control'])
  out.popup_meta = await popup(['Meta'])
  out.popup_middle = await popup(null, 'middle')

  out.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('WROTE', OUT)
  await browser.close()
}
main().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
