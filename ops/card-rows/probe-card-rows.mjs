// 商品卡**行结构**真浏览器探针（Kevin 2026-10-19：image-container + content 四行）
// 运行：node ops/card-rows/probe-card-rows.mjs   （需 dev 5787 前端 + 5788 后端在跑）
//
// 取数口径：
//   · 夹具相：context.route 拦 `**/api/prize/all**` 注入 4 行（短标题 / 25 汉字 / 60 字符拉丁 / 24 汉字刚好 48 单位），
//     × 视口(1440/1536) × 主题(日/夜) —— 每卡断言：
//       卡总高恒 392 / 图容器 240 高且宽 = 卡内宽 / 四行高 48|32|24|48 逐行量 /
//       标题以 `...` 收尾且不溢出 48 高（两行）/ row2 空但在场 / row3 左对齐分组且不换行 / 卖家栏 48 + 掩码。
//   · 真数据相（无拦截）：dev feed 全卡同上几何 + 价格行是 `$N` + `N人想要`。
//   · 判定动画干扰：等全部卡片 computed opacity==1（animate-fade-in 结束）后再量。
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5787'
const OUT = path.join(HERE, 'readings/probe-result.json')
fs.mkdirSync(path.join(HERE, 'readings'), { recursive: true })
fs.mkdirSync(path.join(HERE, 'logs'), { recursive: true })

// ---- 迷你 PNG（纯 stdlib）：宽图 8:3 / 竖图 3:8，用于 cover 裁切的两种极端比例 ----
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
const TALL = solidPng(24, 64, [50, 80, 220])

const HAN24 = '汉'.repeat(24)            // 48 单位（不截）
const HAN25 = '汉'.repeat(25)            // 50 单位（截成 24 + `...`）
const LATIN60 = 'Ultra long product title fixture for truncation test 0123456789'

const FIXTURES = [
  { bID: 901, name: '短标题商品', points: 495, wants: 20, stores_count: 2, media_urls: [WIDE],
    seller: { uid: 1, nickname: '0xaa**a1', avatar: null, credit: 'excellent' } },
  { bID: 902, name: HAN25, points: 12, wants: 0, stores_count: 2,
    seller: { uid: 2, nickname: '0xbb**b2', avatar: null, credit: 'good' } },   // 无图
  { bID: 903, name: LATIN60, points: 8888, wants: 1234, stores_count: 2, media_urls: [TALL],
    seller: { uid: 3, nickname: '0xcc**c3', avatar: null, credit: 'new' } },
  { bID: 904, name: HAN24, points: 1, wants: 7, stores_count: 2, media_urls: [WIDE],
    seller: { uid: 4, nickname: '0xdd**d4', avatar: null, credit: 'normal' } },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
const log = (...a) => {
  const line = a.join(' ')
  console.log(line)
  fs.appendFileSync(path.join(HERE, 'logs/probe.log'), line + '\n')
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
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')].map((root) => {
      const inner = root.querySelector('.sf-reward-inner')
      const imgBox = root.querySelector('.image-container')
      const img = root.querySelector('.image-container img')
      const content = root.querySelector('.content')
      const rows = [...(content?.children || [])]
      const rowOf = (cls) => rows.find((el) => el.className.includes(cls)) || null
      const title = root.querySelector('.row1-wrap-title')
      const service = root.querySelector('.row2-wrap-service')
      const price = root.querySelector('.row3-wrap-price')
      const wants = root.querySelector('[data-sf-m="reward-card-wants"]')
      const cur = root.querySelector('.sf-reward-price-cur')
      const numEl = root.querySelector('.sf-reward-price-num')
      const priceBlock = root.querySelector('.sf-reward-price')
      const seller = root.querySelector('[data-sf-m="reward-card-seller"]')
      const avatar = seller?.querySelector('.sf-reward-seller-avatar')
      const h = (el) => (el ? num(el.getBoundingClientRect().height) : null)
      const w = (el) => (el ? num(el.getBoundingClientRect().width) : null)
      const cs = (el) => (el ? getComputedStyle(el) : null)
      const pr = price?.getBoundingClientRect()
      const wr = wants?.getBoundingClientRect()
      const innerRect = inner ? inner.getBoundingClientRect() : null
      const sellerRect = seller ? seller.getBoundingClientRect() : null
      return {
        rootH: h(root), innerH: h(inner), innerW: w(inner),
        innerClientW: inner ? inner.clientWidth : null,
        // 内容盒高（border-box 下 rect 高含边框，clientHeight 才是可用内容区）：
        // F1 判据 —— 卡体不得有吃布局的实边框，内容盒必须 392。
        innerClientH: inner ? inner.clientHeight : null,
        innerBorderTopW: inner ? getComputedStyle(inner).borderTopWidth : null,
        innerBorderBottomW: inner ? getComputedStyle(inner).borderBottomWidth : null,
        // 卖家行（第 4 行）底边相对卡体内容盒底边：>0 = 溢出被 overflow:hidden 裁掉。
        sellerBottomVsInnerBottom: (innerRect && sellerRect) ? num(innerRect.bottom - sellerRect.bottom) : null,
        imgBoxH: h(imgBox), imgBoxW: w(imgBox), imgH: h(img), imgW: w(img),
        objectFit: img ? getComputedStyle(img).objectFit : (imgBox ? 'no-img' : null),
        contentH: h(content), contentW: w(content),
        rowCount: rows.length,
        rowClasses: rows.map((el) => el.className.split(' ')[0]),
        titleH: h(title), titleW: w(title),
        titleText: title ? title.textContent.trim() : null,
        titleScrollH: title ? title.scrollHeight : null,
        titleClientH: title ? title.clientHeight : null,
        titleLineClamp: cs(title)?.webkitLineClamp || null,
        titleOverflow: cs(title)?.overflow || null,
        serviceH: h(service), serviceText: service ? service.textContent : null,
        serviceChildren: service ? service.children.length : null,
        priceH: h(price), priceText: price ? price.textContent.trim() : null,
        priceWhiteSpace: cs(price)?.whiteSpace || null,
        priceScrollW: price ? price.scrollWidth : null,
        priceClientW: price ? price.clientWidth : null,
        curText: cur ? cur.textContent : null,
        curInSpan: Boolean(cur && cur.tagName === 'SPAN'),
        numText: numEl ? numEl.textContent : null,
        wantsText: wants ? wants.textContent.trim() : null,
        wantsAlign: cs(wants)?.textAlign || null,
        // 两端对齐读数：价格块左缘 vs 行左缘（含 12 内边距）/ 想要右缘 vs 行右缘
        priceLeftGap: priceBlock ? num(priceBlock.getBoundingClientRect().left - price.getBoundingClientRect().left) : null,
        wantsRightGap: wr ? num(price.getBoundingClientRect().right - wr.right) : null,
        priceBlockFontSize: cs(priceBlock)?.fontSize || null,
        sellerH: h(seller), sellerW: w(seller),
        avatarW: w(avatar), avatarH: h(avatar),
        nickname: seller?.querySelector('.sf-reward-seller-name')?.textContent.trim() || null,
        tierText: seller?.querySelector('[data-sf-m="reward-card-seller-tier"]')?.textContent.trim() || null,
      }
    })
    const grid = document.querySelector('[data-sf-m="feed-grid"]')
    const de = document.documentElement
    return {
      cards,
      cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : null,
      overflowX: num(de.scrollWidth - de.clientWidth),
    }
  })
}

