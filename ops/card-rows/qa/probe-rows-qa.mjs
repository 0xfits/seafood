// 商品卡四行结构 —— 独立质检探针（Zang · 2026-10-19）
// ============================================================================
// 与实现方 `ops/card-rows/probe-card-rows.mjs` **无共享代码**（仅同用 playwright + 夹具思路）：
//   · 取数方式 = `context.route` 把 `http://cardqa.local/**` 映射到磁盘 `frontend/dist`（零 dev server、
//     零后端、零库写；API 全在内存自截）⇒ 读数只反映 **HEAD 构建产物**，不受 dev 实例/数据漂移影响。
//   · 夹具 5 张卡：短标题 / 24 汉字（恰 48 单位，不截）/ 25 汉字（截 24 + `...`）/ 60 拉丁 /
//     无图（image-container 仍在）。
//   · 每卡逐条断言（卡高 392 / 四行 48·32·24·48 / 图 240 且宽 = 卡内宽 / 标题截断 /
//     价格行 `$` 在 span 内 + 数字 + `n人想要` 单行 / 移除面 0 / 保留面在场）⇒ JSON 落盘。
//   · **判负自证臂**：注入 `.row3-wrap-price{height:25px}` 后重测 ⇒ 判据必须变红；移除注入后回绿。
//
// 运行：node ops/card-rows/qa/probe-rows-qa.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const DIST = path.join(REPO, 'frontend/dist')
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://cardqa.local'
const OUT = path.join(HERE, 'readings/rows-qa.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.mkdirSync(path.join(HERE, 'logs'), { recursive: true })

// ---- 纯 stdlib 迷你 PNG（给「有图」卡用极宽/极窄两种比例验 cover 居中裁切） ----
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c } return t })()
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]) }
const solidPng = (w, h, [r, g, b]) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { const off = y * (w * 3 + 1); raw[off] = 0; for (let x = 0; x < w; x++) { raw[off + 1 + x * 3] = r; raw[off + 2 + x * 3] = g; raw[off + 3 + x * 3] = b } }
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  return `data:image/png;base64,${png.toString('base64')}`
}

const HAN24 = '汉'.repeat(24)
const HAN25 = '汉'.repeat(25)
const LATIN60 = 'Ultra long product title fixture for truncation test 0123456789'
const DESC = '夹具描述：这一行在四行结构下不应渲染（描述行移除面）'

const WIDE_IMG = solidPng(90, 30, [200, 60, 50])
const TALL_IMG = solidPng(30, 90, [50, 80, 200])

const FIXTURES = [
  { bID: 9101, name: '短标题', points: 495, wants: 20, stores_count: 2, media_urls: [WIDE_IMG], description: DESC, time_end: '2030-01-01T00:00:00Z', seller: { uid: 1, nickname: '0xaaaa******a1b2', avatar: null, credit: 'excellent' } },
  { bID: 9102, name: HAN24, points: 12, wants: 0, stores_count: 2, media_urls: [], description: DESC, time_end: '2030-01-01T00:00:00Z', seller: { uid: 2, nickname: '0xbbbb******c3d4', avatar: null, credit: 'good' } },
  { bID: 9103, name: HAN25, points: 8888, wants: 1234, stores_count: 2, media_urls: [TALL_IMG], description: DESC, time_end: '2030-01-01T00:00:00Z', seller: { uid: 3, nickname: '0xcccc******e5f6', avatar: null, credit: 'new' } },
  { bID: 9104, name: LATIN60, points: 7, wants: 3, stores_count: 2, media_urls: [], description: DESC, time_end: '2030-01-01T00:00:00Z', seller: { uid: 4, nickname: '0xdddd******a7b8', avatar: null, credit: 'normal' } },
  { bID: 9105, name: '无图卡', points: 1, wants: 0, stores_count: 0, media_urls: [], description: DESC, time_end: '2030-01-01T00:00:00Z', seller: { uid: 5, nickname: '0xeeee******c9d0', avatar: null, credit: 'new' } },
]

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }

const log = (...a) => { const line = a.join(' '); console.log(line); fs.appendFileSync(path.join(HERE, 'logs/probe-rows-qa.log'), line + '\n') }

const apiPayload = (url) => {
  const p = new URL(url).pathname
  if (p === '/api/prize/all') return { success: true, data: FIXTURES }
  if (p === '/api/home') return { success: true, data: { tasks: [], prizes: FIXTURES, user_points: 0, claimed_prize_ids: [] } }
  if (p === '/api/task/all') return { success: true, data: [] }
  return { success: true, data: [] }
}

