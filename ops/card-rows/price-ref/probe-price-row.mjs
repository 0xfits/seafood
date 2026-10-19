// 商品卡 **价格行**（row3）参考图探针 —— 2026-10-19 Kevin「闲鱼式」价格行
// 运行：node ops/card-rows/price-ref/probe-price-row.mjs   （需 dev 5787 前端 + 5788 后端在跑）
// ============================================================================
// 口径（参考图）：亮橙红 #FF4D00 加粗大号数字 + 同色小号 `$`（基线对齐）+ 浅灰 #999 小号
//   「N人想要」紧跟价格右侧（约 20px 视觉间距 = 8px gap + 符号/数字侧边距）、同基线、
//   无图标无分隔；**分组左对齐**（不再两端对齐）；行高恒 24、卡高恒 392 不变。
//
// 取数相：夹具（context.route 拦 `**/api/prize/all**`）× 视口(1440/1536) × 主题(日/夜)。
// 基线读数：向「数字」与「wants」各自的 inline 上下文临时插入
//   `<span style="display:inline-block;width:0;height:0;vertical-align:baseline">`
//   —— 零尺寸 inline-block 的底边 = 该行盒的文字基线（经典取值法），读后立即移除。
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5787'
const OUT = path.join(HERE, 'readings/probe-price-row.json')
fs.mkdirSync(path.join(HERE, 'readings'), { recursive: true })
fs.mkdirSync(path.join(HERE, 'logs'), { recursive: true })

// ---- 迷你 PNG（纯 stdlib）：给夹具一张真实图片，保证 image-container 240 有内容 ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const solidPng = (w, h, [r, g, b]) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const off = y * (w * 3 + 1)
    raw[off] = 0
    for (let x = 0; x < w; x++) { raw[off + 1 + x * 3] = r; raw[off + 2 + x * 3] = g; raw[off + 3 + x * 3] = b }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}
const WIDE = solidPng(64, 24, [220, 60, 50])

const FIXTURES = [
  { bID: 901, name: '短标题商品', points: 495, wants: 20, stores_count: 2, media_urls: [WIDE],
    seller: { uid: 1, nickname: '0xaa**a1', avatar: null, credit: 'excellent' } },
  { bID: 902, name: '中号价格 1288', points: 1288, wants: 0, stores_count: 2, media_urls: [WIDE],
    seller: { uid: 2, nickname: '0xbb**b2', avatar: null, credit: 'good' } },
  { bID: 903, name: '大号价格 8888', points: 8888, wants: 1234, stores_count: 2, media_urls: [WIDE],
    seller: { uid: 3, nickname: '0xcc**c3', avatar: null, credit: 'new' } },
  { bID: 904, name: '个位价格 1', points: 1, wants: 7, stores_count: 2, media_urls: [WIDE],
    seller: { uid: 4, nickname: '0xdd**d4', avatar: null, credit: 'normal' } },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
const log = (...a) => {
  const line = a.join(' ')
  console.log(line)
  fs.appendFileSync(path.join(HERE, 'logs/probe-price-row.log'), line + '\n')
}

async function settle(page) {
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 })
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
    return cards.length > 0 && cards.every((c) => getComputedStyle(c).opacity === '1')
  }, { timeout: 20000 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await sleep(150)
}

