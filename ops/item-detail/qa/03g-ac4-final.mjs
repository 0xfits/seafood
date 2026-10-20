/**
 * 质检脚本 03g · AC4 收口读数（390 五段 + 底栏四件 / 1536 两栏 + 拼接胶囊 / 无图零箭头 /
 * 同页零 reload 翻转 / 收藏 toggle wants）—— 全部真后端、dist 生产构建。
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
const fx = JSON.parse(fs.readFileSync('/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa/fixtures.json', 'utf8'))
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' }

const out = { listing: fx.ids.BNS, cases: [] }
const rec = (name, data) => { out.cases.push({ case: name, ...data }); console.log('·', name, JSON.stringify(data).slice(0, 700)) }

const SNAP = () => {
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
    price: { rect: rect(priceRow), num: priceNum ? { text: priceNum.textContent, color: cs(priceNum, 'color'), fontSize: cs(priceNum, 'fontSize'), fontWeight: cs(priceNum, 'fontWeight') } : null },
    coreTag: { condition: condTag ? { text: condTag.innerText, rect: rect(condTag) } : null, settle: settle ? settle.innerText : null, status: statusTag ? statusTag.innerText : null, container: rect(q('[data-sf-m="item-detail-tag-core"]')) },
    secondary: secondary.map((el) => ({ text: el.innerText, color: cs(el, 'backgroundColor'), rect: rect(el) })),
    counts: {
      desk: countsDesk ? { text: countsDesk.innerText, rect: rect(countsDesk), display: cs(countsDesk, 'display') } : null,
      mob: countsMob ? { text: countsMob.innerText, rect: rect(countsMob), display: cs(countsMob, 'display') } : null,
      wantsText: q('[data-sf-m="item-detail-wants"]')?.textContent ?? null,
      viewsText: q('[data-sf-m="item-detail-views"]')?.textContent ?? null,
    },
    desc: desc ? { text: desc.innerText, whiteSpace: cs(desc, 'whiteSpace'), rect: rect(desc), lineCount: desc.innerText.split('\n').length } : null,
    gallery: { rect: rect(gallery), thumbs: rect(q('[data-sf-m="item-detail-media-thumbs"]')), main: rect(q('.sf-item-media-main')), thumbCount: qa('[data-sf-m="item-detail-media-thumb"]').length, imgSrc: q('[data-sf-m="item-detail-thumb"]')?.getAttribute('src') ?? null, arrows: { prev: Boolean(q('[data-sf-m="item-detail-media-prev"]')), next: Boolean(q('[data-sf-m="item-detail-media-next"]')) } },
    side: rect(side), cols: rect(cols),
    bar: bar ? {
      rect: rect(bar), position: cs(bar, 'position'),
      msg: msg ? { rect: rect(msg), display: cs(msg, 'display'), text: msg.innerText, lineH: cs(msg, 'lineHeight') } : null,
      fav: fav ? { rect: rect(fav), display: cs(fav, 'display'), text: fav.innerText, pressed: fav.getAttribute('aria-pressed'), radius: cs(fav, 'borderRadius') } : null,
      buy: buy ? { rect: rect(buy), display: cs(buy, 'display'), text: buy.innerText, disabled: buy.disabled } : null,
      chat: chat ? { rect: rect(chat), display: cs(chat, 'display'), text: chat.innerText } : null,
      group: group ? { rect: rect(group), radius: cs(group, 'borderRadius'), overflow: cs(group, 'overflow'), children: [...group.children].map((c) => ({ cls: String(c.className), rect: rect(c), radius: cs(c, 'borderRadius') })) } : null,
    } : null,
    webTitle: (() => { const t = q('.sf-item-web-title'); return t ? { text: t.innerText.slice(0, 40), visible: t.getBoundingClientRect().height > 0, weight: cs(t, 'fontWeight') } : null })(),
    texts: { manualShip: (document.body.innerText.match(/手动发货/g) || []).length, buyerShip: (document.body.innerText.match(/不包邮/g) || []).length },
  }
}

const main = async () => {
  out.db = await dbIdentity()
  const { A, B } = await ensureAccounts()
  // 清 B 在 BNS 的收藏，令 toggle 起点已知
  await http('DELETE', `/api/favorites/${fx.ids.BNS}`, { token: B.token })

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
  await context.addInitScript((u) => {
    localStorage.setItem('user', JSON.stringify({ uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }))
    localStorage.setItem('token', u.token)
  }, { uID: B.uid, EVM: B.evm, token: B.token })

  const detailHits = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const p = decodeURIComponent(url.pathname)
    if (p.startsWith('/api/')) {
      if (/^\/api\/prize\/\d+$/.test(p)) detailHits.push({ p, at: Date.now() })
      const resp = await route.fetch({ url: API_ORIGIN + p + url.search })
      return route.fulfill({ response: resp })
    }
    if (url.origin !== ORIGIN) return route.abort()
    let file = path.join(DIST, p)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file) || '.html'] || 'application/octet-stream', body: fs.readFileSync(file) })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))

  const gotoDetail = async (id) => {
    await page.goto(`${ORIGIN}/item/${id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(document.querySelector('[data-sf-m="item-detail-counts"]')?.textContent), null, { timeout: 15000 })
    await page.waitForTimeout(1500)
    return page.evaluate(SNAP)
  }

  // ---------- ① 390 五段 + 底栏四件 ----------
  const m = await gotoDetail(fx.ids.BNS)
  const four = [m.bar.msg, m.bar.fav, m.bar.buy, m.bar.chat]
  const h5 = {
    sellerRow: Boolean(m.seller) && m.seller.rect.h > 0,
    sellerMasked: /0x[0-9a-f]{2}\*\*[0-9a-f]{2}/i.test(m.seller?.text || ''),
    sellerCredit: /新卖家|优秀|良好|一般/.test(m.seller?.text || ''),
    priceColor: m.price.num?.color, priceColorOk: m.price.num?.color === 'rgb(255, 77, 0)',
    priceFontSize: m.price.num?.fontSize, priceWeight: m.price.num?.fontWeight,
    conditionTag: m.coreTag.condition?.text ?? null, conditionTagOk: m.coreTag.condition?.text === '全新未拆封',
    secondary: m.secondary, secondaryOnlyFreeShip: m.secondary.length === 1 && m.secondary[0].text === '包邮',
    secondaryYellow: m.secondary[0]?.color === 'rgb(255, 230, 15)',
    zeroManualShip: m.texts.manualShip === 0, zeroBuyerShip: m.texts.buyerShip === 0,
    countsText: m.counts.mob?.text ?? null,
    countsHasWants: /人想要/.test(m.counts.mob?.text || ''), countsHasViews: /人浏览/.test(m.counts.mob?.text || ''),
    countsDeskHiddenOnMobile: m.counts.desk ? m.counts.desk.display === 'none' : true,
    countsRightAlignedInRow: (() => { const c = m.counts.mob; if (!c || !m.price.rect) return null; return null })(),
    descNonEmpty: (m.desc?.text || '').length > 0, descWhiteSpace: m.desc?.whiteSpace,
    descMultiLine: (m.desc?.lineCount || 0) >= 2,
    descFirstLineIsTitle: (m.desc?.text || '').startsWith('QAID50-BNS'),
    galleryImgSrc: m.gallery.imgSrc, galleryIsMediaRoute: String(m.gallery.imgSrc || '').includes('/api/media/'),
    barFixed: m.bar.position === 'fixed', barAllFour: four.every(Boolean),
    barHeights: four.map((b) => b?.rect.h),
    barHeights44: four.every((b) => b && Math.abs(b.rect.h - 44) <= 0.6),
    barSingleLine: four.every((b) => b && Math.abs(b.rect.h - 44) <= 0.6),
    barTopsAligned: Math.max(...four.map((b) => b.rect.y)) - Math.min(...four.map((b) => b.rect.y)) <= 1,
    leftGroupX: [m.bar.msg.rect.x, m.bar.fav.rect.x], rightGroupRight: [m.bar.buy.rect.right, m.bar.chat.rect.right],
    rightEdgesAligned: Math.abs(m.bar.buy.rect.right - m.bar.chat.rect.right) <= 1,
    rightEdgeAtBarRight: Math.abs(m.bar.chat.rect.right - m.bar.rect.right) <= 12,
    leftGroupLeftOfRight: m.bar.msg.rect.x < m.bar.buy.rect.x,
    barWithinViewport: m.bar.rect.bottom <= 844 + 1,
  }
  rec('390 h5 (BNS)', { h5 })

  // ---------- ② 1536 两栏（同页零 reload 翻转） ----------
  const hitsBeforeFlip = detailHits.length
  await page.setViewportSize({ width: 1536, height: 900 })
  await page.waitForTimeout(700)
  const w = await page.evaluate(SNAP)
  const web = {
    flippedWithoutReload: detailHits.length === hitsBeforeFlip,
    sellerFullWidth: w.seller && w.cols && Math.abs(w.seller.rect.w - w.cols.rect.w) <= 2,
    sellerAboveCols: w.seller && w.cols && w.seller.rect.bottom <= w.cols.rect.y + 1,
    twoColumns: w.gallery && w.side && w.gallery.rect.right <= w.side.rect.x + 1,
    thumbsLeftOfMain: w.gallery?.thumbs && w.gallery?.main && w.gallery.thumbs.right <= w.gallery.main.x + 1,
    thumbCount: w.gallery?.thumbCount, arrowsWhenMulti: Boolean(w.gallery?.arrows.prev && w.gallery?.arrows.next),
    countsRightEnd: w.counts.desk && w.price.rect ? Math.abs(w.counts.desk.rect.right - w.price.rect.right) <= 2 : false,
    countsMobHidden: w.counts.mob ? w.counts.mob.display === 'none' : true,
    countsDeskText: w.counts.desk?.text ?? null,
    pillRadius: w.bar?.group?.radius, pillOverflow: w.bar?.group?.overflow,
    pillSingleContainer: /999px|9999px/.test(w.bar?.group?.radius || '') && /\d+px/.test(w.bar?.group?.children?.[0]?.radius || '') === true,
    pillChildrenRadius: w.bar?.group?.children?.map((c) => c.radius),
    pillChildrenOrder: w.bar?.group?.children?.map((c) => c.cls.includes('chat') ? 'chat' : c.cls.includes('buy') ? 'buy' : 'other'),
    favSameHeightAsPill: w.bar?.fav && w.bar?.group && Math.abs(w.bar.fav.rect.h - w.bar.group.rect.h) <= 0.6,
    favHeight: w.bar?.fav?.rect.h, pillHeight: w.bar?.group?.rect.h,
    msgHiddenOnWeb: w.bar?.msg ? w.bar.msg.display === 'none' : true,
    barStatic: w.bar?.position === 'static' || w.bar?.position === 'relative',
    webTitleVisibleBold: w.webTitle?.visible === true && w.webTitle?.weight === '700',
    webTitleBelowPrice: w.webTitle && w.price.rect ? w.webTitle.visible : null,
    secondaryTagPresent: w.secondary.length === 1, conditionTagPresent: Boolean(w.coreTag.condition),
    zeroManualShip: w.texts.manualShip === 0, zeroBuyerShip: w.texts.buyerShip === 0,
  }
  rec('1536 web (BNS)', { web })

  // ---------- ③ 1536 无图 ⇒ 零箭头（DIG） ----------
  const m2 = await gotoDetail(fx.ids.DIG)
  rec('1536 no-media (DIG)', {
    thumbCount: m2.gallery.thumbCount, arrows: m2.gallery.arrows,
    imgSrcIsPlaceholder: String(m2.gallery.imgSrc || '').includes('placeholder'),
    coreSettle: m2.coreTag.settle, coreStatus: m2.coreTag.status,
    secondary: m2.secondary.map((s) => s.text),
    pass: !m2.gallery.arrows.prev && !m2.gallery.arrows.next && m2.coreTag.settle === '平台结算',
  })

  // ---------- ④ 收藏 toggle ⇒ wants（390） ----------
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const before = await page.evaluate(SNAP)
  const fav0 = await page.getAttribute('[data-sf-m="fav-toggle"]', 'data-sf-fav')
  await page.click('[data-sf-m="fav-toggle"]')
  await page.waitForTimeout(1500)
  const after = await page.evaluate(SNAP)
  const fav1 = await page.getAttribute('[data-sf-m="fav-toggle"]', 'data-sf-fav')
  const detailWantsAfter = (await http('GET', `/api/prize/${fx.ids.BNS}`)).json?.data?.wants
  rec('favorite toggle ⇒ wants', {
    dom_wants_before: before.counts.wantsText, dom_wants_after: after.counts.wantsText,
    dom_updated: before.counts.wantsText !== after.counts.wantsText,
    fav_attr: [fav0, fav1], server_wants_now: detailWantsAfter,
    toggle_ok: fav0 === '0' && fav1 === '1',
    pass: before.counts.wantsText !== after.counts.wantsText && fav1 === '1',
  })

  out.pageErrors = pageErrors
  out.detailHitsTotal = detailHits.length
  out.file = save('03g-ac4-final', out)
  const h5fails = Object.entries(h5).filter(([k, v]) => v === false).map(([k]) => k)
  const webfails = Object.entries(web).filter(([k, v]) => v === false).map(([k]) => k)
  out.summary = { h5_false_keys: h5fails, web_false_keys: webfails, pageErrors }
  console.log('READING:', out.file)
  console.log('H5_FALSE', h5fails, 'WEB_FALSE', webfails, 'PAGEERRORS', pageErrors.length)
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