async function makeContext(browser, width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', locale: 'zh-CN' })
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t) } catch (e) {} }, theme)
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiPayload(req.url())) })
    }
    let rel = u.pathname === '/' ? '/index.html' : u.pathname
    let file = path.join(DIST, rel)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html') // SPA fallback
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  return ctx
}

// 页面内测量（单卡逐条判据返回 {id, pass, actual, expected}）
const MEASURE = () => {
  const R = (v) => Math.round(v * 100) / 100
  const out = { cards: [], page: {} }
  const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
  out.page.cardCount = cards.length
  const se = document.scrollingElement
  out.page.hOverflow = R(se.scrollWidth - se.clientWidth)
  out.page.gridCols = (() => {
    const g = document.querySelector('.sf-feed, .sf-grid')
    return g ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : null
  })()
  out.page.theme = document.documentElement.getAttribute('data-theme')

  for (const root of cards) {
    const ck = []
    // ac: 'AC1'..'AC5' = 派单列明的判据；'SPEC' = 契约 §26.11.1 附加条款（不计入 AC verdict，单列 finding）
    const add = (id, pass, actual, expected, ac = 'AC1') => ck.push({ id, ac, pass: !!pass, actual, expected })
    const inner = root.querySelector('.sf-reward-inner')
    const imgBox = root.querySelector('.image-container')
    const img = imgBox?.querySelector('img') || null
    const content = root.querySelector('.content')
    const title = root.querySelector('.row1-wrap-title')
    const service = root.querySelector('.row2-wrap-service')
    const price = root.querySelector('.row3-wrap-price')
    const seller = root.querySelector('.row4-wrap-seller')
    const wantsEl = root.querySelector('[data-sf-m="reward-card-wants"]')
    const curEl = root.querySelector('.sf-reward-price-cur')
    const numEl = root.querySelector('.sf-reward-price-num')

    const rect = (el) => (el ? el.getBoundingClientRect() : null)
    const rr = rect(root); const ri = rect(inner); const rb = rect(imgBox); const rc = rect(content)
    const rt = rect(title); const rs = rect(service); const rp = rect(price); const rsel = rect(seller)

    const bID = Number(root.querySelector('[data-sf-m="reward-card-title"]') ? root.getAttribute('data-qa-bid') || 0 : 0)
    const fx = (window.__FIXTURES__ || []).find((f) => f.bID === bID) || null

    // 几何
    add('card.h392', rr && Math.abs(rr.height - 392) < 0.5, rr && R(rr.height), 392)
    add('inner.h392', ri && Math.abs(ri.height - 392) < 0.5, ri && R(ri.height), 392)
    add('content.h152', rc && Math.abs(rc.height - 152) < 0.5, rc && R(rc.height), 152, 'SPEC')
    add('image.h240', rb && Math.abs(rb.height - 240) < 0.5, rb && R(rb.height), 240)
    add('image.width=inner', rb && ri && Math.abs(rb.width - inner.clientWidth) < 0.5, rb && { imgW: R(rb.width), innerClientW: inner.clientWidth }, 'img 宽 = 卡内宽')
    add('image.objectFitCover', img ? getComputedStyle(img).objectFit === 'cover' && getComputedStyle(img).objectPosition.replace(/\s+/g, ' ').trim().startsWith('50% 50%') : rb !== null, img ? { fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition } : 'no-img(container only)', 'cover + center（无图则容器在）')
    add('row1.h48', rt && Math.abs(rt.height - 48) < 0.5, rt && R(rt.height), 48)
    add('row2.h32', rs && Math.abs(rs.height - 32) < 0.5, rs && R(rs.height), 32)
    add('row3.h24', rp && Math.abs(rp.height - 24) < 0.5, rp && R(rp.height), 24)
    add('row2.emptyPlaceholder', !!service && (service.textContent || '').trim() === '', service && (service.textContent || '').trim(), '空占位（无文本）', 'AC1')
    add('row4.h48', rsel && Math.abs(rsel.height - 48) < 0.5, rsel && R(rsel.height), 48)
    add('content.childCount=4', content && content.children.length === 4, content && content.children.length, 4)
    add('rows.stackSum=152', rt && rs && rp && rsel && Math.abs((rt.height + rs.height + rp.height + rsel.height) - 152) < 0.5, rt && R(rt.height + rs.height + rp.height + rsel.height), 152)
    add('rows.width=inner', rt && Math.abs(rt.width - inner.clientWidth) < 0.5, rt && { rowW: R(rt.width), innerClientW: inner.clientWidth }, '行宽 = 卡内宽')
    add('no.hOverflow.card', root.scrollWidth <= root.clientWidth + 1, { scrollW: root.scrollWidth, clientW: root.clientWidth }, 'scrollWidth <= clientWidth')
    add('no.vOverflow.content', content.scrollHeight <= content.clientHeight + 1, { scrollH: content.scrollHeight, clientH: content.clientHeight }, 'content 不纵向溢出', 'SPEC')

    // 盒模型诊断（不判负，仅取数：卡体边框是否吃掉 2px 内容盒）
    out.__boxDiag = out.__boxDiag || []
    out.__boxDiag.push({
      bID,
      cardRectH: rr && R(rr.height),
      innerClientH: inner.clientHeight,
      innerOffsetH: inner.offsetHeight,
      innerBorderTop: getComputedStyle(inner).borderTopWidth,
      innerBorderBottom: getComputedStyle(inner).borderBottomWidth,
      innerBoxSizing: getComputedStyle(inner).boxSizing,
      contentRectH: rc && R(rc.height),
      sellerBottom: rsel && R(rsel.bottom),
      innerBottom: ri && R(ri.bottom),
      sellerClippedPx: rsel && ri ? R(Math.max(0, rsel.bottom - ri.bottom)) : null,
    })

    // 标题
    const tText = (title?.textContent || '').replace(/\s+/g, ' ').trim()
    const fxTitle = fx ? fx.name : null
    // 期望值 = 契约唯一读法：≤48 单位 ⇒ 原文逐字；>48 ⇒ 前缀（逐字累积至 ≤48 单位）+ 字面 `...`
    const expectText = (src) => {
      if (src == null) return null
      const w = (s) => { let n = 0; for (const ch of s) n += (ch.codePointAt(0) >= 0x1100 ? 2 : 1); return n }
      if (w(src) <= 48) return src
      let used = 0, outText = ''
      for (const ch of src) { const u = (ch.codePointAt(0) >= 0x1100 ? 2 : 1); if (used + u > 48) break; outText += ch; used += u }
      return outText + '...'
    }
    const expectedTitle = expectText(fxTitle)
    add('title.textExact', expectedTitle == null ? true : tText === expectedTitle, { got: tText, expected: expectedTitle, gotLen: [...tText].length, expLen: expectedTitle ? [...expectedTitle].length : null }, '逐字相等（≤48 全等 / >48 前缀+`...`）', 'AC2')
    const disp = (s) => { let n = 0; for (const ch of s) n += (ch.codePointAt(0) >= 0x1100 ? 2 : 1); return n }
    add('title.width<=51', disp(tText) <= 51, disp(tText), '<= 48 + 3 (`...`)', 'AC2')
    const overLimit = fx ? (() => { let n = 0; for (const ch of fx.name) n += (ch.codePointAt(0) >= 0x1100 ? 2 : 1); return n > 48 })() : false
    add('title.endsWithLiteralDots', overLimit ? tText.endsWith('...') : !tText.endsWith('...'), { text: tText.slice(-8), overLimit }, '超限卡结尾恰为 `...` / 未超限卡不加点', 'AC2')
    add('title.noU2026', !tText.includes('\u2026'), tText.includes('\u2026'), '不含 `…`', 'AC2')
    add('title.noDoubleEllipsis', !tText.endsWith('....'), tText.slice(-6), '非双尾', 'AC2')
    add('title.within48Height', title ? title.scrollHeight <= 48 + 1 : false, title && { scrollH: title.scrollHeight, clientH: title.clientHeight }, 'scrollHeight <= 48（两行内）', 'AC2')
    // 末尾 `...` 可见（不被 overflow 裁掉）：把最后 3 个字符的 Range 盒与行盒比
    let dotsVisible = null
    if (title) {
      const node = [...title.childNodes].find((n) => n.nodeType === 3 && /\.\.\.$/.test(n.textContent))
      if (node) {
        const rg = document.createRange()
        rg.setStart(node, node.textContent.length - 3)
        rg.setEnd(node, node.textContent.length)
        const dr = rg.getBoundingClientRect()
        const tr = title.getBoundingClientRect()
        dotsVisible = { dotsRect: { top: R(dr.top), bottom: R(dr.bottom), left: R(dr.left), right: R(dr.right), h: R(dr.height), w: R(dr.width) }, rowRect: { top: R(tr.top), bottom: R(tr.bottom), left: R(tr.left), right: R(tr.right) } }
        add('title.dotsVisible', dr.height > 0 && dr.bottom <= tr.bottom + 0.5 && dr.right <= tr.right + 0.5 && dr.top >= tr.top - 0.5, dotsVisible, '`...` 落在行盒内（未被裁）', 'AC2')
      } else {
        add('title.dotsVisible', !tText.endsWith('...'), 'no trailing dots node', '未截断卡不适用', 'AC2')
      }
    }

    // 价格行
    add('price.dollarInSpan', !!curEl && curEl.tagName === 'SPAN' && curEl.textContent === '$', curEl && { tag: curEl.tagName, text: curEl.textContent }, '<span>$</span>', 'AC3')
    add('price.noYen', !(root.innerText || '').includes('¥'), (root.innerText || '').includes('¥'), '无 `¥`', 'AC3')
    add('price.num=points', !!numEl && fx && String(numEl.textContent) === String(fx.points), numEl && numEl.textContent, fx && String(fx.points), 'AC3')
    const wText = (wantsEl?.textContent || '').trim()
    add('price.wantsRegex', /^\d+人想要$/.test(wText), wText, '^\\d+人想要$', 'AC3')
    add('price.wantsValue', fx ? wText === `${fx.wants}人想要` : true, wText, fx && `${fx.wants}人想要`, 'AC3')
    add('price.singleLine', price ? price.scrollHeight <= price.clientHeight + 1 && Math.abs(rp.height - 24) < 0.5 : false, price && { scrollH: price.scrollHeight, clientH: price.clientHeight }, '单行（行高 24，无换行）', 'AC3')
    const curGap = curEl && numEl ? R(rect(numEl).left - rect(curEl).right) : null
    add('price.curNumAdjacent', curGap !== null && Math.abs(curGap) <= 1, { gap: curGap }, '`$` 与数字紧贴（gap ≤ 1px）', 'AC3')
    add('price.wantsRightOfNum', numEl && wantsEl && rect(wantsEl).left >= rect(numEl).right, numEl && wantsEl && { numRight: R(rect(numEl).right), wantsLeft: R(rect(wantsEl).left) }, 'wants 在数字右侧', 'AC3')

    // 移除面 / 保留面
    const cardText = root.innerText || ''
    add('removed.description', fx ? !cardText.includes(fx.description.slice(0, 12)) : true, cardText.includes(fx ? fx.description.slice(0, 12) : ''), '描述行不渲染', 'AC5')
    add('removed.clamp3', root.querySelectorAll('[class*="line-clamp-3"]').length === 0, root.querySelectorAll('[class*="line-clamp-3"]').length, 0, 'AC5')
    add('removed.clockIcon', root.querySelectorAll('svg.lucide-clock, [data-sf-m="reward-card-time"]').length === 0, root.querySelectorAll('svg.lucide-clock, [data-sf-m="reward-card-time"]').length, 0, 'AC5')
    add('kept.priceBlock', !!root.querySelector('.sf-reward-price'), !!root.querySelector('.sf-reward-price'), '`$` 块在场', 'AC5')
    add('kept.sellerBar', !!seller && !!root.querySelector('[data-sf-m="reward-card-seller-tier"]'), !!seller, '卖家栏 + 信用胶囊在场', 'AC5')
    const link = root.tagName === 'A' ? root : null
    add('kept.wholeCardLink', !!link && /\/item\/\d+$/.test(link.getAttribute('href') || ''), link && link.getAttribute('href'), 'a[href=/item/<数字>]', 'AC5')
    const nestedCount = root.querySelectorAll('a,button,input,select,textarea').length
    add('kept.noNestedInteractive', nestedCount === 0, nestedCount, 0, 'AC5')

    out.cards.push({ bID, title: fx && fx.name, checks: ck })
  }
  return out
}

