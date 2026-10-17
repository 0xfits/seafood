/**
 * Neng 独立质检探针 ②：AC-9（夜档价格可读性 WCAG ≥ 4.5:1）
 *   + §22.12 第 14 项「`dark:` 机制三臂独立复现」（CDP `Emulation.setEmulatedMedia`，**不读 Kong 的 kong-night-contrast.json**）
 *   + 反事实臂（灵敏度自证：只改卡底、不重绑三色 ⇒ 夜档 token #FDE815 on 白卡 ⇒ 必须变红）
 *
 * 三臂（× 两个 dist：改后 current / 改前 parent@d8cb98e）：
 *   A = 站点夜档 × 设备 light 偏好      （★ 待证：color-scheme 是否真的让 @media(prefers-color-scheme:dark) 命中）
 *   B = 站点日档 × 设备 dark 偏好
 *   C = 站点夜档 × 设备 dark 偏好
 *   D = 站点日档 × 设备 light 偏好（对照）
 * 用法：node ops/ui-card-ref-20261017/qa/neng-probe-ac9.mjs <out.json>
 */
import path from 'node:path'
import {
  REPO, CUR_DIST, PARENT_DIST, chromium, open, goto, writeJson, contrast, luminance,
} from './neng-lib.mjs'

const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-readings-ac9.json')

const MEASURE = `(() => {
  // 定位卡片根：改后 = [data-sf-m="reward-card"]；改前（parent@d8cb98e）= 由 [data-sf-m="reward-card-view"] 上溯到 Card 盒
  const card = document.querySelector('[data-sf-m="reward-card"]') || (() => {
    const cta = document.querySelector('[data-sf-m="reward-card-view"]')
    if (!cta) return null
    let n = cta
    while (n && !/rounded-lg/.test(String(n.className || ''))) n = n.parentElement
    return n
  })()
  if (!card) return { ok: false, reason: 'no-card' }
  const numSels = ['.sf-reward-price-num', 'div.text-2xl.font-bold.text-yellow-600', 'div[class*="text-2xl"][class*="font-bold"]']
  const curSels = ['.sf-reward-price-cur', 'span.text-sm.font-bold.text-yellow-600', 'span[class*="font-bold"]']
  const pick = (sels, filter) => { for (const s of sels) { const els = [...card.querySelectorAll(s)]; const e = filter ? els.find(filter) : els[0]; if (e) return e } return null }
  const num = pick(numSels, (e) => /^[0-9]+$/.test((e.textContent || '').trim()))
  const cur = pick(curSels, (e) => (e.textContent || '').trim() === '$' && !/text-2xl/.test(String(e.className || '')))
  const effBg = (el) => { let n = el; while (n) { const bg = getComputedStyle(n).backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return { bg, from: n.tagName + '.' + String(n.className || '').slice(0, 60) }; n = n.parentElement } return { bg: 'rgba(0, 0, 0, 0)', from: 'none' } }
  const info = (el) => el ? { tag: el.tagName, cls: String(el.className || ''), text: (el.textContent || '').trim(), color: getComputedStyle(el).color, fontSize: getComputedStyle(el).fontSize, fontWeight: getComputedStyle(el).fontWeight, effBg: effBg(el) } : null
  const cardBox = document.querySelector('[data-sf-m="reward-card"]') ? card.firstElementChild : card
  return {
    ok: true,
    cardRootTag: card.tagName,
    cardRootCls: String(card.className || '').slice(0, 160),
    cardInnerBg: getComputedStyle(cardBox).backgroundColor,
    num: info(num), cur: info(cur),
    heroCur: info(document.querySelector('span.text-sm.font-bold.text-yellow-600')),
    htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
    dataTheme: document.documentElement.getAttribute('data-theme'),
    mqDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    mqLight: window.matchMedia('(prefers-color-scheme: light)').matches,
  }
})()`

