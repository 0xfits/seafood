/**
 * Neng 独立质检探针 ①：AC-1（底色三层 · 390/1440/1600 × 日/夜）· AC-2（价格块版式）· AC-3（整卡可点击 · 四语）
 * 用法：node ops/ui-card-ref-20261017/qa/neng-probe-ac123.mjs <out.json>
 * 零服务 / 零后端 / 零库写；dist = 改后本地 build。
 */
import path from 'node:path'
import {
  REPO, CUR_DIST, chromium, open, goto, settle, writeJson,
} from './neng-lib.mjs'

const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-readings-ac123.json')

const MEASURE = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const bg = (el) => { const c = cs(el); return c ? c.backgroundColor : null }
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) } }
  const baselineOf = (el) => {
    if (!el) return null
    const s = document.createElement('span')
    s.setAttribute('style', 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline')
    el.appendChild(s)
    const b = round(s.getBoundingClientRect().bottom)
    s.remove()
    return b
  }
  const card = document.querySelector('[data-sf-m="reward-card"]')
  const shell = document.querySelector('.sf-shell')
  const rc = document.querySelector('.sf-route-container')
  const top = document.querySelector('.sf-region-top')
  const priceBox = card ? card.querySelector('.sf-reward-price') : null
  const cur = card ? card.querySelector('.sf-reward-price-cur') : null
  const num = card ? card.querySelector('.sf-reward-price-num') : null
  const cta = card ? card.querySelector('[data-sf-m="reward-card-view"]') : null
  const pcs = cs(priceBox); const ccs = cs(cur); const ncs = cs(num)
  const rootCs = cs(document.documentElement)
  const regions = [...document.querySelectorAll('[data-sf-region]')].map((e) => e.getAttribute('data-sf-region'))

  let price = null
  if (cur && num && priceBox) {
    const cr = rect(cur); const nr = rect(num)
    const pcs2 = cs(priceBox)
    price = {
      sameParent: cur.parentElement === num.parentElement,
      parentDisplay: pcs2.display,
      parentFlexDirection: pcs2.flexDirection,
      parentAlignItems: pcs2.alignItems,
      parentBorderWidth: [pcs2.borderTopWidth, pcs2.borderRightWidth, pcs2.borderBottomWidth, pcs2.borderLeftWidth].join('/'),
      parentBackground: pcs2.backgroundColor,
      parentPadding: [pcs2.paddingTop, pcs2.paddingRight, pcs2.paddingBottom, pcs2.paddingLeft].join('/'),
      order: [...priceBox.children].map((c) => (c.classList.contains('sf-reward-price-cur') ? 'cur' : c.classList.contains('sf-reward-price-num') ? 'num' : c.tagName)),
      cur: { rect: cr, fontSize: ccs.fontSize, fontWeight: ccs.fontWeight, color: ccs.color, text: cur.textContent, tag: cur.tagName },
      num: { rect: nr, fontSize: ncs.fontSize, fontWeight: ncs.fontWeight, color: ncs.color, text: num.textContent },
      heightRatio: nr.h ? round(cr.h / nr.h) : null,
      curBaseline: baselineOf(cur),
      numBaseline: baselineOf(num),
      baselineDelta: round(Math.abs(baselineOf(cur) - baselineOf(num))),
      curIsSpan: cur.tagName === 'SPAN',
    }
  }

  // 详情页底部操作栏（AC-5 归因面锚）
  const actionbar = document.querySelector('.sf-item-actionbar')

  return {
    url: location.href, pathname: location.pathname,
    theme: document.documentElement.getAttribute('data-theme'),
    colorScheme: cs(document.documentElement).colorScheme,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    bg: { shell: bg(shell), routeContainer: bg(rc), regionTop: bg(top) },
    tokens: {
      atRootPageBg: rootCs.getPropertyValue('--sf-page-bg').trim(),
      atRootSurfaceBg: rootCs.getPropertyValue('--sf-surface-bg').trim(),
      atRootNumFg: rootCs.getPropertyValue('--sf-price-num-fg').trim(),
      atRootCurFg: rootCs.getPropertyValue('--sf-price-cur-fg').trim(),
      atCardNumFg: cs(card) ? cs(card).getPropertyValue('--sf-price-num-fg').trim() : null,
      atCardCurFg: cs(card) ? cs(card).getPropertyValue('--sf-price-cur-fg').trim() : null,
    },
    cardCount: document.querySelectorAll('[data-sf-m="reward-card"]').length,
    card: card ? {
      tagName: card.tagName, href: card.getAttribute('href'), dataSfM: card.getAttribute('data-sf-m'),
      nestedInteractiveCount: card.querySelectorAll('a,button,input,select,textarea').length,
      nestedInteractiveTags: [...card.querySelectorAll('a,button,input,select,textarea')].map((e) => e.tagName),
      childTag: card.firstElementChild ? card.firstElementChild.tagName : null,
    } : null,
    cta: cta ? { present: true, tagName: cta.tagName, hook: cta.getAttribute('data-sf-m'), text: (cta.textContent || '').trim() } : { present: false },
    price,
    actionbarBackground: actionbar ? bg(actionbar) : null,
    regions: regions.filter((v, i) => regions.indexOf(v) === i),
    regionCountAll: regions.length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    // 观察点②：灰页底可见宽度（容器左缘 / 右缘之外的页底色带）
    greyBands: (() => {
      if (!rc) return null
      const r = rc.getBoundingClientRect()
      return { leftBand: round(r.left), rightBand: round(window.innerWidth - r.right), containerWidth: round(r.width), innerWidth: window.innerWidth }
    })(),
  }
})()`

const BLANK_POINT = `(() => {
  const card = document.querySelector('[data-sf-m="reward-card"]')
  if (!card) return { ok: false, reason: 'no-card' }
  card.scrollIntoView({ block: 'center' })
  const r = card.getBoundingClientRect()
  const inner = card.firstElementChild
  const strict = []
  for (let fx = 3; fx < r.width - 3; fx += 4) {
    for (let fy = 3; fy < r.height - 3; fy += 4) {
      const x = Math.round(r.left + fx); const y = Math.round(r.top + fy)
      if (x < 2 || y < 2 || x > window.innerWidth - 2 || y > window.innerHeight - 2) continue
      const el = document.elementFromPoint(x, y)
      if (!el || !card.contains(el)) continue
      if (el.closest('[data-sf-m="reward-card-view"]')) continue
      if (el === card || el === inner) strict.push({ x, y, hit: el === card ? 'card-root' : 'card-inner-box' })
    }
  }
  return { ok: strict.length > 0, pick: strict[0] || null, strictCount: strict.length }
})()`

const ok = (v) => v === true
async function main() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const out = {
    probe: 'neng-probe-ac123.mjs（Neng 质检员 · 自写自跑）',
    startedAt: new Date().toISOString(), dist: CUR_DIST,
    states: {}, clicks: {}, rulerSensitivity: {}, ac: {}, pageErrors: [], consoleErrors: [], notes: {},
  }
  const pageErrors = []; const consoleErrors = []
  const openPage = async (theme, viewport, locale) => {
    const { context, page } = await open(browser, { theme, viewport, dist: CUR_DIST, locale })
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message).slice(0, 200)))
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
    return { context, page }
  }

  // ============ AC-1 / AC-2：三档宽度 × 日/夜 ============
  const MATRIX = [
    ['390_day', 'light', { width: 390, height: 844 }],
    ['390_night', 'dark', { width: 390, height: 844 }],
    ['1440_day', 'light', { width: 1440, height: 900 }],
    ['1440_night', 'dark', { width: 1440, height: 900 }],
    ['1600_day', 'light', { width: 1600, height: 900 }],
    ['1600_night', 'dark', { width: 1600, height: 900 }],
  ]
  for (const [label, theme, viewport] of MATRIX) {
    const { context, page } = await openPage(theme, viewport)
    await goto(page, '/', { waitSel: '[data-sf-m="reward-card"]' })
    out.states[label] = await page.evaluate(MEASURE)
    await context.close()
  }

  // ============ AC-3：四语 href + 真点卡片空白区 ============
  for (const [lang, url] of [['zh', '/'], ['en', '/en'], ['hk', '/hk'], ['vn', '/vn']]) {
    const { context, page } = await openPage('light', { width: 1280, height: 900 }, lang === 'zh' ? 'zh-CN' : 'en-US')
    await goto(page, url, { waitSel: '[data-sf-m="reward-card"]' })
    const before = await page.evaluate(`(() => ({
      pathname: location.pathname,
      hrefs: [...document.querySelectorAll('[data-sf-m="reward-card"]')].map(a=>a.getAttribute('href')),
      roots: [...document.querySelectorAll('[data-sf-m="reward-card"]')].map(a=>a.tagName),
      nested: [...document.querySelectorAll('[data-sf-m="reward-card"]')].map(a=>a.querySelectorAll('a,button,input,select,textarea').length),
      ctaTag: (()=>{const c=document.querySelector('[data-sf-m="reward-card-view"]');return c?c.tagName:null})(),
      ctaText: (()=>{const c=document.querySelector('[data-sf-m="reward-card-view"]');return c?(c.textContent||'').trim():null})(),
    }))()`)
    const bp = await page.evaluate(BLANK_POINT)
    const rec = { url, before, blankPoint: bp }
    if (bp.ok) {
      await page.mouse.click(bp.pick.x, bp.pick.y)
      try { await page.waitForFunction(`location.pathname !== ${JSON.stringify(url)}`, { timeout: 4000 }) } catch (e) {}
      await settle(page, 25)
      rec.after = await page.evaluate(`(() => ({ pathname: location.pathname, url: location.href }))()`)
    } else { rec.after = null }
    out.clicks[lang] = rec
    await context.close()
  }

  // ============ 尺子灵敏度自证（逐判据 · 仅探针页内注入 + 复原） ============
  {
    const { context, page } = await openPage('light', { width: 1440, height: 900 })
    await goto(page, '/', { waitSel: '[data-sf-m="reward-card"]' })
    const base = await page.evaluate(MEASURE)
    const perturb = async (css, label) => {
      const h = await page.addStyleTag({ content: css })
      await settle(page)
      const m = await page.evaluate(MEASURE)
      await h.evaluate((el) => el.remove())
      await settle(page)
      const back = await page.evaluate(MEASURE)
      return { label, css, perturbed: m, restored: back }
    }
    const arms = []
    arms.push(await perturb('.sf-route-container{background:#123456 !important}', 'AC-1.routeContainer'))
    arms.push(await perturb('.sf-shell{background:#654321 !important}', 'AC-1.shell'))
    arms.push(await perturb('.sf-region-top{background:#00ff00 !important}', 'AC-1.regionTop'))
    arms.push(await perturb('.sf-reward-price{align-items:flex-start !important}', 'AC-2.baselineDelta'))
    arms.push(await perturb('.sf-reward-price-cur{font-size:0.4em !important}', 'AC-2.heightRatio'))
    arms.push(await perturb('.sf-reward-price-num{font-weight:400 !important}', 'AC-2.numFontWeight'))
    arms.push(await perturb('.sf-reward-price{border-width:1px !important}', 'AC-2.borderWidth'))
    arms.push(await perturb('.sf-reward-price{background:rgb(255,0,0) !important}', 'AC-2.background'))
    arms.push(await perturb('.sf-reward-price{padding:4px !important}', 'AC-2.padding'))
    arms.push(await perturb('.sf-reward-price{flex-direction:column !important}', 'AC-2.sameLine'))
    arms.push(await perturb('.sf-reward-price-num{color:rgb(1,2,3) !important}', 'AC-2.numColor'))
    arms.push(await perturb('.sf-reward-price-cur{color:rgb(9,9,9) !important}', 'AC-2.curColor'))
    out.rulerSensitivity.arms = arms.map((a) => ({
      label: a.label, css: a.css,
      before: { baselineDelta: base.price.baselineDelta, heightRatio: base.price.heightRatio, numFontWeight: base.price.num.fontWeight, parentBorderWidth: base.price.parentBorderWidth, parentBackground: base.price.parentBackground, parentPadding: base.price.parentPadding, flexDirection: base.price.parentFlexDirection, numColor: base.price.num.color, curColor: base.price.cur.color, shellBg: base.bg.shell, routeBg: base.bg.routeContainer, topBg: base.bg.regionTop },
      after: { baselineDelta: a.perturbed.price.baselineDelta, heightRatio: a.perturbed.price.heightRatio, numFontWeight: a.perturbed.price.num.fontWeight, parentBorderWidth: a.perturbed.price.parentBorderWidth, parentBackground: a.perturbed.price.parentBackground, parentPadding: a.perturbed.price.parentPadding, flexDirection: a.perturbed.price.parentFlexDirection, numColor: a.perturbed.price.num.color, curColor: a.perturbed.price.cur.color, shellBg: a.perturbed.bg.shell, routeBg: a.perturbed.bg.routeContainer, topBg: a.perturbed.bg.regionTop },
      restoredIdenticalToBase: JSON.stringify(a.restored.bg) === JSON.stringify(base.bg) && JSON.stringify(a.restored.price) === JSON.stringify(base.price),
    }))

    // AC-3 灵敏度：注入嵌套 <button> / 改写 href / 把 CTA 换成 <button>
    const inj = await page.evaluate(`(() => {
      const card = document.querySelector('[data-sf-m="reward-card"]')
      const b = document.createElement('button'); b.textContent = 'x'; card.appendChild(b)
      const cta = card.querySelector('[data-sf-m="reward-card-view"]')
      const btn = document.createElement('button'); btn.setAttribute('data-sf-m','reward-card-view-perturbed'); cta.replaceWith(btn)
      card.setAttribute('href', '/item/999')
      return { nested: card.querySelectorAll('a,button,input,select,textarea').length, href: card.getAttribute('href'), ctaTag: document.querySelector('[data-sf-m="reward-card-view-perturbed"]').tagName }
    })()`)
    out.rulerSensitivity.ac3Injection = {
      injected: '卡内追加 <button> + 把 [data-sf-m="reward-card-view"] 换成 <button> + href 改写 /item/999（仅探针页内，仓内源码零改动）',
      reading: inj,
      nestedRulerSensitive: inj.nested > 0,
      hrefRulerSensitive: inj.href !== '/item/1',
      ctaTagRulerSensitive: inj.ctaTag === 'BUTTON',
    }
    await context.close()
  }

  out.pageErrors = [...new Set(pageErrors)]
  out.consoleErrors = [...new Set(consoleErrors)]

  // ============ 判定 ============
  const S = out.states
  const ac = {}
  const bgOf = (s) => s && s.bg
  const expBg = {
    day: { shell: 'rgb(245, 247, 249)', routeContainer: 'rgb(255, 255, 255)', regionTop: 'rgb(253, 232, 21)' },
    night: { shell: 'rgb(11, 12, 14)', routeContainer: 'rgb(16, 17, 20)', regionTop: 'rgb(11, 12, 14)' },
  }
  const ac1rows = {}
  for (const k of Object.keys(S)) {
    const want = expBg[k.includes('night') ? 'night' : 'day']
    const got = bgOf(S[k])
    ac1rows[k] = { got, want, ok: got && got.shell === want.shell && got.routeContainer === want.routeContainer && got.regionTop === want.regionTop }
  }
  ac['AC-1'] = { rows: ac1rows, ok: Object.values(ac1rows).every((r) => r.ok), note: '消费者计数 grep 见 neng-static.txt' }

  const priceChecks = (st, label) => {
    const p = st && st.price
    if (!p) return { ok: false, why: `${label}: price missing` }
    const fails = []
    if (!p.sameParent) fails.push('not-same-parent')
    if (p.parentDisplay !== 'flex') fails.push(`display=${p.parentDisplay}`)
    if (p.parentFlexDirection !== 'row') fails.push(`flexDirection=${p.parentFlexDirection}`)
    if (p.parentAlignItems !== 'baseline') fails.push(`alignItems=${p.parentAlignItems}`)
    if (!(p.baselineDelta <= 1)) fails.push(`baselineDelta=${p.baselineDelta}`)
    if (!(p.heightRatio >= 0.70 && p.heightRatio <= 0.85)) fails.push(`heightRatio=${p.heightRatio}`)
    if (!(Number(p.num.fontWeight) >= 700)) fails.push(`numFontWeight=${p.num.fontWeight}`)
    if (p.parentBorderWidth !== '0px/0px/0px/0px') fails.push(`borderWidth=${p.parentBorderWidth}`)
    if (p.parentBackground !== 'rgba(0, 0, 0, 0)') fails.push(`bg=${p.parentBackground}`)
    if (p.parentPadding !== '0px/0px/0px/0px') fails.push(`padding=${p.parentPadding}`)
    if (!p.curIsSpan) fails.push('$ not in <span>')
    if (JSON.stringify(p.order) !== JSON.stringify(['cur', 'num'])) fails.push(`order=${JSON.stringify(p.order)}`)
    if (p.cur.text !== '$') fails.push(`curText=${p.cur.text}`)
    if (p.num.color !== 'rgb(3, 4, 2)') fails.push(`numColor=${p.num.color}`)
    if (p.cur.color !== 'rgb(3, 4, 2)') fails.push(`curColor=${p.cur.color}`)
    return {
      ok: fails.length === 0, fails,
      measured: { baselineDelta: p.baselineDelta, heightRatio: p.heightRatio, numFontWeight: p.num.fontWeight, numFontSize: p.num.fontSize, curFontSize: p.cur.fontSize, numColor: p.num.color, curColor: p.cur.color, parentDisplay: p.parentDisplay, parentAlignItems: p.parentAlignItems, parentBorderWidth: p.parentBorderWidth, parentBackground: p.parentBackground, parentPadding: p.parentPadding, order: p.order, curTag: p.cur.tag, baselineProbe: { curBaseline: p.curBaseline, numBaseline: p.numBaseline } },
    }
  }
  const ac2 = {}
  for (const k of Object.keys(S)) ac2[k] = priceChecks(S[k], k)
  ac['AC-2'] = { ...ac2, tokenedRebind: { day390: S['390_day'].tokens, night390: S['390_night'].tokens }, ok: Object.values(ac2).every((r) => r.ok) }

  const expectHref = { zh: '/item/1', en: '/en/item/1', hk: '/hk/item/1', vn: '/vn/item/1' }
  const ac3langs = {}
  for (const lang of ['zh', 'en', 'hk', 'vn']) {
    const c = out.clicks[lang]
    const fails = []
    if (!c) { ac3langs[lang] = { ok: false, why: 'no click record' }; continue }
    if (JSON.stringify(c.before.roots) !== JSON.stringify(c.before.roots.map(() => 'A'))) fails.push(`roots=${JSON.stringify(c.before.roots)}`)
    if (c.before.hrefs[0] !== expectHref[lang]) fails.push(`href0=${c.before.hrefs[0]} vs ${expectHref[lang]}`)
    if (!c.before.nested.every((n) => n === 0)) fails.push(`nested=${JSON.stringify(c.before.nested)}`)
    if (c.before.ctaTag === 'BUTTON' || c.before.ctaTag === 'A' || !c.before.ctaTag) fails.push(`ctaTag=${c.before.ctaTag}`)
    if (!c.after || c.after.pathname !== expectHref[lang]) fails.push(`clickPathname=${c.after && c.after.pathname}`)
    ac3langs[lang] = { ok: fails.length === 0, fails, hrefs: c.before.hrefs, roots: c.before.roots, nested: c.before.nested, ctaTag: c.before.ctaTag, ctaText: c.before.ctaText, blankPoint: c.blankPoint.pick, afterPathname: c.after && c.after.pathname, navAssert: 'href 逐字 = buildLocalizedPath(lang, "/item/"+id)' }
  }
  ac['AC-3'] = { langs: ac3langs, ok: Object.values(ac3langs).every((r) => r.ok) }

  out.ac = ac
  writeJson(OUT, out)
  console.log(JSON.stringify({
    out: OUT,
    verdicts: Object.fromEntries(Object.entries(ac).map(([k, v]) => [k, v.ok ? 'PASS' : 'FAIL'])),
    ac1: Object.fromEntries(Object.entries(ac1rows).map(([k, v]) => [k, v.ok ? 'ok' : `FAIL got=${JSON.stringify(v.got)}`])),
    ac2: Object.fromEntries(Object.entries(ac2).map(([k, v]) => [k, v.ok ? 'ok' : `FAIL ${JSON.stringify(v.fails)}`])),
    ac2measured390day: ac2['390_day'].measured,
    ac2measured390night: ac2['390_night'].measured,
    ac3: Object.fromEntries(Object.entries(ac3langs).map(([k, v]) => [k, v.ok ? `ok ${v.hrefs[0]} -> ${v.afterPathname}` : `FAIL ${JSON.stringify(v.fails)}`])),
    sensitivity: out.rulerSensitivity.arms.map((a) => ({ label: a.label, sensitive: JSON.stringify(a.before) !== JSON.stringify(a.after), restoredIdenticalToBase: a.restoredIdenticalToBase })),
    ac3Injection: out.rulerSensitivity.ac3Injection,
    pageErrors: out.pageErrors, consoleErrors: out.consoleErrors.slice(0, 5),
  }, null, 2))
  await browser.close()
}
main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