async function measure(page) {
  return page.evaluate(() => {
    const num = (v) => Math.round(v * 100) / 100
    const baselineOf = (el) => {
      if (!el) return null
      const probe = document.createElement('span')
      probe.setAttribute('data-probe', 'baseline')
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;margin:0;padding:0;border:0'
      el.appendChild(probe)
      const b = probe.getBoundingClientRect().bottom
      probe.remove()
      return num(b)
    }
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')].map((root) => {
      const inner = root.querySelector('.sf-reward-inner')
      const imgBox = root.querySelector('.image-container')
      const content = root.querySelector('.content')
      const rows = [...(content?.children || [])]
      const row = rows.find((el) => el.className.includes('row3-wrap-price')) || null
      const priceBlock = root.querySelector('.sf-reward-price')
      const cur = root.querySelector('.sf-reward-price-cur')
      const numEl = root.querySelector('.sf-reward-price-num')
      const wants = root.querySelector('[data-sf-m="reward-card-wants"]')
      const h = (el) => (el ? num(el.getBoundingClientRect().height) : null)
      const cs = (el) => (el ? getComputedStyle(el) : null)
      const rr = row?.getBoundingClientRect()
      const pr = priceBlock?.getBoundingClientRect()
      const wr = wants?.getBoundingClientRect()
      const nR = numEl?.getBoundingClientRect()
      const baseNum = baselineOf(numEl)
      const baseWants = baselineOf(wants)
      return {
        innerH: num(inner?.getBoundingClientRect().height),
        innerClientH: inner?.clientHeight ?? null,
        imgBoxH: h(imgBox),
        contentH: h(content),
        rowHs: rows.map((el) => num(el.getBoundingClientRect().height)),
        // —— row3 几何 ——
        rowH: h(row),
        rowBoxSizing: cs(row)?.boxSizing || null,
        rowAlignItems: cs(row)?.alignItems || null,
        rowJustify: cs(row)?.justifyContent || null,
        rowGap: cs(row)?.gap || null,
        rowPaddingLeft: cs(row)?.paddingLeft || null,
        rowWhiteSpace: cs(row)?.whiteSpace || null,
        rowOverflow: cs(row)?.overflow || null,
        rowScrollW: row?.scrollWidth ?? null,
        rowClientW: row?.clientWidth ?? null,
        rowChildren: row ? row.children.length : null,
        rowIcons: row ? row.querySelectorAll('svg, img, i').length : null,
        // —— 价格分组（$ + 数字） ——
        priceLeftGap: (rr && pr) ? num(pr.left - rr.left) : null,
        priceBlockW: pr ? num(pr.width) : null,
        priceBlockH: pr ? num(pr.height) : null,
        numFontSize: cs(numEl)?.fontSize || null,
        numFontWeight: cs(numEl)?.fontWeight || null,
        numColor: cs(numEl)?.color || null,
        numText: numEl?.textContent ?? null,
        numRectH: nR ? num(nR.height) : null,
        curText: cur?.textContent ?? null,
        curInSpan: Boolean(cur && cur.tagName === 'SPAN'),
        curFontSize: cs(cur)?.fontSize || null,
        curFontWeight: cs(cur)?.fontWeight || null,
        curColor: cs(cur)?.color || null,
        // —— wants ——
        wantsText: wants?.textContent?.trim() ?? null,
        wantsFontSize: cs(wants)?.fontSize || null,
        wantsFontWeight: cs(wants)?.fontWeight || null,
        wantsColor: cs(wants)?.color || null,
        wantsAlign: cs(wants)?.textAlign || null,
        // 紧跟价格右侧：wants 左缘 − 价格块右缘（= 组内 gap）
        wantsGapAfterPrice: (pr && wr) ? num(wr.left - pr.right) : null,
        // 行右缘空白（左对齐后应留大空白，不得贴右）
        wantsRightGap: (rr && wr) ? num(rr.right - wr.right) : null,
        // —— 基线 ——
        baseNum, baseWants,
        baseDiff: (baseNum != null && baseWants != null) ? num(Math.abs(baseNum - baseWants)) : null,
        wantsBottomOverflow: (rr && wr) ? num(wr.bottom - rr.bottom) : null,
        // 价格行内是否出现 `¥`（不得引入）
        hasYen: /¥|￥/.test(row?.textContent || ''),
      }
    })
    return { cards }
  })
}

const check = (name, cond, detail) => ({ name, pass: Boolean(cond), detail })

const RGB_PRICE = 'rgb(255, 77, 0)'   // #FF4D00
const RGB_WANTS = 'rgb(153, 153, 153)' // #999999