async function measureArm(browser, dist, siteTheme, deviceScheme) {
  const { context, page } = await open(browser, { theme: siteTheme, viewport: { width: 1280, height: 900 }, dist })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: deviceScheme }] })
  await goto(page, '/', { waitSel: '[data-sf-m="reward-card"]' })
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: deviceScheme }] })
  const m = await page.evaluate(MEASURE)
  const rec = {
    dist: path.basename(path.dirname(dist)) + '/' + dist.split('/').slice(-3).join('/'),
    siteTheme, deviceScheme,
    dataTheme: m.dataTheme, htmlColorScheme: m.htmlColorScheme, mqDark: m.mqDark,
    cardInnerBg: m.cardInnerBg,
    num: m.num, cur: m.cur, heroCur: m.heroCur,
    contrast: {
      num: m.num ? contrast(m.num.color, m.num.effBg.bg) : null,
      cur: m.cur ? contrast(m.cur.color, m.cur.effBg.bg) : null,
      heroCur: m.heroCur ? contrast(m.heroCur.color, m.heroCur.effBg.bg) : null,
    },
    luminance: { num: m.num ? luminance(m.num.color) : null, bg: m.num ? luminance(m.num.effBg.bg) : null },
  }
  await context.close()
  return rec
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const out = { probe: 'neng-probe-ac9.mjs（Neng 质检员 · 自写自跑 · CDP Emulation.setEmulatedMedia）', startedAt: new Date().toISOString(), arms: {}, counterfactual: {}, ac: {} }

  const ARMS = [
    ['A_siteNight_deviceLight', 'dark', 'light'],
    ['B_siteLight_deviceDark', 'light', 'dark'],
    ['C_siteNight_deviceDark', 'dark', 'dark'],
    ['D_siteLight_deviceLight', 'light', 'light'],
  ]
  for (const [label, siteTheme, deviceScheme] of ARMS) {
    out.arms[label] = {
      current: await measureArm(browser, CUR_DIST, siteTheme, deviceScheme),
      parent: await measureArm(browser, PARENT_DIST, siteTheme, deviceScheme),
    }
  }

  // ---- 反事实臂（改后 dist · 站点夜档 × 设备 light）：只改卡底（①），不重绑三色（②） ----
  {
    const { context, page } = await open(browser, { theme: 'dark', viewport: { width: 1280, height: 900 }, dist: CUR_DIST })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
    await goto(page, '/', { waitSel: '[data-sf-m="reward-card"]' })
    const shipped = await page.evaluate(MEASURE)
    // 撤掉卡内三色重绑 ⇒ 夜档 token 值 #FDE815 生效（白卡不变）
    const h = await page.addStyleTag({ content: '.sf-reward-card.sf-reward-card{--sf-price-num-fg:#FDE815 !important;--sf-price-cur-fg:#FDE815 !important;--sf-price-unit-fg:#FDE815 !important}' })
    const cf = await page.evaluate(MEASURE)
    await h.evaluate((el) => el.remove())
    const restored = await page.evaluate(MEASURE)
    // 另一臂：撤卡底白（bg-white ⇒ bg-yellow-50）+ 保留重绑
    const h2 = await page.addStyleTag({ content: '.sf-reward-card > *{background-color:#FEFCE8 !important}' })
    const cf2 = await page.evaluate(MEASURE)
    await h2.evaluate((el) => el.remove())
    out.counterfactual = {
      shipped: { num: shipped.num, cur: shipped.cur, cardInnerBg: shipped.cardInnerBg, contrastNum: contrast(shipped.num.color, shipped.num.effBg.bg), contrastCur: contrast(shipped.cur.color, shipped.cur.effBg.bg) },
      armNoRebind: { injected: '卡内三色重绑被覆盖为夜档 token 值 #FDE815（仅探针页内）', num: cf.num, contrastNum: contrast(cf.num.color, cf.num.effBg.bg), contrastCur: contrast(cf.cur.color, cf.cur.effBg.bg) },
      armYellowCard: { injected: '卡底改回 #FEFCE8（bg-yellow-50）+ 保留重绑（仅探针页内）', cardInnerBg: cf2.cardInnerBg, contrastNum: contrast(cf2.num.color, cf2.num.effBg.bg) },
      restoredIdenticalToShipped: JSON.stringify(restored.num) === JSON.stringify(shipped.num) && restored.cardInnerBg === shipped.cardInnerBg,
    }
    await context.close()
  }

  out.pageErrors = []
  // ---- 判定 ----
  const T = 4.5
  const byArm = {}
  for (const a of ['A_siteNight_deviceLight', 'B_siteLight_deviceDark', 'C_siteNight_deviceDark', 'D_siteLight_deviceLight']) {
    byArm[a] = {
      current: out.arms[a].current.contrast,
      parent: out.arms[a].parent.contrast,
      currentOk: out.arms[a].current.contrast.num >= T,
      parentOk: out.arms[a].parent.contrast.num >= T,
    }
  }
  out.ac['AC-9'] = {
    threshold: T,
    arms: byArm,
    nightArm: 'A_siteNight_deviceLight',
    afterNightContrast: out.arms.A_siteNight_deviceLight.current.contrast.num,
    beforeNightContrast: out.arms.A_siteNight_deviceLight.parent.contrast.num,
    counterfactualNoRebind: out.counterfactual.armNoRebind.contrastNum,
    counterfactualRulerSensitive: out.counterfactual.armNoRebind.contrastNum < T,
    restoredIdenticalToShipped: out.counterfactual.restoredIdenticalToShipped,
    ok: out.arms.A_siteNight_deviceLight.current.contrast.num >= T && out.arms.A_siteNight_deviceLight.current.contrast.cur >= T,
  }
  writeJson(OUT, out)
  console.log(JSON.stringify({
    out: OUT,
    summary: Object.fromEntries(Object.entries(out.arms).map(([k, v]) => [k, { currentNumColor: v.current.num.color, currentNumBg: v.current.num.effBg.bg, currentRatio: v.current.contrast.num, parentNumColor: v.parent.num.color, parentBg: v.parent.num.effBg.bg, parentRatio: v.parent.contrast.num }])),
    heroCur: Object.fromEntries(Object.entries(out.arms).map(([k, v]) => [k, { current: v.current.heroCur && v.current.heroCur.color, parent: v.parent.heroCur && v.parent.heroCur.color }])),
    counterfactual: { shipped: out.counterfactual.shipped.contrastNum, armNoRebind: out.counterfactual.armNoRebind.contrastNum, armYellowCard: out.counterfactual.armYellowCard.contrastNum, restored: out.counterfactual.restoredIdenticalToShipped },
    ac9: out.ac['AC-9'],
  }, null, 2))
  await browser.close()
}
main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
