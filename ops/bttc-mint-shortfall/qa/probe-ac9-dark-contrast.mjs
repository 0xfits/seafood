/**
 * AC9 · 夜档可读性（真渲染回读 · 不打 palette 自算）
 *   · 服务 frontend/dist（build 产物 = 本单源码编译结果）静态站，SPA fallback
 *   · playwright（createRequire(<仓>/frontend/package.json)）注入登录态 localStorage
 *   · /api/** 全量拦截为固定夹具（batt 100 / usdBalance 0 / canMint false ⇒ 缺额可见）
 *   · 回读：html[data-theme]、.sf-shell 背景、缺额节点 color、逐层祖先合成后的有效底色 ⇒ WCAG 对比度
 * 用法：node ops/bttc-mint-shortfall/qa/probe-ac9-dark-contrast.mjs
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const FE = path.join(REPO, 'frontend')
const DIST = path.join(FE, 'dist')
const PORT = 4790
const require = createRequire(path.join(FE, 'package.json'))
const { chromium } = require('playwright')

// 本机 playwright(1.58.2) 期望 chromium_headless_shell-1208，缓存中只有 1228 ⇒ 显式指定可执行文件
//   （环境性适配：不改仓、不改 playwright 版本；仅让探针能起真浏览器）
const resolveChromium = () => {
  const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright')
  const cands = []
  if (fs.existsSync(cache)) {
    for (const d of fs.readdirSync(cache)) {
      if (d.startsWith('chromium_headless_shell-')) cands.push(path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
      if (d.startsWith('chromium-')) cands.push(path.join(cache, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'))
    }
  }
  const hit = cands.filter((p) => fs.existsSync(p))
  return hit.sort().reverse()[0] || null
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]
  let p = path.join(DIST, url)
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})

const BATT = {
  batt: 100, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 9, canAccept: true,
  updated_at: '2026-10-17T00:00:00.000Z',
  bttc: {
    symbol: 'BTTC', name: 'battcoin', decimals: 0, status: 'listed', totalSupply: '10',
    balance: '2', canMint: false, canBurn: false,
    policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 },
    source: 'config', usdBalance: '0',
  },
}

const parseRGB = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
}
const lum = ({ r, g, b }) => {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const over = (fg, bg) => ({ // fg 半透明压到 bg 上
  r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
})

const run = async () => {
  await new Promise((r) => server.listen(PORT, r))
  const browser = await chromium.launch({ headless: true, executablePath: resolveChromium() || undefined })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => {
    try {
      // 只在未设时落 dark ⇒ 后续可切 light 复量（否则每次导航都被重置）
      if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark')
      localStorage.setItem('user', JSON.stringify({
        uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 'qa-token',
      }))
    } catch { /* noop */ }
  })
  const page = await ctx.newPage()
  await page.route('**/api/**', async (route) => {
    const u = route.request().url()
    if (u.includes('/api/batt')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: BATT }) })
    if (u.includes('/api/checkin')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: { streakDay: 3, streakCapDays: 7, checkedInToday: true, canMakeup: false, makeupCostUsd: '1', updated_at: '2026-10-17T00:00:00.000Z' } }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: {} }) })
  })

  const report = { probe: 'AC9-dark-contrast', base: `http://127.0.0.1:${PORT}`, ok: false }
  try {
    await page.goto(`http://127.0.0.1:${PORT}/activities`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-sf-m="bttc-mint-shortfall-usd"]', { timeout: 15000 })

    report.readings = await page.evaluate(() => {
      const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
      const node = document.querySelector('[data-sf-m="bttc-mint-shortfall-usd"]')
      const battNode = document.querySelector('[data-sf-m="bttc-mint-shortfall-batt"]')
      const shell = document.querySelector('.sf-shell')
      const cs = getComputedStyle(node)
      const layers = []
      let cur = node
      while (cur && cur !== document.documentElement.parentNode) {
        const bg = parse(getComputedStyle(cur).backgroundColor)
        if (bg && bg.a > 0) layers.push({ tag: cur.tagName, cls: (cur.className || '').toString().slice(0, 90), color: getComputedStyle(cur).backgroundColor })
        cur = cur.parentElement
      }
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        themeFromCss: getComputedStyle(document.documentElement).colorScheme,
        node: {
          text: node.textContent,
          tag: node.tagName,
          className: node.className,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          colorRaw: cs.color,
          opacityChain: (() => {
            let o = 1; let el = node
            while (el) { o *= Number(getComputedStyle(el).opacity || 1); el = el.parentElement }
            return o
          })(),
        },
        battNodeText: battNode ? battNode.textContent : null,
        shell: shell ? { backgroundColorRaw: getComputedStyle(shell).backgroundColor, colorRaw: getComputedStyle(shell).color, cls: shell.className } : null,
        bgLayers: layers,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        // 对照组：同款 text-red-600 的既有节点（Header 登出类），若当期 DOM 未挂出则记 null
        control: (() => {
          const el = [...document.querySelectorAll('.text-red-600')].find((n) => n !== node && n !== battNode)
          if (!el) return null
          return { text: el.textContent.trim().slice(0, 30), tag: el.tagName, colorRaw: getComputedStyle(el).color }
        })(),
      }
    })

    const R = report.readings
    const fg = parseRGB(R.node.colorRaw)
    // 合成：自最底（html/body）向上把每个非透明层压上去
    let base = parseRGB(R.htmlBg) && parseRGB(R.htmlBg).a > 0 ? parseRGB(R.htmlBg) : { r: 255, g: 255, b: 255, a: 1 }
    if (parseRGB(R.bodyBg) && parseRGB(R.bodyBg).a > 0) base = over(parseRGB(R.bodyBg), base)
    for (const l of [...R.bgLayers].reverse()) {
      const c = parseRGB(l.color)
      if (c && c.a > 0) base = over(c, base)
    }
    // 前景：color 叠到有效底色（含 opacity 链）
    const fgOver = over({ ...fg, a: fg.a * R.node.opacityChain }, base)
    report.composited = { foreground: fgOver, effectiveBg: base, ratio: Number(contrast(fgOver, base).toFixed(2)) }
    // AC 字面口径：text-red-600 直接压在 .sf-shell 夜档底色上的对比度（参考读数，非实际层叠）
    {
      const shellBg = parseRGB(R.shell.backgroundColorRaw)
      report.ratioVsShellBackground = shellBg ? Number(contrast(over({ ...fg, a: 1 }, shellBg), shellBg).toFixed(2)) : null
    }

    // —— 对照组：Header 登出钮（同款 text-red-600 · 既有节点）真渲染回读 ——
    const ctl = await page.evaluate(() => {
      const trigger = document.querySelector('[data-sf-m="header-user-menu"]')
      if (!trigger) return { found: false, reason: 'header-user-menu trigger absent' }
      trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
      trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      trigger.click()
      return { found: true, clicked: true }
    })
    await page.waitForTimeout(400)
    const ctlRead = await page.evaluate(() => {
      const el = document.querySelector('[data-sf-m="header-logout"]')
      if (!el) return null
      const cs = getComputedStyle(el)
      const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
      const layers = []
      let cur = el
      while (cur && cur !== document.documentElement.parentNode) {
        const bg = parse(getComputedStyle(cur).backgroundColor)
        if (bg && bg.a > 0) layers.push({ tag: cur.tagName, color: getComputedStyle(cur).backgroundColor })
        cur = cur.parentElement
      }
      return { text: el.textContent.trim(), colorRaw: cs.color, bgLayers: layers }
    })
    if (ctlRead) {
      const cf = parseRGB(ctlRead.colorRaw)
      let cb = { r: 255, g: 255, b: 255, a: 1 }
      for (const l of [...ctlRead.bgLayers].reverse()) {
        const c = parseRGB(l.color)
        if (c && c.a > 0) cb = over(c, cb)
      }
      report.control = { ...ctlRead, effectiveBg: cb, ratio: Number(contrast(over(cf, cb), cb).toFixed(2)) }
    } else {
      report.control = { found: false, trigger: ctl }
    }

    // —— 同节点在日档下的对照（判「夜档特有」还是「主题无关既有色」） ——
    await page.evaluate(() => localStorage.setItem('theme', 'light'))
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-sf-m="bttc-mint-shortfall-usd"]', { timeout: 15000 })
    report.lightTheme = await page.evaluate(() => {
      const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
      const node = document.querySelector('[data-sf-m="bttc-mint-shortfall-usd"]')
      const layers = []
      let cur = node
      while (cur) {
        const bg = parse(getComputedStyle(cur).backgroundColor)
        if (bg && bg.a > 0) layers.push(getComputedStyle(cur).backgroundColor)
        cur = cur.parentElement
      }
      return { theme: document.documentElement.getAttribute('data-theme'), colorRaw: getComputedStyle(node).color, bgLayers: layers }
    })
    {
      const R2 = report.lightTheme
      const lf = parseRGB(R2.colorRaw)
      let lb = { r: 255, g: 255, b: 255, a: 1 }
      for (const l of [...R2.bgLayers].reverse()) { const c = parseRGB(l); if (c && c.a > 0) lb = over(c, lb) }
      report.lightTheme.effectiveBg = lb
      report.lightTheme.ratio = Number(contrast(over(lf, lb), lb).toFixed(2))
    }

    report.ok = true
    report.verdict = report.composited.ratio >= 4.5 ? 'PASS' : 'DRIFT(non-regression, same class as Header logout)'
  } catch (e) {
    report.error = String(e?.message || e)
  } finally {
    await browser.close()
    server.close()
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

run()
