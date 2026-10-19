// 商品卡改版真浏览器探针（Kevin 2026-10-19 四条指令 + 第 4 条卖家栏）
// 运行：node ops/card-resize/probe-card-geometry.mjs   （需 dev 5787 前端 + 5788 后端在跑）
//
// 取数口径：
//   · 夹具相：context.route 拦 `**/api/prize/all**` 注入 6 行（四种内容组合：有图-宽图 / 有图-长标题长文 /
//     无图-占位 / 混合），× 视口(1440/1536) × 主题(日/夜) —— 每卡断言：卡高恒 412、图高 240 且宽=卡宽、
//     卖家栏 48、徽章/领取行文案计数 0、六列网格、零横向溢出、零 pageerror。
//   · 真数据相（无拦截，zh@1440 日档）：掩码昵称格式（前6+6星+后4）、不泄漏完整地址、
//     卡昵称 == 详情页卖家名、credit='new'（dev rating 0 行 ⇒ 无评分档）。
//   · 判定动画干扰：等待全部卡片 computed opacity==1（animate-fade-in 结束）后再量。
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
const SHOTS = path.join(HERE, 'shots')
fs.mkdirSync(path.join(HERE, 'readings'), { recursive: true })
fs.mkdirSync(SHOTS, { recursive: true })

// ---- 迷你 PNG 生成（纯 Node stdlib：实心色，用于 cover 裁切的两种极端比例） ----
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
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit, truecolor
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

const WIDE = solidPng(64, 24, [220, 60, 50])   // 宽图（8:3）
const TALL = solidPng(24, 64, [50, 80, 220])   // 竖图（3:8）
const AVA = solidPng(12, 12, [90, 160, 90])    // 头像有图组合

const longTitle = '超长商品标题用于验证两行截断固定盒高的组合读数超长商品标题用于验证两行截断'
const longDesc = '超长描述文本。'.repeat(30)

// normalizeBrand 形状的夹具行（HomePage mapRewardsForHome 消费：name/description/points/stores_count/media_urls/seller）
const FIXTURES = [
  { bID: 901, name: '组合A·宽图短文', description: '短描述。', points: 100, stores_count: 2,
    media_urls: [WIDE], seller: { uid: 1, nickname: '0xaaaa******aaa1', avatar: null, credit: 'excellent' } },
  { bID: 902, name: longTitle, description: longDesc, points: 2500, stores_count: 2,
    media_urls: [TALL], seller: { uid: 2, nickname: '0xbbbb******bbb2', avatar: AVA, credit: 'good' } },
  { bID: 903, name: '组合C·无图无描述', points: 500, stores_count: 0,
    seller: { uid: 3, nickname: '0xcccc******ccc3', avatar: null, credit: 'new' } },
  { bID: 904, name: '组合D·竖图中文', description: '两行以内的描述文字。', points: 800, stores_count: 2,
    media_urls: [TALL], seller: { uid: 4, nickname: '0xdddd******ddd4', avatar: null, credit: 'normal' } },
  { bID: 905, name: '组合E·宽图长文', description: longDesc, points: 6000, stores_count: 2,
    media_urls: [WIDE], seller: { uid: 5, nickname: '0xeeee******eee5', avatar: null, credit: 'excellent' } },
  { bID: 906, name: '组合F·无图短文', description: '占位图组合。', points: 300, stores_count: 2,
    seller: { uid: 6, nickname: '0xffff******fff6', avatar: null, credit: 'new' } },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
const log = (...a) => { const line = a.join(' '); console.log(line); fs.appendFileSync(path.join(HERE, 'logs/probe.log'), line + '\n') }
fs.mkdirSync(path.join(HERE, 'logs'), { recursive: true })

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
      const media = root.querySelector('.sf-reward-media')
      const img = root.querySelector('.sf-reward-media-img')
      const seller = root.querySelector('[data-sf-m="reward-card-seller"]')
      const tier = root.querySelector('[data-sf-m="reward-card-seller-tier"]')
      const ir = inner.getBoundingClientRect()
      const mr = media ? media.getBoundingClientRect() : null
      const imr = img ? img.getBoundingClientRect() : null
      const sr = seller ? seller.getBoundingClientRect() : null
      const ar = seller ? seller.querySelector('.sf-reward-seller-avatar')?.getBoundingClientRect() : null
      return {
        innerH: num(ir.height), innerW: num(ir.width),
        mediaH: mr ? num(mr.height) : null, mediaW: mr ? num(mr.width) : null,
        imgH: imr ? num(imr.height) : null, imgW: imr ? num(imr.width) : null,
        objectFit: img ? getComputedStyle(img).objectFit : null,
        sellerH: sr ? num(sr.height) : null, sellerW: sr ? num(sr.width) : null,
        avatarW: ar ? num(ar.width) : null, avatarH: ar ? num(ar.height) : null,
        tierText: tier ? tier.textContent.trim() : null,
        tierClass: tier ? tier.className : null,
        nickname: seller ? seller.querySelector('.sf-reward-seller-name')?.textContent.trim() : null,
      }
    })
    const grid = document.querySelector('[data-sf-m="feed-grid"]')
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : null
    // ★ 扫描面 = 商品网格子树（卡面）：页级 innerText 会撞上筛选 chip 的「已兑换/限量」字样（非卡面元素）
    const text = grid ? (grid.innerText || '') : ''
    const forbidden = {}
    for (const s of ['库存不足', '可兑换', '已兑换', '人已领取', '限量']) forbidden[s] = text.split(s).length - 1
    const de = document.documentElement
    return {
      cards,
      cols,
      overflowX: num(de.scrollWidth - de.clientWidth),
      forbidden,
      fullAddrLeak: /0x[0-9a-fA-F]{40}/.test(text),
    }
  })
}