// 把夹具塞进页面（供测量函数按 bID 匹配期望值）—— 在 goto 前注入
const INJECT_FIXTURES = (fx) => { window.__FIXTURES__ = fx }

async function runCombo(browser, width, theme, { injectCss = null } = {}) {
  const ctx = await makeContext(browser, width, theme)
  await ctx.addInitScript(INJECT_FIXTURES, FIXTURES)
  if (injectCss) await ctx.addInitScript((css) => {
    addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.id = '__neg__'; s.textContent = css; document.head.appendChild(s) })
  }, injectCss)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 })
  await page.waitForFunction(() => [...document.querySelectorAll('[data-sf-m="reward-card"]')].every((c) => getComputedStyle(c).opacity === '1'), { timeout: 20000 })
  // 关掉动画/过渡，等两帧稳定
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))))
  // 给每张卡打 bID（供夹具匹配）：按 DOM 顺序与 fixtures 顺序一致
  await page.evaluate((ids) => {
    [...document.querySelectorAll('[data-sf-m="reward-card"]')].forEach((el, i) => el.setAttribute('data-qa-bid', String(ids[i] ?? 0)))
  }, FIXTURES.map((f) => f.bID))
  const res = await page.evaluate(MEASURE)
  res.combo = { width, theme, injectCss }
  res.pageErrors = errors
  await ctx.close()
  return res
}