const check = (name, cond, detail) => ({ name, pass: Boolean(cond), detail })

async function runPass(browser, { vp, theme, intercept }) {
  const context = await browser.newContext({
    viewport: { width: vp, height: 1000 },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  })
  await context.addInitScript((t) => { try { localStorage.setItem('theme', t) } catch {} }, theme)
  if (intercept) {
    await context.route('**/api/prize/all**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: FIXTURES }),
    }))
  }
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`[${vp}/${theme}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${vp}/${theme}] console.error: ${m.text()}`) })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await settle(page)
  const m = await measure(page)

  const tag = `${vp}/${theme}${intercept ? '/fixture' : '/real'}`
  const checks = []
  const cards = m.cards

  // ① 卡总高恒 392（内层卡体 + 根链接）
  checks.push(check('cardH=392(all)', cards.every((c) => c.innerH === 392), cards.map((c) => c.innerH).join(',')))
  checks.push(check('rootH=392(all)', cards.every((c) => c.rootH === 392), cards.map((c) => c.rootH).join(',')))
  // ①b F1（2026-10-19 独立质检）：卡体**不得有吃布局的实边框**（design §26.11）。
  //    `box-sizing: border-box` 下 392 总高若含 1px×2 边框 ⇒ 内容盒只剩 390 ⇒
  //    image 240 + 四行 152 = 392 溢出 2px，被卡体 overflow-hidden 裁掉（卖家行底 2px 被切）。
  //    判据三条：内容盒 392 / content 盒高 152 / 卖家行底边不被裁（rect 底边对齐内容盒底边）。
  checks.push(check('card-content-box=392', cards.every((c) => c.innerClientH === 392), cards.map((c) => c.innerClientH).join(',')))
  checks.push(check('card-no-layout-border', cards.every((c) => parseFloat(c.innerBorderTopW) === 0 && parseFloat(c.innerBorderBottomW) === 0), cards.map((c) => `${c.innerBorderTopW}/${c.innerBorderBottomW}`).join(',')))
  checks.push(check('contentH=152', cards.every((c) => c.contentH === 152), cards.map((c) => c.contentH).join(',')))
  checks.push(check('seller-row-bottom-unclipped', cards.every((c) => c.sellerBottomVsInnerBottom >= -0.5 && c.sellerBottomVsInnerBottom <= 0.5), cards.map((c) => c.sellerBottomVsInnerBottom).join(',')))
  // ② 图容器 240 高、宽 = 卡内宽（图片具体值优先：宽随栅格）
  checks.push(check('imageBoxH=240(all)', cards.every((c) => c.imgBoxH === 240), cards.map((c) => c.imgBoxH).join(',')))
  checks.push(check('imageBoxW=innerW', cards.every((c) => Math.abs(c.imgBoxW - c.innerClientW) <= 1), cards.map((c) => `${c.imgBoxW}/${c.innerClientW}`).join(' ')))
  checks.push(check('contentW=innerW', cards.every((c) => Math.abs(c.contentW - c.innerClientW) <= 1), cards.map((c) => `${c.contentW}/${c.innerClientW}`).join(' ')))
  if (intercept) {
    const withImg = cards.filter((c) => c.imgH != null)
    checks.push(check('img240xinnerW', withImg.every((c) => c.imgH === 240 && Math.abs(c.imgW - c.innerClientW) <= 1), withImg.map((c) => `${c.imgW}x${c.imgH}`).join(' ')))
    checks.push(check('objectFit=cover', withImg.every((c) => c.objectFit === 'cover'), withImg.map((c) => c.objectFit).join(',')))
    // 夹具 B（bID 902）无 media_urls ⇒ HomePage 回落占位图（真实图片仍进 240 容器，卡高不塌陷）；
    // 「无图 ⇒ 容器仍在、无 img」的极端组合由单测（jsdom）覆盖。
    checks.push(check('placeholder-img-240', cards[1] && cards[1].imgH === 240 && Math.abs(cards[1].imgW - cards[1].innerClientW) <= 1, `img=${cards[1]?.imgW}x${cards[1]?.imgH} inner=${cards[1]?.innerClientW}`))
  }
  // ③ 四行：数量、命名、逐行高 48/32/24/48，和 = 152
  checks.push(check('rows=4', cards.every((c) => c.rowCount === 4), cards.map((c) => c.rowCount).join(',')))
  checks.push(check('row-names', cards.every((c) => c.rowClasses.join('|') === 'row1-wrap-title|row2-wrap-service|row3-wrap-price|row4-wrap-seller'), cards[0]?.rowClasses.join('|')))
  checks.push(check('row1H=48(all)', cards.every((c) => c.titleH === 48), cards.map((c) => c.titleH).join(',')))
  checks.push(check('row2H=32(all)', cards.every((c) => c.serviceH === 32), cards.map((c) => c.serviceH).join(',')))
  checks.push(check('row3H=24(all)', cards.every((c) => c.priceH === 24), cards.map((c) => c.priceH).join(',')))
  checks.push(check('row4H=48(all)', cards.every((c) => c.sellerH === 48), cards.map((c) => c.sellerH).join(',')))
  checks.push(check('rows-sum=152', cards.every((c) => Math.abs((c.titleH + c.serviceH + c.priceH + c.sellerH) - 152) < 0.01), `${cards[0]?.titleH + cards[0]?.serviceH + cards[0]?.priceH + cards[0]?.sellerH}`))
  checks.push(check('240+152=392', cards.every((c) => Math.abs(c.imgBoxH + c.titleH + c.serviceH + c.priceH + c.sellerH - 392) < 0.01), ''))
  // ④ 标题：两行盒（line-clamp 兜底）且不溢出；长标题以字面 `...` 收尾
  checks.push(check('title-h-noclip', cards.every((c) => c.titleScrollH <= c.titleClientH + 1), cards.map((c) => `${c.titleScrollH}/${c.titleClientH}`).join(' ')))
  checks.push(check('title-clamp2', cards.every((c) => String(c.titleLineClamp) === '2'), cards.map((c) => c.titleLineClamp).join(',')))
  if (intercept) {
    const [a, b, c3, d] = cards
    checks.push(check('title-short-verbatim', a.titleText === FIXTURES[0].name, a.titleText))
    checks.push(check('title-han25-trunc', b.titleText === '汉'.repeat(24) + '...', b.titleText?.slice(-6)))
    checks.push(check('title-han24-verbatim', d.titleText === HAN24, d.titleText?.length))
    checks.push(check('title-latin60-trunc', c3.titleText.endsWith('...') && !c3.titleText.includes('…'), c3.titleText))
    // 截断后宽度不溢：前 48 单位 + 三点的文本宽 ≤ 盒宽（两行内）
    checks.push(check('title-no-ellipsis-char', cards.every((c) => !c.titleText.includes('…')), ''))
  }
  // ⑤ row2：空但在场
  checks.push(check('service-empty', cards.every((c) => c.serviceText === '' && c.serviceChildren === 0), cards.map((c) => JSON.stringify(c.serviceText)).join(',')))
  // ⑥ row3：`$` 在 span + 数字 + `{n}人想要` 单行不换行 + **左对齐分组**（2026-10-19 参考图：
  //    不再两端对齐 ⇒ wants 紧跟价格右侧，行右缘留大空白）
  checks.push(check('price-cur-in-span', cards.every((c) => c.curInSpan && c.curText === '$'), cards.map((c) => c.curText).join(',')))
  checks.push(check('price-wants-pattern', cards.every((c) => /^\d+人想要$/.test(c.wantsText || '')), cards.map((c) => c.wantsText).join('|')))
  checks.push(check('price-single-line', cards.every((c) => c.priceScrollW <= c.priceClientW + 1), cards.map((c) => `${c.priceScrollW}/${c.priceClientW}`).join(' ')))
  checks.push(check('price-nowrap', cards.every((c) => c.priceWhiteSpace === 'nowrap'), cards.map((c) => c.priceWhiteSpace).join(',')))
  checks.push(check('price-group-left', cards.every((c) => c.priceLeftGap >= 11 && c.priceLeftGap <= 13 && c.wantsRightGap > 40), cards.map((c) => `${c.priceLeftGap}/${c.wantsRightGap}`).join(' ')))
  if (intercept) {
    checks.push(check('price-num-match', cards.every((c, i) => c.numText === String(FIXTURES[i].points)), cards.map((c) => c.numText).join(',')))
    checks.push(check('wants-num-match', cards.every((c, i) => c.wantsText === `${FIXTURES[i].wants}人想要`), cards.map((c) => c.wantsText).join('|')))
    checks.push(check('wants-zero-cases', cards[1].wantsText === '0人想要', cards[1].wantsText))
  }
  // ⑦ 卖家栏：48 + 头像 24 + 掩码（结构未动）
  checks.push(check('seller-avatar-24', cards.every((c) => c.avatarW === 24 && c.avatarH === 24), ''))
  checks.push(check('nickname-mask', cards.every((c) => /^0x[0-9a-f]{2}\*{2}[0-9a-f]{2}$/.test(c.nickname)), cards.map((c) => c.nickname).join('|')))
  // ⑧ 网格 6 列 / 零横向溢出
  checks.push(check('grid-cols-6', m.cols === 6, `cols=${m.cols}`))
  checks.push(check('no-overflow-x', m.overflowX === 0, `overflowX=${m.overflowX}`))

  await context.close()
  const pass = checks.every((c) => c.pass)
  log(`${pass ? 'PASS' : 'FAIL'} ${tag} cards=${cards.length} cardH=${cards.map((c) => c.innerH).join(',')} rows=${cards[0] ? [cards[0].titleH, cards[0].serviceH, cards[0].priceH, cards[0].sellerH].join('/') : '-'} img=${cards[0]?.imgBoxW}x${cards[0]?.imgBoxH}`)
  for (const c of checks) if (!c.pass) log(`   ✗ ${c.name}: ${c.detail}`)
  return { tag, pass, checks, cards, cols: m.cols, overflowX: m.overflowX }
}

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = []
  for (const vp of [1440, 1536]) {
    for (const theme of ['light', 'dark']) {
      results.push(await runPass(browser, { vp, theme, intercept: true }))
    }
  }
  results.push(await runPass(browser, { vp: 1440, theme: 'light', intercept: false }))
  await browser.close()

  const verdict = results.every((r) => r.pass) && errors.length === 0 ? 'PASS' : 'FAIL'
  const out = {
    verdict,
    errors,
    env: { base: BASE, viewports: [1440, 1536], themes: ['light', 'dark'], fixtures: FIXTURES.map((f) => ({ bID: f.bID, name: f.name, points: f.points, wants: f.wants, hasImage: Boolean(f.media_urls?.[0]) })) },
    results,
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  log(`VERDICT=${verdict} passes=${results.length} checks=${results.reduce((n, r) => n + r.checks.length, 0)} red=${results.reduce((n, r) => n + r.checks.filter((c) => !c.pass).length, 0)} pageErrors=${errors.length} → ${path.relative(REPO, OUT)}`)
  process.exit(verdict === 'PASS' ? 0 : 1)
}

main().catch((e) => { log('PROBE CRASH: ' + (e?.stack || e)); process.exit(2) })
