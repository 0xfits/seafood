/**
 * 详情页改版前端探针（design §26.15 / route §49.14 · Zang 实现单自检）
 * 配方承 ops/v119-msg-panel/qa/probe-geometry-qa.mjs：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server / 零真后端 / 零库写）
 *   · 登录态 = localStorage 种子（addInitScript，token = 自造 JWT、exp 远期）
 *   · API 全部 context.route 内内存自截；views 自增 = 探针内有状态计数（后端真自增由 0057 落地后另核）
 * 用法：node probe-front.mjs <out.json>
 * 判据（对应派单 ①–⑤ + 步 2 Web 断点）：
 *   ① H5 390：四段行序 + 底栏四件 + 后两者右对齐（x 差值实测）
 *   ② Web 1536：两栏 + 价格行右端计数 + 卖家通栏 + 拼接胶囊单容器圆角 + 独立收藏同高
 *   ③ views 自增（刷新两次读数 +1）
 *   ④ 收藏 toggle ⇒ wants 变化（同一 listing_favorite 源）
 *   ⑤ 全程零 pageerror
 *   ⑥ 断点纯 CSS：同页 setViewportSize 1536→390→1536（零 reload）⇒ 两栏↔单栏 / 计数槽 / 操作栏
 *      fixed 随视口翻转 ⇒ 样式纯 CSS 媒体查询生效（无 JS innerWidth 分支的强判据）
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/item-detail/front/readings/front-probe.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
// 1×1 PNG：媒体夹具真图（假图会让 img 空盒渲染 alt 文本，几何读数仍有效但读面失真）
const PX_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
}

const MY_UID = 970213
// 伪 JWT（纯探针夹具；exp = 2100 年 ⇒ isTokenExpired 判有效；本机不验证签名）
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const FAKE_JWT = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ sub: String(MY_UID), evm: '0x9702130000000000000000000000000000000213', iat: 1760000000, exp: 4102444800 })}.probe`

// ---- 夹具（探针内内存 JSON） ------------------------------------------------------------------
const SELLER_OTHER = { uid: 970301, nickname: '0x97**01', avatar: null, credit: 'excellent' }
const SELLER_NEW = { uid: 970302, nickname: '0x97**02', avatar: null, credit: 'new' }
const SELLER_SELF = { uid: MY_UID, nickname: '0x97**13', avatar: null, credit: 'good' }

const baseRow = (over) => ({
  listing_id: 0, cid: 1, price: 1, stock: 1, status: 'listed',
  description: 'FIXTURE 描述首行\n描述第二行', title: 'FIXTURE 描述首行',
  media_urls: [], item_type: null, item_condition: null, condition: null,
  seller: SELLER_OTHER, ...over,
})

const ROWS = {
  101: baseRow({
    listing_id: 101, price: 88, stock: 3, status: 'listed',
    description: 'FIXTURE 全新未拆封耳机\n音质完美 从未拆封\n盒说齐全 顺手出',
    media_urls: ['/api/media/fx-a', '/api/media/fx-b', '/api/media/fx-c'],
    item_type: 'PhysicalFreeShip', condition: 'BrandNewSealed',
    seller: SELLER_OTHER, wants: 7, views: 0,
  }),
  102: baseRow({
    listing_id: 102, price: 12, stock: 99, status: 'listed',
    description: 'FIXTURE 数字商品卡密自动发货',
    media_urls: [], item_type: 'DigitalAutoDeliver', condition: null,
    seller: SELLER_NEW, views: 0, // 无 wants 键 ⇒ #46 该槽不渲染
  }),
  103: baseRow({
    listing_id: 103, price: 5, stock: 1, status: 'delisted',
    description: 'FIXTURE 卖家自看商品\n聊一聊整格不渲染臂',
    media_urls: ['/api/media/fx-one'], item_type: 'DigitalManualDeliver', condition: 'MinorWear',
    seller: SELLER_SELF, wants: 2, views: 0,
  }),
}

// 有状态面：views 每次成功读 +1（承 route §49.14.2 语义；fail-open 与否属后端面）
const viewState = { 101: 0, 102: 0, 103: 0 }
// 收藏面（与 wants 同源：wants = 基数 + 是否已收藏）
const favs = new Set()
const wantsOf = (id) => (ROWS[id].wants == null ? null : ROWS[id].wants + (favs.has(Number(id)) ? 1 : 0))

const apiResponse = (method, pathname, body) => {
  const data = (d) => ({ success: true, data: d })
  let m = pathname.match(/^\/api\/prize\/(\d+)$/)
  if (m && method === 'GET') {
    const id = Number(m[1])
    if (!ROWS[id]) return { success: false, error: { code: 'R107', i18n_key: 'err.notFound' } }
    viewState[id] += 1
    const row = { ...ROWS[id], wants: wantsOf(id), views: viewState[id] }
    if (row.wants == null) delete row.wants // #46 臂：响应无 wants 键
    return data(row)
  }
  if (pathname === '/api/favorites' && method === 'GET') {
    return data([...favs].map((id) => ({ listing_id: id, bID: id, time_created: '2026-10-20 10:00:00' })))
  }
  if (pathname === '/api/favorites' && method === 'POST') {
    const id = Number(body?.listing_id)
    favs.add(id)
    return data({ listing_id: id, created: true })
  }
  if ((m = pathname.match(/^\/api\/favorites\/(\d+)$/)) && method === 'DELETE') {
    favs.delete(Number(m[1]))
    return data({ listing_id: Number(m[1]), deleted: true })
  }
  if (pathname === '/api/messages/conversations' && method === 'POST') return data({ conversation_id: 55, created: true })
  if (pathname === '/api/home') return data({ tasks: [], user_points: 0, claimed_prize_ids: [], prizes: [] })
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内测量器 ------------------------------------------------------------------------------
const MEASURE = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const f = (n) => Math.round(n * 100) / 100; return { x: f(r.x), y: f(r.y), w: f(r.width), h: f(r.height), left: f(r.left), right: f(r.right), top: f(r.top), bottom: f(r.bottom) } }
  const vis = (el) => !!el && el.getClientRects().length > 0
  const vrc = (el) => vis(el) ? rc(el) : null
  const disp = (el) => (el ? getComputedStyle(el).display : null)
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null)
  const fg = (el) => (el ? getComputedStyle(el).color : null)
  const g = (m) => qa('[data-sf-m="' + m + '"]')
  const first = (m) => g(m)[0] || null
  const seller = vrc(first('item-detail-seller-row'))
  const priceRow = vrc(first('item-detail-price-row'))
  const priceNumEl = q('.sf-item-price-l .sf-item-price-num')
  const priceCurEl = q('.sf-item-price-l .sf-item-price-cur')
  const priceNum = vrc(priceNumEl)
  const priceCur = vrc(priceCurEl)
  const webTitle = vrc(q('.sf-item-web-title'))
  const tagsRow = vrc(first('item-detail-tags-secondary'))
  const coreTags = vrc(first('item-detail-tag-core'))
  const desc = vrc(first('item-detail-desc'))
  const gallery = vrc(first('item-detail-gallery'))
  const actionbar = vrc(first('item-actionbar'))
  const msgBtn = first('item-detail-msg-btn')
  const favBtn = first('fav-toggle')
  const buyBtn = first('item-buy-btn')
  const chatBtn = first('item-chat-btn')
  const countsPrice = q('[data-sf-m="item-detail-counts"][data-sf-slot="price"]')
  const countsTags = q('[data-sf-m="item-detail-counts"][data-sf-slot="tags"]')
  const thumbs = qa('[data-sf-m="item-detail-media-thumb"]')
  const navPrev = first('item-detail-media-prev')
  const navNext = first('item-detail-media-next')
  const condTag = first('item-detail-condition-tag')
  const settleTag = first('item-detail-settle-tag')
  const statusTag = first('item-detail-status-tag')
  const secTag = first('item-detail-secondary-tag')
  const wants = qa('[data-sf-m="item-detail-wants"]')
  const views = qa('[data-sf-m="item-detail-views"]')
  const cols = q('.sf-item-cols')
  const side = q('.sf-item-side')
  const grp = q('.sf-item-cta-group')
  const note = q('.sf-item-note')
  const qty = q('[data-sf-m="item-input-qty"]')
  const barLeft = q('.sf-item-bar-left')
  const barRight = q('.sf-item-bar-right')
  const favStar = favBtn ? favBtn.querySelector('svg') : null
  return {
    url: location.href,
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    hooks: {
      seller: !!seller, priceRow: !!priceRow, tagsRow: !!tagsRow, coreTags: !!coreTags,
      desc: !!desc, gallery: !!gallery, actionbar: !!actionbar,
      msg: !!msgBtn, fav: !!favBtn, buy: !!buyBtn, chat: !!chatBtn,
      note: !!note, qty: !!qty,
    },
    order: { seller: seller && seller.top, priceRow: priceRow && priceRow.top, webTitle: webTitle && webTitle.top, tagsRow: tagsRow && tagsRow.top, coreTags: coreTags && coreTags.top, desc: desc && desc.top, gallery: gallery && gallery.top, actionbar: actionbar && actionbar.top },
    rects: { seller, priceRow, priceNum, priceCur, webTitle, tagsRow, coreTags, desc, gallery, actionbar, cols: vrc(cols), side: vrc(side), grp: vrc(grp), msg: vrc(msgBtn), fav: vrc(favBtn), buy: vrc(buyBtn), chat: vrc(chatBtn), barLeft: vrc(barLeft), barRight: vrc(barRight), navPrev: vrc(navPrev), navNext: vrc(navNext), countsPrice: vrc(countsPrice), countsTags: vrc(countsTags), thumbsCol: vrc(q('.sf-item-media-thumbs')), mediaMain: vrc(q('.sf-item-media-main')) },
    colors: { priceNum: fg(priceNumEl), priceCur: fg(priceCurEl), priceNumWeight: priceNumEl ? getComputedStyle(priceNumEl).fontWeight : null, condTag: condTag ? { text: condTag.textContent, bg: bg(condTag), fg: fg(condTag), fontSize: getComputedStyle(condTag).fontSize, fontWeight: getComputedStyle(condTag).fontWeight, radius: getComputedStyle(condTag).borderRadius } : null, settleTag: settleTag ? { text: settleTag.textContent, bg: bg(settleTag) } : null, statusTag: statusTag ? { text: statusTag.textContent, bg: bg(statusTag) } : null, secTag: secTag ? { text: secTag.textContent, bg: bg(secTag), fg: fg(secTag) } : null, buy: buyBtn ? { bg: bg(buyBtn), fg: fg(buyBtn), radius: getComputedStyle(buyBtn).borderTopLeftRadius } : null, chat: chatBtn ? { bg: bg(chatBtn), fg: fg(chatBtn) } : null, favStar: favStar ? { color: fg(favStar), fill: favStar.getAttribute('fill') } : null, msg: msgBtn ? { bg: bg(msgBtn), display: disp(msgBtn) } : null, grp: grp ? { radius: getComputedStyle(grp).borderRadius, overflow: getComputedStyle(grp).overflow, gap: getComputedStyle(grp).columnGap } : null, buyCorners: buyBtn ? { tl: getComputedStyle(buyBtn).borderTopLeftRadius, tr: getComputedStyle(buyBtn).borderTopRightRadius, br: getComputedStyle(buyBtn).borderBottomRightRadius, bl: getComputedStyle(buyBtn).borderBottomLeftRadius } : null, chatCorners: chatBtn ? { tl: getComputedStyle(chatBtn).borderTopLeftRadius, tr: getComputedStyle(chatBtn).borderTopRightRadius, br: getComputedStyle(chatBtn).borderBottomRightRadius, bl: getComputedStyle(chatBtn).borderBottomLeftRadius } : null },
    bar: { position: actionbar ? null : null, actionbarPosition: (first('item-actionbar') ? getComputedStyle(first('item-actionbar')).position : null), viewportH: window.innerHeight },
    counts: { priceSlotDisplay: disp(countsPrice), tagsSlotDisplay: disp(countsTags), wantsTexts: wants.map((e) => e.textContent), viewsTexts: views.map((e) => e.textContent) },
    tags: { shipTagCount: qa('.sf-item-ship-tag').length, autoTagCount: qa('.sf-item-auto-tag').length, manualOrBuyerTagTexts: qa('[data-sf-m="item-detail-secondary-tag"]').map((e) => e.textContent) },
    media: { thumbCount: thumbs.length, thumbRects: thumbs.map(rc), activeIdx: thumbs.findIndex((e) => e.getAttribute('data-sf-active') === '1'), mainImg: (q('[data-sf-m="item-detail-thumb"]') || {}).src || null, navDisplay: disp(navPrev), navCount: qa('.sf-item-media-nav').length, prevBg: navPrev ? bg(navPrev) : null, mainImgH: (q('.sf-item-media-img') ? rc(q('.sf-item-media-img')).h : null), thumbsDirection: (q('.sf-item-media-thumbs') ? getComputedStyle(q('.sf-item-media-thumbs')).flexDirection : null) },
    descStyle: { whiteSpace: desc ? getComputedStyle(q('[data-sf-m="item-detail-desc"]')).whiteSpace : null, firstWeight: (q('.sf-item-desc-first') ? getComputedStyle(q('.sf-item-desc-first')).fontWeight : null) },
    webTitleDisplay: disp(q('.sf-item-web-title')),
    webTitleWeight: (q('.sf-item-web-title') ? getComputedStyle(q('.sf-item-web-title')).fontWeight : null),
    colsDisplay: cols ? getComputedStyle(cols).display : null,
    colsColumns: cols ? getComputedStyle(cols).gridTemplateColumns : null,
    noteText: note ? note.textContent : null,
    actionbarTexts: [...qa('[data-sf-m="item-actionbar"] button')].map((e) => e.textContent.trim()),
  }
})()`

async function settle(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.waitForSelector('[data-sf-m="item-actionbar"]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(250)
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const errors = []
  const readings = { generatedAt: new Date().toISOString(), dist: DIST, fixtures: { rows: Object.keys(ROWS).map((k) => ({ id: Number(k), item_type: ROWS[k].item_type, condition: ROWS[k].condition, hasWantsKey: ROWS[k].wants != null, media: ROWS[k].media_urls.length, sellerSelf: ROWS[k].seller.uid === MY_UID })) }, cases: {} }

  const newContext = async (viewport, mobile) => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
    context.addInitScript(([token, uid]) => {
      localStorage.setItem('user', JSON.stringify({ uID: uid, token, evm: '0x9702130000000000000000000000000000000213' }))
      localStorage.setItem('theme', 'light')
    }, [FAKE_JWT, MY_UID])
    await context.route('**/*', async (route) => {
      const req = route.request()
      const u = new URL(req.url())
      if (u.origin === ORIGIN || u.hostname === 'sf.local') {
        if (u.pathname.startsWith('/api/')) {
          if (u.pathname.startsWith('/api/media/')) {
            return route.fulfill({ status: 200, contentType: 'image/png', body: PX_PNG })
          }
          let body = null
          try { body = req.postDataJSON() } catch { body = null }
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname, body)) })
        }
        const rel = u.pathname === '/' ? '/index.html' : u.pathname
        const file = path.join(DIST, rel)
        if (!fs.existsSync(file)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'index.html')) })
        return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })
    context.on('pageerror', (e) => errors.push({ where: 'pageerror', message: String(e) }))
    return context
  }

  const measure = (page) => page.evaluate(MEASURE)

  // ---------- ① H5 390 ----------
  {
    const ctx = await newContext({ width: 390, height: 844 }, true)
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/item/101`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const m101 = await measure(page)
    // 触摸滚到中段再量底栏（fixed 判据）
    const beforeBar = m101.rects.actionbar
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(200)
    const afterBar = (await measure(page)).rects.actionbar
    // 换第 2 张缩略图（画廊互斥臂）
    await page.evaluate(() => { const t = document.querySelectorAll('[data-sf-m="item-detail-media-thumb"]')[1]; if (t) t.click() })
    await page.waitForTimeout(150)
    const m101b = await measure(page)
    // ②③④⑤ 其余夹具
    await page.goto(`${ORIGIN}/item/102`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const m102 = await measure(page)
    await page.goto(`${ORIGIN}/item/103`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const m103 = await measure(page)

    // ③ views 自增：刷新两次
    await page.goto(`${ORIGIN}/item/101`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const v1 = (await measure(page)).counts.viewsTexts
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settle(page)
    const v2 = (await measure(page)).counts.viewsTexts

    // ④ 收藏 toggle ⇒ wants 变化（toggle → reload → wants+1 → 再 toggle → reload → 还原）
    await page.goto(`${ORIGIN}/item/101`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const wantsBefore = (await measure(page)).counts.wantsTexts
    await page.evaluate(() => document.querySelector('[data-sf-m="fav-toggle"]').click())
    await page.waitForTimeout(400)
    const favAfterClick = await page.evaluate(`(() => { const b = document.querySelector('[data-sf-m="fav-toggle"]'); return { pressed: b.getAttribute('aria-pressed'), sfFav: b.getAttribute('data-sf-fav'), starColor: getComputedStyle(b.querySelector('svg')).color } })()`)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settle(page)
    const wantsAfter = (await measure(page)).counts.wantsTexts
    const favPersisted = await page.evaluate(`(() => { const b = document.querySelector('[data-sf-m="fav-toggle"]'); return { pressed: b.getAttribute('aria-pressed'), starColor: getComputedStyle(b.querySelector('svg')).color } })()`)
    await page.evaluate(() => document.querySelector('[data-sf-m="fav-toggle"]').click())
    await page.waitForTimeout(400)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settle(page)
    const wantsRestored = (await measure(page)).counts.wantsTexts

    readings.cases.h5_390 = {
      item101: m101, item101BarAfterScroll: afterBar, item101ThumbSwitch: { activeIdx: m101b.media.activeIdx, mainImg: m101b.media.mainImg },
      item102: m102, item103: m103,
      viewsIncrement: { first: v1, second: v2 },
      favToggle: { wantsBefore, favAfterClick, wantsAfterReload: wantsAfter, favPersisted, wantsRestored },
      barFixed: { before: beforeBar, after: afterBar },
    }
    await ctx.close()
  }

  // ---------- ② Web 1536 ----------
  {
    const ctx = await newContext({ width: 1536, height: 960 }, false)
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/item/101`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const m101 = await measure(page)
    // 轮播：点 next ⇒ 选中缩略图下移一格
    await page.evaluate(() => document.querySelector('[data-sf-m="item-detail-media-next"]').click())
    await page.waitForTimeout(150)
    const m101Next = await measure(page)
    await page.goto(`${ORIGIN}/item/102`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const m102 = await measure(page)
    await page.goto(`${ORIGIN}/item/103`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const m103 = await measure(page)
    readings.cases.web_1536 = { item101: m101, item101AfterNext: { activeIdx: m101Next.media.activeIdx }, item102: m102, item103: m103 }
    await ctx.close()
  }

  // ---------- ⑥ 断点纯 CSS（改视口不刷新：1536→390→1536 往返）----------
  //   判据：同一页面仅 setViewportSize（零 reload / 零导航）⇒ 两栏↔单栏、计数槽换位、操作栏 static↔fixed
  //   随视口翻转 ⇒ 样式纯 CSS 媒体查询生效（JS innerWidth 分支若无 resize 重渲染监听则不会翻转）。
  {
    const ctx = await newContext({ width: 1536, height: 960 }, false)
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/item/101`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const wide1 = await measure(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const narrow = await measure(page)
    await page.setViewportSize({ width: 1536, height: 960 })
    await page.waitForTimeout(300)
    const wide2 = await measure(page)
    readings.cases.viewport_css_only = {
      url: page.url(),
      wide1: { colsDisplay: wide1.colsDisplay, colsColumns: wide1.colsColumns, countsPriceDisplay: wide1.counts.priceSlotDisplay, navDisplay: wide1.media.navDisplay, barPosition: wide1.bar.actionbarPosition, webTitleDisplay: wide1.webTitleDisplay },
      narrow: { colsDisplay: narrow.colsDisplay, colsColumns: narrow.colsColumns, countsPriceDisplay: narrow.counts.priceSlotDisplay, countsTagsDisplay: narrow.counts.tagsSlotDisplay, navDisplay: narrow.media.navDisplay, barPosition: narrow.bar.actionbarPosition, webTitleDisplay: narrow.webTitleDisplay, msgVisible: narrow.rects.msg != null },
      wide2: { colsDisplay: wide2.colsDisplay, colsColumns: wide2.colsColumns, countsPriceDisplay: wide2.counts.priceSlotDisplay, navDisplay: wide2.media.navDisplay, barPosition: wide2.bar.actionbarPosition },
    }
    await ctx.close()
  }

  readings.pageErrors = errors
  // ---- 派单判据（①–⑤ + 断点纯 CSS）逐条落布尔，全部由上方原始读数推导 ----
  const w = readings.cases.web_1536 ? readings.cases.web_1536.item101 : null
  const h = readings.cases.h5_390 ? readings.cases.h5_390.item101 : null
  const vp = readings.cases.viewport_css_only || null
  const tracks = (s) => (s && s !== 'none' ? String(s).trim().split(/\s+/).length : 0)
  const vOverlap = (a, b) => (a && b ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) : null)
  const wv = w && vp ? {
    twoColsGrid: w.colsDisplay === 'grid' && tracks(w.colsColumns) === 2,
    // 左栏 = 缩略图列（纵向）在主图左侧 + 双白圆箭头在场（多图夹具 101）
    mediaLeftThumbsColumn: w.media.thumbsDirection === 'column' && w.rects.thumbsCol && w.rects.mediaMain
      && w.rects.thumbsCol.right <= w.rects.mediaMain.left + 1
      && w.media.navCount === 2 && w.rects.navPrev != null && w.rects.navNext != null
      && w.media.prevBg === 'rgb(255, 255, 255)',
    // 价格行右端计数：与价格同水平（垂直重叠 > 0）且右缘贴齐行右缘
    countsRightSameLevel: (() => {
      const o = vOverlap(w.rects.countsPrice, w.rects.priceNum)
      return o == null ? null : (o > 0 && Math.abs(w.rects.countsPrice.right - w.rects.priceRow.right) <= 2 && w.rects.countsPrice.left >= w.rects.priceNum.right)
    })(),
    // 卖家通栏：整行横跨与两栏区同宽、且位于两栏区之上
    sellerBandFullWidth: w.rects.seller && w.rects.cols
      ? Math.abs((w.rects.seller.right - w.rects.seller.left) - (w.rects.cols.right - w.rects.cols.left)) <= 2 && w.rects.seller.bottom <= w.rects.cols.top + 1
      : null,
    // 拼接胶囊：单容器 pill 圆角 + overflow hidden + 中缝直角（左段 chat 左角 0 / 右段 buy 右角 0）
    capsuleJoined: w.colors.grp && w.colors.buyCorners && w.colors.chatCorners
      ? w.colors.grp.radius === '999px' && w.colors.grp.overflow === 'hidden'
        && [w.colors.chatCorners.tl, w.colors.chatCorners.bl].every((v) => v === '0px')
        && [w.colors.buyCorners.tr, w.colors.buyCorners.br].every((v) => v === '0px')
      : null,
    // Web 独立收藏胶囊同高（与拼接组同高带；读数键 = h，非 height）
    favSameHeight: w.rects.fav && w.rects.grp ? Math.abs(w.rects.fav.h - w.rects.grp.h) <= 2 : null,
    webTitleBold: w.webTitleDisplay === 'block' && w.webTitleWeight === '700',
    msgHiddenOnWeb: w.colors.msg ? w.colors.msg.display === 'none' : null,
  } : null
  const hv = h ? {
    singleColFlex: h.colsDisplay === 'flex',
    barFixed: h.bar.actionbarPosition === 'fixed',
    webTitleHidden: h.webTitleDisplay === 'none',
    countsMobVisibleDeskHidden: h.counts.tagsSlotDisplay === 'flex' && h.counts.priceSlotDisplay === 'none',
    msgVisible: h.rects.msg != null,
    zeroOverflow: h.overflowPx === 0,
  } : null
  const vpv = vp ? {
    gridFlexGridNoReload: vp.wide1.colsDisplay === 'grid' && vp.narrow.colsDisplay === 'flex' && vp.wide2.colsDisplay === 'grid',
    countsSlotSwapped: vp.wide1.countsPriceDisplay === 'flex' && vp.narrow.countsPriceDisplay === 'none' && vp.narrow.countsTagsDisplay === 'flex',
    barStaticThenFixed: vp.wide1.barPosition === 'static' && vp.narrow.barPosition === 'fixed',
    navShownWideHiddenNarrow: (vp.wide1.navDisplay !== 'none' && vp.wide2.navDisplay !== 'none' && vp.narrow.navDisplay === 'none'),
    // ↑ 宽档计算值为 'flex' 而非 'inline-flex'：position:absolute 使 inline-flex 块化（CSS 规范行为），非缺陷
    webTitleShownWideHiddenNarrow: vp.wide1.webTitleDisplay === 'block' && vp.narrow.webTitleDisplay === 'none',
    urlUnchanged: typeof vp.url === 'string' && vp.url.endsWith('/item/101'),
  } : null
  readings.verdict = {
    pageErrorCount: errors.length,
    web1536: wv,
    h5_390: hv,
    viewportCssOnly: vpv,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(readings, null, 2))
  console.log(`saved: ${OUT}`)
  console.log(`pageErrors: ${errors.length}`)
  await browser.close()
}

run().catch((e) => { console.error('PROBE CRASH:', e); process.exit(1) })