const main = async () => {
  const started = new Date().toISOString()
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-device-scale-factor=1'] })
  const report = { started, dist: DIST, combos: [], negative: null, restore: null }

  for (const width of [1440, 1536]) {
    for (const theme of ['light', 'dark']) {
      const r = await runCombo(browser, width, theme)
      const flat = r.cards.flatMap((c) => c.checks)
      const fails = flat.filter((x) => !x.pass)
      log(`[combo] ${width}/${theme} cards=${r.page.cardCount} checks=${flat.length} fails=${fails.length} hOverflow=${r.page.hOverflow} cols=${r.page.gridCols} errors=${r.pageErrors.length}`)
      for (const f of fails.slice(0, 40)) log('   FAIL', JSON.stringify(f))
      report.combos.push(r)
    }
  }

  // 判负自证：注入 row3 高 25 ⇒ 必红
  const neg = await runCombo(browser, 1440, 'light', { injectCss: '.sf-reward-card .row3-wrap-price{height:25px!important;flex:0 0 25px!important}' })
  const negFails = neg.cards.flatMap((c) => c.checks).filter((x) => !x.pass)
  log(`[negative] injected row3=25 ⇒ fails=${negFails.length}`)
  for (const f of negFails.slice(0, 20)) log('   NEG-FAIL', JSON.stringify(f))
  report.negative = { injectCss: neg.combo.injectCss, failCount: negFails.length, fails: negFails, cards: neg.cards.map((c) => ({ bID: c.bID, row3: c.checks.find((x) => x.id === 'row3.h24')?.actual, cardH: c.checks.find((x) => x.id === 'card.h392')?.actual })) }

  // 复原臂：同一视口/主题、无注入 ⇒ 回绿
  const restore = await runCombo(browser, 1440, 'light')
  const restoreFails = restore.cards.flatMap((c) => c.checks).filter((x) => !x.pass)
  log(`[restore] no-injection ⇒ fails=${restoreFails.length}`)
  report.restore = { failCount: restoreFails.length, fails: restoreFails }

  await browser.close()
  report.finished = new Date().toISOString()
  const allChecks = report.combos.flatMap((c) => c.cards.flatMap((x) => x.checks))
  const acChecks = allChecks.filter((c) => c.ac !== 'SPEC')
  const specChecks = allChecks.filter((c) => c.ac === 'SPEC')
  report.summary = {
    combos: report.combos.length,
    totalChecks: allChecks.length,
    acChecks: acChecks.length,
    acFails: acChecks.filter((x) => !x.pass).length,
    specChecks: specChecks.length,
    specFails: specChecks.filter((x) => !x.pass).length,
    totalFails: allChecks.filter((x) => !x.pass).length,
    negativeFails: report.negative.failCount,
    restoreFails: report.restore.failCount,
    themes: report.combos.map((c) => ({ width: c.combo.width, theme: c.page.theme })),
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  log('[summary]', JSON.stringify(report.summary))
  // 退出码只看 AC 判据 + 判负自证臂；SPEC 附加条款的偏离单列（findings），不掩盖也不冒充 AC 红
  process.exit(report.summary.acFails === 0 && report.negative.failCount > 0 && report.restore.failCount === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); fs.writeFileSync(OUT, JSON.stringify({ error: String(e && e.stack || e) }, null, 2)); process.exit(2) })