const check = (name, cond, detail) => ({ name, pass: Boolean(cond), detail })

async function runPass(browser, { vp, theme, intercept }) {
  const context = await browser.newContext({
    viewport: { width: vp, height: 960 },
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
  const shots = []
  if (intercept && vp === 1536 && theme === 'light') {
    const shot = path.join(SHOTS, 'fixture-1536-light.png')
    await page.screenshot({ path: shot, fullPage: false })
    shots.push(shot)
  }

  const tag = `${vp}/${theme}${intercept ? '/fixture' : '/real'}`
  const checks = []
  // ① 卡高恒 412（每卡）
  checks.push(check('card-h-412-all', m.cards.every((c) => c.innerH === 412), m.cards.map((c) => c.innerH).join(',')))
  // ② 图 240 高、宽=卡宽（夹具相全行有图或占位；真数据相同样恒有图）
  const withMedia = m.cards.filter((c) => c.mediaH != null)
  checks.push(check('media-h-240-all', withMedia.length === m.cards.length && withMedia.every((c) => c.mediaH === 240), `media rows=${withMedia.length}/${m.cards.length}`))
  checks.push(check('img-fullbleed', withMedia.every((c) => Math.abs(c.imgW - c.innerW) <= 2 && c.imgH === 240), `imgW=[${withMedia.map((c) => c.imgW)}] innerW=[${withMedia.map((c) => c.innerW)}]`))
  checks.push(check('object-fit-cover', withMedia.every((c) => c.objectFit === 'cover'), withMedia.map((c) => c.objectFit).join(',')))
  // ③ 卖家栏 48、头像 24、credit 档位（夹具相逐行对表）
  checks.push(check('seller-h-48-all', m.cards.every((c) => c.sellerH === 48), m.cards.map((c) => c.sellerH).join(',')))
  checks.push(check('avatar-24-all', m.cards.every((c) => c.avatarW === 24 && c.avatarH === 24), ''))
  if (intercept) {
    const tierOk = m.cards.every((c, i) => c.tierText === ({
      excellent: '卖家信用优秀', good: '卖家信用良好', new: '新卖家', normal: '卖家信用一般',
    }[FIXTURES[i].seller.credit]))
    checks.push(check('tier-text-match', tierOk, m.cards.map((c) => c.tierText).join('|')))
    const clsOk = m.cards.every((c, i) => {
      const want = { excellent: 'bg-orange-100', good: 'bg-blue-50', normal: 'bg-gray-100', new: 'bg-gray-100' }[FIXTURES[i].seller.credit]
      return c.tierClass.includes(want)
    })
    checks.push(check('tier-class-match', clsOk, ''))
    checks.push(check('nickname-mask', m.cards.every((c) => /^0x[0-9a-f]{4}\*{6}[0-9a-f]{4}$/.test(c.nickname)), m.cards.map((c) => c.nickname).join('|')))
    checks.push(check('no-full-addr', m.fullAddrLeak === false, ''))
  } else {
    checks.push(check('nickname-mask-real', m.cards.every((c) => /^0x[0-9a-f]{4}\*{6}[0-9a-f]{4}$/.test(c.nickname)), m.cards.map((c) => c.nickname).join('|')))
    checks.push(check('no-full-addr', m.fullAddrLeak === false, ''))
  }
  // ④ 徽章/领取行计数 0
  checks.push(check('badge-claim-count-0', Object.values(m.forbidden).every((n) => n === 0), JSON.stringify(m.forbidden)))
  // ⑤ 六列 / 溢出
  checks.push(check('grid-cols-6', m.cols === 6, `cols=${m.cols}`))
  checks.push(check('no-overflow-x', m.overflowX === 0, `overflowX=${m.overflowX}`))

  let detailMatch = null
  if (!intercept) {
    // 真数据相：详情页只消费 `seller.uid`（不渲染昵称）⇒ 「与详情页卖家名一致」在**数据面**核：
    // 卡昵称（listBrands 路径）== `GET /api/prize/:bID` 的 `seller.nickname`（getPrizeSellerView 路径）
    // —— 两条独立代码路径、同一掩码助手 ⇒ 两值相等即单源同款证明。
    const cmp = await page.evaluate(async () => {
      const a = document.querySelector('[data-sf-m="reward-card"]')
      const href = a?.getAttribute('href') || ''
      const bid = href.split('/').pop()
      const nick = a?.querySelector('.sf-reward-seller-name')?.textContent.trim()
      const tier = a?.querySelector('[data-sf-m="reward-card-seller-tier"]')?.textContent.trim()
      const res = await fetch('/api/prize/' + bid)
      const j = await res.json()
      const s = (j.data || j)?.seller
      return { bid, cardNick: nick, cardTier: tier, detailNick: s?.nickname, detailUid: s?.uid, detailCredit: s?.credit }
    })
    detailMatch = cmp
    checks.push(check('detail-seller-name-match', Boolean(cmp.detailNick) && cmp.cardNick === cmp.detailNick
      && /^0x[0-9a-f]{4}\*{6}[0-9a-f]{4}$/.test(cmp.detailNick), JSON.stringify(cmp)))
    const zhTier = { excellent: '卖家信用优秀', good: '卖家信用良好', new: '新卖家', normal: '卖家信用一般' }
    checks.push(check('detail-credit-match', cmp.detailCredit ? cmp.cardTier === zhTier[cmp.detailCredit] : false,
      `credit=${cmp.detailCredit} cardTier=${cmp.cardTier}`))
    checks.push(check('real-credit-new', m.cards.every((c) => c.tierText === '新卖家'), m.cards.map((c) => c.tierText).join('|')))
  }

  await context.close()
  const pass = checks.every((c) => c.pass)
  log(`${pass ? 'PASS' : 'FAIL'} ${tag} cards=${m.cards.length}`)
  for (const c of checks) if (!c.pass) log(`   ✗ ${c.name}: ${c.detail}`)
  return { tag, pass, shots, checks, raw: m }
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
  const out = { verdict, errors, results: results.map(({ raw, ...r }) => ({ ...r, cards: raw.cards, forbidden: raw.forbidden, cols: raw.cols, overflowX: raw.overflowX })) }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  log(`VERDICT=${verdict} passes=${results.length} pageErrors=${errors.length} → ${path.relative(REPO, OUT)}`)
  process.exit(verdict === 'PASS' ? 0 : 1)
}

main().catch((e) => { log('PROBE CRASH: ' + (e?.stack || e)); process.exit(2) })