async function runPass(browser, { vp, theme }) {
  const context = await browser.newContext({
    viewport: { width: vp, height: 1000 },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  })
  await context.addInitScript((t) => { try { localStorage.setItem('theme', t) } catch {} }, theme)
  await context.route('**/api/prize/all**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data: FIXTURES }),
  }))
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`[${vp}/${theme}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${vp}/${theme}] console.error: ${m.text()}`) })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await settle(page)
  const m = await measure(page)
  const cards = m.cards
  const checks = []
  const all = (fn) => cards.every(fn)
  const col = (fn) => cards.map(fn).join(',')

  // ① 行高 24 / 卡高 392 / 四行 48-32-24-48（一行未动）
  checks.push(check('cardH=392', all((c) => c.innerH === 392 && c.innerClientH === 392), col((c) => `${c.innerH}/${c.innerClientH}`)))
  checks.push(check('img240+content152', all((c) => c.imgBoxH === 240 && c.contentH === 152), col((c) => `${c.imgBoxH}/${c.contentH}`)))
  checks.push(check('rows=48/32/24/48', all((c) => c.rowHs.join('/') === '48/32/24/48'), cards[0]?.rowHs.join('/')))
  checks.push(check('row3H=24', all((c) => c.rowH === 24), col((c) => c.rowH)))
  // ② 布局：左对齐 + 基线
  checks.push(check('row3-align=baseline', all((c) => c.rowAlignItems === 'baseline'), col((c) => c.rowAlignItems)))
  checks.push(check('row3-justify=flex-start', all((c) => c.rowJustify === 'flex-start'), col((c) => c.rowJustify)))
  checks.push(check('row3-gap=8px', all((c) => c.rowGap === '8px'), col((c) => c.rowGap)))
  checks.push(check('row3-nowrap', all((c) => c.rowWhiteSpace === 'nowrap'), col((c) => c.rowWhiteSpace)))
  checks.push(check('row3-single-line', all((c) => c.rowScrollW <= c.rowClientW + 1), col((c) => `${c.rowScrollW}/${c.rowClientW}`)))
  checks.push(check('row3-2-children-no-icon', all((c) => c.rowChildren === 2 && c.rowIcons === 0), col((c) => `${c.rowChildren}/${c.rowIcons}`)))
  checks.push(check('price-group-left', all((c) => c.priceLeftGap >= 11 && c.priceLeftGap <= 13), col((c) => c.priceLeftGap)))
  checks.push(check('wants-hugs-price', all((c) => c.wantsGapAfterPrice >= 7 && c.wantsGapAfterPrice <= 9), col((c) => c.wantsGapAfterPrice)))
  checks.push(check('wants-right-whitespace>40', all((c) => c.wantsRightGap > 40), col((c) => c.wantsRightGap)))
  // ③ 颜色/字号（日/夜同值）
  checks.push(check('num-color=FF4D00', all((c) => c.numColor === RGB_PRICE), col((c) => c.numColor)))
  checks.push(check('num-17px-bold', all((c) => c.numFontSize === '17px' && Number(c.numFontWeight) >= 700), col((c) => `${c.numFontSize}/${c.numFontWeight}`)))
  checks.push(check('cur-same-color-as-num', all((c) => c.curColor === c.numColor && c.curColor === RGB_PRICE), col((c) => c.curColor)))
  checks.push(check('cur-0.6em≈10px-bold', all((c) => Math.abs(parseFloat(c.curFontSize) - 10) <= 0.4 && Number(c.curFontWeight) >= 700), col((c) => `${c.curFontSize}/${c.curFontWeight}`)))
  checks.push(check('cur-smaller-than-num', all((c) => parseFloat(c.curFontSize) < parseFloat(c.numFontSize)), col((c) => `${c.curFontSize}<${c.numFontSize}`)))
  checks.push(check('wants-color=999999', all((c) => c.wantsColor === RGB_WANTS), col((c) => c.wantsColor)))
  checks.push(check('wants-12px-400', all((c) => c.wantsFontSize === '12px' && c.wantsFontWeight === '400'), col((c) => `${c.wantsFontSize}/${c.wantsFontWeight}`)))
  // ④ 基线：价格数字 vs wants ≤ 1px；wants 不被行底裁
  checks.push(check('baseline-diff≤1px', all((c) => c.baseDiff != null && c.baseDiff <= 1), col((c) => c.baseDiff)))
  checks.push(check('wants-not-clipped', all((c) => c.wantsBottomOverflow <= 0.5), col((c) => c.wantsBottomOverflow)))
  // ⑤ 语义/文案不变
  checks.push(check('cur=$, in span', all((c) => c.curInSpan && c.curText === '$'), col((c) => `${c.curInSpan}/${c.curText}`)))
  checks.push(check('num-match-fixture', all((c, i) => c.numText === String(FIXTURES[i].points)), col((c) => c.numText)))
  checks.push(check('wants-match-fixture', all((c, i) => c.wantsText === `${FIXTURES[i].wants}人想要`), col((c) => c.wantsText)))
  checks.push(check('no-yen-symbol', all((c) => c.hasYen === false), col((c) => c.hasYen)))

  await context.close()
  const pass = checks.every((c) => c.pass)
  const tag = `${vp}/${theme}`
  log(`${pass ? 'PASS' : 'FAIL'} ${tag} cards=${cards.length} row3=${col((c) => c.rowH)} num=${col((c) => `${c.numFontSize}/${c.numColor}`)} cur=${col((c) => c.curFontSize)} wants=${col((c) => `${c.wantsFontSize}/${c.wantsColor}`)} base=${col((c) => c.baseDiff)} left=${col((c) => c.priceLeftGap)} gap=${col((c) => c.wantsGapAfterPrice)} rightGap=${col((c) => c.wantsRightGap)}`)
  for (const c of checks) if (!c.pass) log(`   ✗ ${c.name}: ${c.detail}`)
  return { tag, pass, checks, cards }
}

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = []
  for (const vp of [1440, 1536]) {
    for (const theme of ['light', 'dark']) results.push(await runPass(browser, { vp, theme }))
  }
  await browser.close()

  const verdict = results.every((r) => r.pass) && errors.length === 0 ? 'PASS' : 'FAIL'
  const out = {
    verdict,
    spec: 'price row: #FF4D00 700 17px num + same-color 0.6em $ + #999999 12px/400 wants, left-aligned, baseline, row 24 / card 392',
    errors,
    env: { base: BASE, viewports: [1440, 1536], themes: ['light', 'dark'], fixtures: FIXTURES.map((f) => ({ bID: f.bID, points: f.points, wants: f.wants })) },
    results,
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  log(`VERDICT=${verdict} passes=${results.length} checks=${results.reduce((n, r) => n + r.checks.length, 0)} red=${results.reduce((n, r) => n + r.checks.filter((c) => !c.pass).length, 0)} pageErrors=${errors.length} → ${path.relative(REPO, OUT)}`)
  process.exit(verdict === 'PASS' ? 0 : 1)
}

main().catch((e) => { log('PROBE CRASH: ' + (e?.stack || e)); process.exit(2) })
