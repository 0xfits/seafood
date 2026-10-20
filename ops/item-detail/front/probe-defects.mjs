/**
 * 详情页两缺陷回归探针（独立质检 2026-10-20 · Zang 修复自检）
 *   · 缺陷 1：收藏 toggle 不联动「x人想要」计数（本地 wants 未调整）
 *   · 缺陷 2：一次挂载发 2 条 `GET /api/prize/<id>`（数据 effect 依赖 [id,user,t] 抖动）⇒ 每次刷新 views +2、
 *            DOM 读数与库值错位
 * 配方承 ops/item-detail/front/probe-front.mjs：context.route 把 http://sf.local/** 映射到磁盘 dist
 * （零 dev server / 零真后端 / 零库写），登录态 = localStorage 种子（伪 JWT，exp 远期）；
 * 详情读口在探针内做**有状态计数**（每次成功读 +1 = off 档真口径），`wants` 由 `favs` 集合派生
 * （= 后端 `listing_favorite` 聚合同一真源）。
 * 用法：node probe-defects.mjs <out.json>
 *       QA_DIST=<dir> node probe-defects.mjs <out.json>   # 指向任意构建产物做反事实对拍
 * 判据（双档 390 / 1536 各跑一遍，逐条落布尔）：
 *   ① 收藏 toggle：点收藏 ⇒ 立即 `1人想要`（零 reload，100ms 步进采样），再点 ⇒ 立即 `0人想要`；两向均不重拉详情
 *   ② 一次挂载 = 1 条详情请求（连续 3 次刷新均 1，page.on('request') 计数）
 *   ③ 切 id（SPA 内 pushState+popstate，零文档刷新）= 恰好 1 条新 id 请求，DOM 换成新 id 读数
 *   ④ views 显示值 = 服务端（探针内计数）库值
 *   ⑤ 登录态实质变化（uID 变）⇒ 重拉 1 次；同一 uID 的新对象引用 ⇒ 0 次（缺陷 2 的根因臂）
 *   ⑥ 过期响应丢弃：先发的慢响应（900ms）后到 ⇒ 不得覆盖后发的快响应读数（DOM 取最新一次）
 *   ⑦ 全程零 pageerror / 零 console.error
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/item-detail/front/readings/front-defects.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const PX_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
}

const MY_UID = 970213
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const FAKE_JWT = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ sub: String(MY_UID), evm: '0x9702130000000000000000000000000000000213', iat: 1760000000, exp: 4102444800 })}.probe`

const SELLER_OTHER = { uid: 970301, nickname: '0x97**01', avatar: null, credit: 'excellent' }

const baseRow = (over) => ({
  listing_id: 0, cid: 1, price: 1, stock: 1, status: 'listed',
  description: 'FIXTURE 描述首行\n描述第二行', title: 'FIXTURE 描述首行',
  media_urls: [], item_type: null, item_condition: null, condition: null,
  seller: SELLER_OTHER, ...over,
})

// 104 = 缺陷 1 主夹具：`wants` 基线 0（复刻质检现场「0人想要」）；101/103 供切 id 臂
const ROWS = {
  101: baseRow({ listing_id: 101, price: 88, stock: 3, description: 'FIXTURE 耳机\n第二行', wants: 7, media_urls: ['/api/media/fx-a'] }),
  103: baseRow({ listing_id: 103, price: 5, stock: 1, description: 'FIXTURE 相机\n第二行', wants: 2 }),
  104: baseRow({ listing_id: 104, price: 30, stock: 2, description: 'FIXTURE 收藏臂商品\n第二行', wants: 0 }),
}

// ---- 服务端面（探针内状态；口径同后端 off 档）----------------------------------------------
const viewState = { 101: 0, 103: 0, 104: 0 }   // 每次成功读 +1
const favs = new Set()                         // 我的收藏（wants 的真源计数）
const wantsOf = (id) => (ROWS[id].wants == null ? null : ROWS[id].wants + (favs.has(Number(id)) ? 1 : 0))

let issueIdx = 0
const issued = []     // { id, idx, views } —— 请求**发出**顺序（过期判定的依据）
const delays = {}     // id → 本臂内一次性延迟（毫秒）

const apiResponse = (method, pathname, body) => {
  const data = (d) => ({ success: true, data: d })
  let m = pathname.match(/^\/api\/prize\/(\d+)$/)
  if (m && method === 'GET') {
    const id = Number(m[1])
    if (!ROWS[id]) return { success: false, error: { code: 'R107', i18n_key: 'err.notFound' } }
    viewState[id] += 1
    const idx = ++issueIdx
    const row = { ...ROWS[id], wants: wantsOf(id), views: viewState[id] }
    issued.push({ id, idx, views: viewState[id] })
    if (row.wants == null) delete row.wants
    return { __id: id, __idx: idx, payload: data(row) }
  }
  if (pathname === '/api/favorites' && method === 'GET') {
    return data([...favs].map((id) => ({ listing_id: id, bID: id, time_created: '2026-10-20 10:00:00' })))
  }
  if (pathname === '/api/favorites' && method === 'POST') {
    const id = Number(body?.listing_id)
    favs.add(id)
    return data({ listing_id: id, created: true })   // ★ 现状：写口**不**回 wants ⇒ 前端须本地联动
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

// ---- 页内读数 ------------------------------------------------------------------------------
const MEASURE = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const favBtn = q('[data-sf-m="fav-toggle"]')
  const note = q('.sf-item-note')
  const num = (s) => { const t = (s || '').match(/(\\d+)/); return t ? Number(t[1]) : null }
  const wantsTexts = qa('[data-sf-m="item-detail-wants"]').map((e) => e.textContent)
  const viewsTexts = qa('[data-sf-m="item-detail-views"]').map((e) => e.textContent)
  return {
    url: location.href,
    fav: favBtn ? {
      pressed: favBtn.getAttribute('aria-pressed'),
      sfFav: favBtn.getAttribute('data-sf-fav'),
      label: favBtn.textContent.trim(),
      starColor: getComputedStyle(favBtn.querySelector('svg')).color,
      starFill: favBtn.querySelector('svg').getAttribute('fill'),
    } : null,
    wants: { texts: wantsTexts, uniq: [...new Set(wantsTexts.map(num))] },
    views: { texts: viewsTexts, uniq: [...new Set(viewsTexts.map(num))] },
    noteText: note ? note.textContent : null,
    noteId: note ? num(note.textContent) : null,
  }
})()`

async function settle(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.waitForSelector('[data-sf-m="item-actionbar"]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(400)
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const errors = []
  const consoleErrors = []
  const readings = {
    generatedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: Object.entries(ROWS).map(([k, v]) => ({ id: Number(k), wantsBase: v.wants })),
    cases: {},
  }

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
          const out = apiResponse(req.method(), u.pathname, body)
          // 详情读口回 { __id, __idx, payload }（带请求序），其余口回裸 payload
          const id = out && out.__id
          const payload = out && out.payload ? out.payload : out
          if (id != null && delays[id]) {
            const ms = delays[id]
            delete delays[id]
            await new Promise((r) => setTimeout(r, ms))   // 慢响应臂：请求已发出，响应故意延后
          }
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
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

  // 详情请求计数器（per page；reset() 后只数本轮）
  const detailHits = (page) => {
    const hits = []
    page.on('request', (r) => {
      const m = r.url().match(/\/api\/prize\/(\d+)/)
      if (m && r.method() === 'GET') hits.push(Number(m[1]))
    })
    return { hits, ids: () => hits.slice(), reset: () => { hits.length = 0 }, count: () => hits.length }
  }

  const arm = async (viewport, mobile, label) => {
    const ctx = await newContext(viewport, mobile)
    const page = await ctx.newPage()
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`${label}: ${msg.text().slice(0, 200)}`) })
    const counter = detailHits(page)
    const m = () => page.evaluate(MEASURE)
    const out = { viewport, label }

    // ---------- ② 一次挂载 = 1 条详情请求（3 次刷新） ----------
    const perLoad = []
    for (let i = 0; i < 3; i += 1) {
      counter.reset()
      if (i === 0) await page.goto(`${ORIGIN}/item/104`, { waitUntil: 'domcontentloaded' })
      else await page.reload({ waitUntil: 'domcontentloaded' })
      await settle(page)
      const r = await m()
      perLoad.push({
        kind: i === 0 ? 'goto' : 'reload',
        count: counter.count(),
        ids: counter.ids(),
        domViews: r.views.uniq,
        domWants: r.wants.uniq,
        noteId: r.noteId,
      })
    }

    // ---------- ① 收藏 toggle ⇒ wants 立即联动（零 reload / 零详情重拉） ----------
    counter.reset()
    const before = await m()
    await page.evaluate(() => document.querySelector('[data-sf-m="fav-toggle"]').click())
    const timeline = []
    for (let i = 0; i < 6; i += 1) {
      await page.waitForTimeout(100)          // 100ms 步进：直证「不 reload 即变」
      const t = await m()
      timeline.push({ tMs: (i + 1) * 100, wants: t.wants.texts, sfFav: t.fav ? t.fav.sfFav : null, label: t.fav ? t.fav.label : null })
    }
    const afterFav = await m()
    const hitsOnFav = counter.count()
    await page.evaluate(() => document.querySelector('[data-sf-m="fav-toggle"]').click())
    await page.waitForTimeout(500)
    const afterUnfav = await m()
    const hitsOnUnfav = counter.count() - hitsOnFav
    // 服务端真值对账：reload 后计数须与本地即时读数一致（本地增量方向正确）
    counter.reset()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settle(page)
    const afterReload = await m()

    // ---------- ③ 切 id（SPA 内 pushState + popstate，零文档刷新）----------
    counter.reset()
    await page.evaluate(() => {
      window.history.pushState({}, '', '/item/101')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(900)
    const switched = await m()
    const switchHits = counter.ids()
    const viewsAtSwitch = viewState[101]   // ★ 必须在此刻取（后续登录态/过期臂还会再打 101）

    // ---------- ⑤ 登录态臂：同一 uID 新对象 ⇒ 0 次；uID 变 ⇒ 1 次 ----------
    counter.reset()
    await page.evaluate(([token, uid]) => {
      localStorage.setItem('user', JSON.stringify({ uID: uid, token, nickname: 'same-uid-new-object' }))
      window.dispatchEvent(new Event('jinli:auth-change'))
    }, [FAKE_JWT, MY_UID])
    await page.waitForTimeout(700)
    const sameUidHits = counter.count()
    counter.reset()
    await page.evaluate(([token, uid]) => {
      localStorage.setItem('user', JSON.stringify({ uID: uid, token }))
      window.dispatchEvent(new Event('jinli:auth-change'))
    }, [FAKE_JWT, 970299])
    await page.waitForTimeout(700)
    const newUidHits = counter.ids()
    const afterUidChange = await m()

    // ---------- ⑥ 过期响应丢弃：先发慢响应（900ms）后到，不得覆盖后发的快响应 ----------
    delays[101] = 900
    counter.reset()
    const issuedFrom = issued.length
    await page.goto(`${ORIGIN}/item/101`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(200)   // 慢请求在飞
    await page.evaluate(([token, uid]) => {
      localStorage.setItem('user', JSON.stringify({ uID: uid, token }))
      window.dispatchEvent(new Event('jinli:auth-change'))
    }, [FAKE_JWT, 970288])          // uID 变 ⇒ 触发第 2 条（快）
    await page.waitForTimeout(1800)  // 等慢响应也落地
    const staleResult = await m()
    const issuedWindow = issued.slice(issuedFrom).filter((s) => s.id === 101)
    const firstIssued = issuedWindow[0] || null                       // 先发（慢，后到）
    const lastIssued = issuedWindow[issuedWindow.length - 1] || null  // 后发（快，先落）

    out.requestPerMount = perLoad
    out.favToggle = {
      before: { wants: before.wants, fav: before.fav },
      timeline,
      afterFav: { wants: afterFav.wants, fav: afterFav.fav },
      afterUnfav: { wants: afterUnfav.wants, fav: afterUnfav.fav },
      hitsOnFav,
      hitsOnUnfav,
      afterReload: { wants: afterReload.wants, fav: afterReload.fav },
      serverWants: wantsOf(104),
    }
    out.idSwitch = {
      hits: switchHits,
      noteId: switched.noteId,
      wants: switched.wants.uniq,
      domViews: switched.views.uniq,
      serverViews101: viewsAtSwitch,
      url: switched.url,
    }
    out.authIdentity = { sameUidHits, newUidHits, wantsAfterUidChange: afterUidChange.wants.uniq }
    out.stale = {
      requestsInWindow: counter.count(),
      issuedWindow,
      domViews: staleResult.views.uniq,
      lastIssuedViews: lastIssued ? lastIssued.views : null,
      firstIssuedViews: firstIssued ? firstIssued.views : null,
    }

    await ctx.close()
    return out
  }

  readings.cases.h5_390 = await arm({ width: 390, height: 844 }, true, 'h5_390')
  readings.cases.web_1536 = await arm({ width: 1536, height: 960 }, false, 'web_1536')
  readings.pageErrors = errors
  readings.consoleErrors = consoleErrors

  // ---- 判据（逐条布尔，全部由上读原始读数推导）----
  const one = (arr) => Array.isArray(arr) && arr.length === 1
  const leadNum = (t) => Number((String(t).match(/\d+/) || [])[0])
  const judge = (c) => {
    if (!c) return null
    const f = c.favToggle
    const v = {
      // ① 收藏 toggle ⇒ wants 双向即时联动
      wantsBeforeZero: one(f.before.wants.uniq) && f.before.wants.uniq[0] === 0,
      wantsOneAfterFav: one(f.afterFav.wants.uniq) && f.afterFav.wants.uniq[0] === 1,
      wantsZeroAfterUnfav: one(f.afterUnfav.wants.uniq) && f.afterUnfav.wants.uniq[0] === 0,
      // 零 reload：点后 600ms 内的采样里已出现 `1人想要`（两槽同值）
      wantsFlippedWithoutReload: f.timeline.some((s) => s.wants.length > 0 && s.wants.every((t) => leadNum(t) === 1)),
      favFlagOn: !!f.afterFav.fav && f.afterFav.fav.sfFav === '1' && f.afterFav.fav.pressed === 'true',
      favFlagOff: !!f.afterUnfav.fav && f.afterUnfav.fav.sfFav === '0' && f.afterUnfav.fav.pressed === 'false',
      noDetailRefetchOnToggle: f.hitsOnFav === 0 && f.hitsOnUnfav === 0,
      localMatchesServerOnReload: one(f.afterReload.wants.uniq) && f.afterReload.wants.uniq[0] === 0,
      // ② 一次挂载 = 1 条详情请求
      oneRequestPerMount: c.requestPerMount.every((p) => p.count === 1),
      mountCounts: c.requestPerMount.map((p) => p.count),
      // ③ 切 id 重拉 1 次且 DOM 跟随
      idSwitchOneRequest: c.idSwitch.hits.length === 1 && c.idSwitch.hits[0] === 101,
      idSwitchDomFollows: c.idSwitch.noteId === 101,
      // ④ views 显示值 = 库值
      viewsEqualsServer: one(c.idSwitch.domViews) && c.idSwitch.domViews[0] === c.idSwitch.serverViews101,
      // ⑤ 登录态：同一 uID 对象抖动不重拉；uID 变重拉 1 次
      sameUidNoRefetch: c.authIdentity.sameUidHits === 0,
      newUidRefetchOnce: c.authIdentity.newUidHits.length === 1 && c.authIdentity.newUidHits[0] === 101,
      // ⑥ 过期响应丢弃（DOM 取后发那条 = 最新一次）
      staleDiscarded: (() => {
        const s = c.stale
        if (!s || !one(s.domViews) || s.lastIssuedViews == null || s.firstIssuedViews == null) return null
        return s.domViews[0] === s.lastIssuedViews && s.lastIssuedViews !== s.firstIssuedViews
      })(),
    }
    const keys = [
      'wantsBeforeZero', 'wantsOneAfterFav', 'wantsZeroAfterUnfav', 'wantsFlippedWithoutReload',
      'favFlagOn', 'favFlagOff', 'noDetailRefetchOnToggle', 'localMatchesServerOnReload',
      'oneRequestPerMount', 'idSwitchOneRequest', 'idSwitchDomFollows', 'viewsEqualsServer',
      'sameUidNoRefetch', 'newUidRefetchOnce', 'staleDiscarded',
    ]
    v.allGreen = keys.every((k) => v[k] === true)
    return v
  }
  readings.verdict = {
    pageErrorCount: errors.length,
    consoleErrorCount: consoleErrors.length,
    h5_390: judge(readings.cases.h5_390),
    web_1536: judge(readings.cases.web_1536),
    zeroPageErrors: errors.length === 0,
    zeroConsoleErrors: consoleErrors.length === 0,
  }
  readings.verdict.allGreen = readings.verdict.zeroPageErrors && readings.verdict.zeroConsoleErrors
    && readings.verdict.h5_390?.allGreen === true
    && readings.verdict.web_1536?.allGreen === true

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(readings, null, 2))
  console.log(`saved: ${OUT}`)
  console.log(`pageErrors: ${errors.length} consoleErrors: ${consoleErrors.length}`)
  console.log(JSON.stringify({
    h5: readings.verdict.h5_390 && {
      allGreen: readings.verdict.h5_390.allGreen,
      mountCounts: readings.verdict.h5_390.mountCounts,
      red: Object.entries(readings.verdict.h5_390).filter(([, v]) => v === false).map(([k]) => k),
    },
    web: readings.verdict.web_1536 && {
      allGreen: readings.verdict.web_1536.allGreen,
      mountCounts: readings.verdict.web_1536.mountCounts,
      red: Object.entries(readings.verdict.web_1536).filter(([, v]) => v === false).map(([k]) => k),
    },
    allGreen: readings.verdict.allGreen,
  }))
  await browser.close()
  if (!readings.verdict.allGreen) process.exitCode = 2
}

run().catch((e) => { console.error('PROBE CRASH:', e); process.exit(1) })
