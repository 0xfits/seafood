/**
 * 质检脚本 03 · 前端 E2E（AC4 · 真页 + 真后端）
 * ---------------------------------------------------------------------------
 * 与实现方自检探针的区别：**API 不截桩** —— 页面全部请求经 `route.fetch` 真打到本机 dev 后端（5788），
 * 因此「刷新 views +1」「收藏 toggle」「wants 数字」都是**真库读数**，不是内存计数。
 * 页面本体 = `frontend/dist`（生产构建产物，react 非 dev 档 ⇒ 无 StrictMode 双跑）。
 * 卖家 = 账户 A（夹具 137/138/141），浏览器登录态 = 账户 B（非卖家 ⇒ 聊一聊渲染）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { REPO, dbIdentity, save, http, ensureAccounts, dbRow } from './lib.mjs'

const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = path.join(REPO, 'frontend/dist')
const ORIGIN = 'http://sf.local'
const API_ORIGIN = 'http://localhost:5788'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa'
const fx = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'fixtures.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
}

const out = { origin: ORIGIN, dist: DIST, cases: [] }
const rec = (name, data) => { out.cases.push({ case: name, ...data }); console.log('·', name, JSON.stringify(data).slice(0, 500)) }

const main = async () => {
  out.db = await dbIdentity()
  const { A, B } = await ensureAccounts()
  out.actor = { sellerA: A.uid, viewerB: B.uid, evm: B.evm }

  // ---- 夹具上架（真状态迁移口） -------------------------------------------
  const listed = {}
  for (const key of ['BNS', 'LN', 'DIG']) {
    const id = fx.ids[key]
    const cur = await dbRow(id)
    if (cur.status !== 'listed') {
      const r = await http('PATCH', `/api/listing/${id}`, { token: A.token, body: { to_status: 'listed' } })
      listed[key] = { id, status: r.status, now: (await dbRow(id)).status }
    } else listed[key] = { id, status: 204, now: 'listed' }
  }
  rec('fixtures listed', listed)

  // 清理 B 在夹具上的既有收藏（幂等 DELETE），保证 toggle 起点已知
  for (const key of ['BNS', 'LN', 'DIG']) {
    await http('DELETE', `/api/favorites/${fx.ids[key]}`, { token: B.token })
  }
  const wantsBefore = await (async () => {
    const r = await http('GET', `/api/prize/${fx.ids.BNS}`)
    return r.json?.data?.wants
  })()
  rec('wants baseline (BNS)', { wants: wantsBefore })

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'zh-CN' })

  // 登录态（真 token，由真后端签名）
  await context.addInitScript((u) => {
    const user = { uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', u.token)
  }, { uID: B.uid, EVM: B.evm, token: B.token })

  // 静态 dist + API 真代理
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const relPath = decodeURIComponent(url.pathname)
    // 同源 /api/** ⇒ 真后端（不截桩）
    if (relPath.startsWith('/api/')) {
      const resp = await route.fetch({ url: API_ORIGIN + relPath + url.search })
      return route.fulfill({ response: resp })
    }
    if (url.origin !== ORIGIN) {
      return route.abort()
    }
    let file = path.join(DIST, relPath)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    const ext = path.extname(file) || '.html'
    return route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: fs.readFileSync(file) })
  })

  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })

  const waitDetail = async () => {
    await page.waitForSelector('[data-sf-m="item-detail-price-row"]', { timeout: 15000 })
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-sf-m="item-detail-counts"]')
      return Boolean(el && el.textContent)
    }, null, { timeout: 15000 }).catch(() => {})
  }

  const snap = async () => page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const qa = (s) => [...document.querySelectorAll(s)]
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) } }
    const cs = (el, p) => (el ? getComputedStyle(el)[p] : null)
    const priceNum = q('.sf-item-price-num')
    const priceRow = q('[data-sf-m="item-detail-price-row"]')
    const countsDesk = q('[data-sf-m="item-detail-counts"][data-sf-slot="price"]')
    const countsMob = q('[data-sf-m="item-detail-counts"][data-sf-slot="tags"]')
    const bar = q('[data-sf-m="item-actionbar"]')
    const msg = q('[data-sf-m="item-detail-msg-btn"]')
    const fav = q('[data-sf-m="fav-toggle"]')
    const buy = q('[data-sf-m="item-buy-btn"]')
    const chat = q('[data-sf-m="item-chat-btn"]')
    const group = q('.sf-item-cta-group')
    const thumbs = q('[data-sf-m="item-detail-media-thumbs"]')
    const mainImg = q('.sf-item-media-main')
    const gallery = q('[data-sf-m="item-detail-gallery"]')
    const side = q('[data-sf-m="item-detail-web-side"]')
    const seller = q('[data-sf-m="item-detail-seller-row"]')
    const cols = q('[data-sf-m="item-detail-web-cols"]')
    const desc = q('[data-sf-m="item-detail-desc"]')
    const secondary = qa('[data-sf-m="item-detail-secondary-tag"]')
    const condTag = q('[data-sf-m="item-detail-condition-tag"]')
    const settle = q('[data-sf-m="item-detail-settle-tag"]')
    const statusTag = q('[data-sf-m="item-detail-status-tag"]')
    return {
      bodyText: document.body.innerText,
      seller: seller ? { rect: rect(seller), text: seller.innerText } : null,
      price: {
        rect: rect(priceRow),
        num: priceNum ? { text: priceNum.textContent, color: cs(priceNum, 'color'), fontSize: cs(priceNum, 'fontSize'), fontWeight: cs(priceNum, 'fontWeight') } : null,
      },
      coreTag: {
        condition: condTag ? { text: condTag.innerText, rect: rect(condTag) } : null,
        settle: settle ? settle.innerText : null,
        status: statusTag ? statusTag.innerText : null,
        container: rect(q('[data-sf-m="item-detail-tag-core"]')),
      },
      secondary: secondary.map((el) => ({ text: el.innerText, color: cs(el, 'backgroundColor'), rect: rect(el) })),
      counts: {
        desk: countsDesk ? { text: countsDesk.innerText, rect: rect(countsDesk), display: cs(countsDesk, 'display') } : null,
        mob: countsMob ? { text: countsMob.innerText, rect: rect(countsMob), display: cs(countsMob, 'display') } : null,
        wantsText: q('[data-sf-m="item-detail-wants"]')?.textContent ?? null,
        viewsText: q('[data-sf-m="item-detail-views"]')?.textContent ?? null,
      },
      desc: desc ? { text: desc.innerText, whiteSpace: cs(desc, 'whiteSpace'), rect: rect(desc), lineCount: desc.innerText.split('\n').length } : null,
      gallery: {
        rect: rect(gallery), thumbs: rect(thumbs), main: rect(mainImg),
        thumbCount: qa('[data-sf-m="item-detail-media-thumb"]').length,
        imgSrc: q('[data-sf-m="item-detail-thumb"]')?.getAttribute('src') ?? null,
        arrows: { prev: Boolean(q('[data-sf-m="item-detail-media-prev"]')), next: Boolean(q('[data-sf-m="item-detail-media-next"]')) },
      },
      side: rect(side), cols: rect(cols),
      bar: bar ? {
        rect: rect(bar), position: cs(bar, 'position'),
        msg: msg ? { rect: rect(msg), display: cs(msg, 'display'), text: msg.innerText } : null,
        fav: fav ? { rect: rect(fav), display: cs(fav, 'display'), text: fav.innerText, pressed: fav.getAttribute('aria-pressed') } : null,
        buy: buy ? { rect: rect(buy), display: cs(buy, 'display'), text: buy.innerText, disabled: buy.disabled } : null,
        chat: chat ? { rect: rect(chat), display: cs(chat, 'display'), text: chat.innerText } : null,
        group: group ? {
          rect: rect(group), radius: cs(group, 'borderRadius'), overflow: cs(group, 'overflow'),
          children: [...group.children].map((c) => ({ cls: c.className, rect: rect(c), radius: cs(c, 'borderRadius') })),
        } : null,
      } : null,
      titleShown: q('.sf-item-web-title') ? rect(q('.sf-item-web-title')) : null,
      manualShipText: (document.body.innerText.match(/手动发货/g) || []).length,
      buyerShipText: (document.body.innerText.match(/不包邮/g) || []).length,
    }
  })

  // ==================== ① 390 · 主商品（BNS：PhysicalFreeShip + BrandNewSealed，2 图）
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${ORIGIN}/item/${fx.ids.BNS}`, { waitUntil: 'domcontentloaded' })
  await waitDetail()
  const m = await snap()
  const h5 = {
    sellerRow: Boolean(m.seller) && m.seller.rect.h > 0,
    sellerText: m.seller?.text || null,
    priceColor: m.price.num?.color,
    priceColorOk: m.price.num?.color === 'rgb(255, 77, 0)',
    priceFontSize: m.price.num?.fontSize,
    priceWeight: m.price.num?.fontWeight,
    conditionTag: m.coreTag.condition?.text ?? null,
    conditionTagOk: m.coreTag.condition?.text === '全新未拆封',
    secondaryTags: m.secondary,
    secondaryOnlyFreeShip: m.secondary.length === 1 && m.secondary[0].text === '包邮',
    secondaryColorOk: m.secondary[0]?.color === 'rgb(255, 230, 15)',
    zeroManualShipText: m.manualShipText === 0,
    zeroBuyerShipText: m.buyerShipText === 0,
    countsText: m.counts.mob?.text ?? null,
    countsHasWants: /人想要/.test(m.counts.mob?.text || ''),
    countsHasViews: /人浏览/.test(m.counts.mob?.text || ''),
    descNonEmpty: (m.desc?.text || '').length > 0,
    descWhiteSpace: m.desc?.whiteSpace,
    descPreservesNewline: (m.desc?.lineCount || 0) >= 2,
    galleryImgSrc: m.gallery.imgSrc,
    barPosition: m.bar.position,
    barFixed: m.bar.position === 'fixed',
    barItems: {
      msg: m.bar.msg && { h: m.bar.msg.rect.h, text: m.bar.msg.text, display: m.bar.msg.display },
      fav: m.bar.fav && { h: m.bar.fav.rect.h, text: m.bar.fav.text, display: m.bar.fav.display },
      buy: m.bar.buy && { h: m.bar.buy.rect.h, text: m.bar.buy.text },
      chat: m.bar.chat && { h: m.bar.chat.rect.h, text: m.bar.chat.text },
    },
    barAllFour: Boolean(m.bar.msg && m.bar.fav && m.bar.buy && m.bar.chat),
    barHeights44: [m.bar.msg, m.bar.fav, m.bar.buy, m.bar.chat].every((b) => b && Math.abs(b.rect.h - 44) <= 0.6),
    barSingleLine: [m.bar.msg, m.bar.fav, m.bar.buy, m.bar.chat].every((b) => b && Math.abs(b.rect.h - 44) <= 0.6),
    barTopsAligned: (() => { const ys = [m.bar.msg, m.bar.fav, m.bar.buy, m.bar.chat].map((b) => b?.rect.y); return Math.max(...ys) - Math.min(...ys) <= 1 }),
    leftGroupX: [m.bar.msg?.rect.x, m.bar.fav?.rect.x],
    rightGroupRight: [m.bar.buy?.rect.right, m.bar.chat?.rect.right],
    rightEdgesAligned: Math.abs((m.bar.buy?.rect.right ?? 0) - (m.bar.chat?.rect.right ?? 0)) <= 1,
    rightAlignedToBar: Math.abs((m.bar.chat?.rect.right ?? 0) - m.bar.rect.right) <= 1,
    leftGroupIsLeft: (m.bar.msg?.rect.x ?? 999) < (m.bar.buy?.rect.x ?? 0),
  }
  rec('390 main (BNS)', { h5, pageErrors: [...pageErrors], consoleErrors: consoleErrors.slice(0, 3) })

  // ==================== 390 · 次要标签反臂（138 PhysicalBuyerShip ⇒ 零标签）
  await page.goto(`${ORIGIN}/item/${fx.ids.LN}`, { waitUntil: 'domcontentloaded' })
  await waitDetail()
  const m2 = await snap()
  rec('390 buyer-ship negative arm (LN)', {
    secondaryCount: m2.secondary.length,
    secondaryTexts: m2.secondary.map((s) => s.text),
    manualShipText: m2.manualShipText, buyerShipText: m2.buyerShipText,
    coreTag: m2.coreTag.condition?.text ?? null,
    pass: m2.secondary.length === 0 && m2.manualShipText === 0 && m2.buyerShipText === 0,
  })

  // ==================== 390 · 数字自动发货（141）⇒ 绿签 + 平台结算兜底
  await page.goto(`${ORIGIN}/item/${fx.ids.DIG}`, { waitUntil: 'domcontentloaded' })
  await waitDetail()
  const m3 = await snap()
  rec('390 digital auto-deliver (DIG)', {
    secondary: m3.secondary,
    secondaryGreen: m3.secondary[0]?.color === 'rgb(74, 222, 128)',
    coreSettle: m3.coreTag.settle, coreStatus: m3.coreTag.status,
    manualShipText: m3.manualShipText,
    pass: m3.secondary.length === 1 && m3.secondary[0].text === '自动发货' && m3.secondary[0].color === 'rgb(74, 222, 128)'
      && m3.coreTag.settle === '平台结算' && m3.manualShipText === 0,
  })

  // ==================== ③ 收藏 toggle ⇒ wants 数字即时变（390 · BNS）
  await page.goto(`${ORIGIN}/item/${fx.ids.BNS}`, { waitUntil: 'domcontentloaded' })
  await waitDetail()
  const wantsT0 = (await snap()).counts.wantsText
  const favAttr0 = await page.getAttribute('[data-sf-m="fav-toggle"]', 'data-sf-fav')
  await page.click('[data-sf-m="fav-toggle"]')
  await page.waitForTimeout(1200)
  const s1 = await snap()
  const favAttr1 = await page.getAttribute('[data-sf-m="fav-toggle"]', 'data-sf-fav')
  const favDb = await (async () => {
    const { sql } = await import('./lib.mjs')
    return (await sql`SELECT count(*)::int AS n FROM public.listing_favorite WHERE listing_id = ${fx.ids.BNS}::bigint`)[0].n
  })()
  rec('390 favorite toggle (BNS)', {
    wants_before: wantsT0, wants_after: s1.counts.wantsText,
    dom_updated: wantsT0 !== s1.counts.wantsText,
    fav_attr: [favAttr0, favAttr1], db_favorite_rows: favDb,
    toggle_ok: favAttr0 === '0' && favAttr1 === '1' && favDb === 1,
  })

  // ==================== ④ views 刷新 +1（真库读数）
  const viewsDb0 = Number((await dbRow(fx.ids.BNS)).view_count)
  const viewsText0 = s1.counts.viewsText
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitDetail()
  const s2 = await snap()
  const viewsDb1 = Number((await dbRow(fx.ids.BNS)).view_count)
  rec('views refresh (BNS)', {
    db_before: viewsDb0, db_after: viewsDb1, db_delta: viewsDb1 - viewsDb0,
    dom_before: viewsText0, dom_after: s2.counts.viewsText,
    pass: viewsDb1 - viewsDb0 === 1,
    note_plus2: viewsDb1 - viewsDb0 === 2 ? 'dev 双跑？本页为 dist 生产构建（无 StrictMode 双 invoke）' : null,
  })

  // ==================== ② 1536 · 两栏（同页零 reload 翻转 + 冷启两档）
  const pageErrorsBefore1536 = pageErrors.length
  await page.setViewportSize({ width: 1536, height: 900 })
  await page.waitForTimeout(600)
  const w = await snap()
  const web = {
    sellerFullWidth: Boolean(w.seller) && Boolean(w.cols) && Math.abs(w.seller.rect.w - w.cols.rect.w) <= 2,
    sellerAboveCols: Boolean(w.seller) && Boolean(w.cols) && w.seller.rect.bottom <= w.cols.rect.y + 1,
    twoColumns: Boolean(w.gallery) && Boolean(w.side) && w.gallery.rect.right <= w.side.rect.x + 1,
    thumbsLeftOfMain: Boolean(w.gallery.thumbs) && Boolean(w.gallery.main) && w.gallery.thumbs.rect.right <= w.gallery.main.rect.x + 1,
    thumbCount: w.gallery.thumbCount,
    arrowsWhenMulti: w.gallery.arrows.prev && w.gallery.arrows.next,
    countsAtRightEnd: (() => {
      const c = w.counts.desk
      if (!c || !w.price.rect) return false
      return Math.abs(c.rect.right - w.price.rect.right) <= 2 && w.counts.mob === null
    })(),
    countsDeskText: w.counts.desk?.text ?? null,
    pillSingleContainer: Boolean(w.bar.group) && /999px|9999px/.test(w.bar.group.radius || ''),
    pillRadius: w.bar.group?.radius ?? null, pillOverflow: w.bar.group?.overflow ?? null,
    pillChildren: w.bar.group?.children ?? null,
    pillChildrenRounded: (() => {
      const ch = w.bar.group?.children || []
      if (ch.length !== 2) return false
      return ch.every((c) => /\d+px/.test(c.radius || ''))
    })(),
    favSameHeight: Boolean(w.bar.fav && w.bar.buy) && Math.abs(w.bar.fav.rect.h - w.bar.buy.rect.h) <= 0.6 && Math.abs(w.bar.fav.rect.h - 44) <= 0.6,
    favHeight: w.bar.fav?.rect.h, buyHeight: w.bar.buy?.rect.h,
    msgHiddenOnWeb: w.bar.msg ? w.bar.msg.display === 'none' : true,
    barPosition: w.bar.position,
    barStatic: w.bar.position === 'static' || w.bar.position === 'relative',
    zeroPageErrorsInFlip: pageErrors.length === pageErrorsBefore1536,
  }
  rec('1536 web (BNS)', { web, pageErrors: pageErrors.slice(-3) })

  // ==================== 1536 · 单图/无图 ⇒ 零箭头（DIG 无图）
  await page.goto(`${ORIGIN}/item/${fx.ids.DIG}`, { waitUntil: 'domcontentloaded' })
  await waitDetail()
  const w2 = await snap()
  rec('1536 single/no media arrows (DIG)', {
    thumbCount: w2.gallery.thumbCount, arrows: w2.gallery.arrows,
    pass: !w2.gallery.arrows.prev && !w2.gallery.arrows.next,
  })

  // ==================== ⑤ 零 pageerror
  rec('pageerrors total', { pageErrors, consoleErrorsCount: consoleErrors.length, consoleErrors: consoleErrors.slice(0, 5) })

  await browser.close()

  const h5pass = [
    h5.sellerRow, h5.priceColorOk, h5.conditionTagOk, h5.secondaryOnlyFreeShip, h5.secondaryColorOk,
    h5.zeroManualShipText, h5.zeroBuyerShipText, h5.countsHasWants, h5.countsHasViews,
    h5.descNonEmpty, h5.descPreservesNewline, Boolean(h5.galleryImgSrc), h5.barFixed, h5.barAllFour,
    h5.barHeights44, h5.barTopsAligned, h5.rightEdgesAligned, h5.rightAlignedToBar, h5.leftGroupIsLeft,
  ]
  out.verdict = {
    h5_checks: h5pass, h5_failed: h5pass.filter((x) => !x).length,
    pageerrors: pageErrors.length,
    cases: out.cases.length,
  }
  out.file = save('03-front-e2e-ac4', out)
  console.log('READING:', out.file)
  console.log('H5_FAILED', h5pass.filter((x) => !x).length, 'PAGEERRORS', pageErrors.length)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
