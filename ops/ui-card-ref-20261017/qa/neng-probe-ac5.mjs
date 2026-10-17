/**
 * Neng 独立质检探针 ③：AC-5 归因式「不动面」（★ 实现方未跑 · 本项归 Neng）
 *
 * 判据（§22.9 AC-5）：
 *   `/item/:id` 详情页 + 其余非首页路由，改前（parent@d8cb98e）vs 改后逐元素差异集
 *   **100% 归因**于被批准变更集（= T109 的 background 一行 + token 值变更引起的颜色面）；
 *   **反事实**：测量期把 `.sf-item-actionbar` 的 background 回改 `var(--sf-page-bg)`
 *   且把 `page-bg` / `surface-bg` 回退旧值 ⇒ 差异集**必须为空**。
 *
 * 采数口径（承 §13 / 技能「归因式判据」节）：
 *   · 禁动画（reducedMotion:'reduce' + 注入 animation/transition none + rAF 稳态窗）
 *   · 只采可见元素（el.getClientRects().length > 0）
 *   · 结构键 = tag + 全 class + 同名序号（坐标不进键；坐标只在「值」里参与比对）
 *   · 先跑噪声基线（同版两轮归一化 sha256 必须相同）
 *   · 噪声源具名：frontend/src/components/Footer.jsx:12 模块加载期 Math.random() ⇒ <a title>/<img alt> 每载随机
 *     ⇒ 声明式归一化 = 剔除 alt / title 的「值」（属性在场仍计）；raw 判据原样保留 = ENV_LIMITED
 *   · 尺子灵敏度自证：颜色扰动臂 / 几何扰动臂必须非空
 *
 * 用法：node ops/ui-card-ref-20261017/qa/neng-probe-ac5.mjs <out.json>
 */
import path from 'node:path'
import {
  REPO, CUR_DIST, PARENT_DIST, chromium, open, goto, writeJson, COLLECT, normalize, diffSnaps, sha256s,
} from './neng-lib.mjs'

const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-readings-ac5.json')

// 反事实（测量期 · 只注入探针页内 <style>）：把改动集的每一件都回退到改前形态
// ★ v2 修正（Neng 自曝 · harness 口径 bug · 第一轮读数被它污染）：v1 写作
//   `:root,[data-theme="light"]{--sf-page-bg:#FDE815 !important}` —— `:root` 在**夜档**下同样命中 `html`
//   ⇒ 夜档被强灌**日档旧值** `#FDE815` ⇒ 反事实臂在夜档恒非空（`DIV#sf-shell~0` / `DIV#sf-item-actionbar~0`
//   两处 backgroundColor），看起来像「产品缺陷」，实为**尺子错**（回退的是错的那一档的值）。
//   v2 = **按主题分别回退**（日 → `#FDE815` ＝改前真值；夜 → `#0B0C0E` ＝改前真值、与现值同 ⇒ 恒等），
//   并显式一并回退 `--sf-surface-bg`（日 `#FFFFFF` / 夜 `#101114`）+ 把两处新增落点还原为改前形态。
const CF_CSS = (theme) => [
  theme === 'dark'
    ? ':root{--sf-page-bg:#0B0C0E !important;--sf-surface-bg:#101114 !important}'
    : ':root{--sf-page-bg:#FDE815 !important;--sf-surface-bg:#FFFFFF !important}',
  '.sf-route-container{background:transparent !important}',
  '.sf-item-actionbar{background:var(--sf-page-bg) !important}',
].join('\n')

// 灵敏度臂（扰动 · 只注入探针页内）
const PERT_COLOR = '.sf-region-top{background:#00ff00 !important}'
const PERT_GEOM = '.sf-region-top{padding-top:5px !important}'

const COLOR_FIELDS = new Set(['style.backgroundColor', 'style.color', 'style.borderTopColor', 'style.borderLeftColor', 'style.boxShadow', 'style.outlineColor'])

const CASES = [
  { id: 'item1440', route: '/item/1', vw: 1440, theme: 'light', containsHome: false },
  { id: 'item390', route: '/item/1', vw: 390, theme: 'light', containsHome: false },
  { id: 'item1440_night', route: '/item/1', vw: 1440, theme: 'dark', containsHome: false },
  { id: 'exchange1440', route: '/exchange', vw: 1440, theme: 'light', containsHome: false },
  { id: 'task1440', route: '/task', vw: 1440, theme: 'light', containsHome: false },
  { id: 'profile1440', route: '/profile', vw: 1440, theme: 'light', containsHome: false },
  { id: 'exchange390', route: '/exchange', vw: 390, theme: 'light', containsHome: false },
  { id: 'task390', route: '/task', vw: 390, theme: 'light', containsHome: false },
  // ★ `/messages` 的渲染树**包含首页**（`pages/MessagesPage.jsx:2,15`：`const MessagesPage = () => <HomePage />`；
  //   口径 = v1.19 消息面板「直链落点 = 首页 + 面板」）⇒ 它**不是**「与首页无关」的路由，
  //   `T110`/`T112`/`T113` 在它上面生效属**变更集之内**（AC-5 的字面作用域未覆盖此点，见报告）。
  { id: 'messages1440', route: '/messages', vw: 1440, theme: 'light', containsHome: true },
]

// 首页卡片改造（T110/T112/T113 + Q5/Q6/Q9）在**含首页**的路由上会产生的具名类（测后枚举，非事前白名单）
const APPROVED_CARD_MARKERS = [
  // 价格块（T110/Q9）：改前
  /DIV#text-right ml-4/,
  /DIV#text-2xl font-bold text-yellow-600/,
  /SPAN#text-sm font-bold text-yellow-600 dark:text-yellow-400/,
  // 价格块：改后
  /DIV#ml-4 sf-reward-price/,
  /SPAN#sf-reward-price-cur/,
  /SPAN#sf-reward-price-num text-2xl/,
  // 卡根 / 卡盒（T112 + Q5 + Q6）
  /A#sf-reward-card block/,
  /DIV#rounded-lg border p-6 transition-all duration-300/,
  // CTA（T112 降级）
  /BUTTON#btn btn-(inactive|success|warning) btn-md/,
  /SPAN#inline-flex items-center justify-center rounded-full font-semibold/,
  // Q5 稀有度渐变底去除
  /bg-gradient-to-br from-purple-50 to-purple-100/,
  /bg-gradient-to-br from-yellow-50 to-yellow-100/,
  // T109 落点
  /#sf-shell~/, /#sf-route-container~/, /sf-item-actionbar/,
]
const isApprovedCardKey = (k) => APPROVED_CARD_MARKERS.some((re) => re.test(k))

async function snap(browser, dist, route, vw, theme, injectCss) {
  const { context, page } = await open(browser, { theme, viewport: { width: vw, height: 900 }, dist })
  await goto(page, route, {})
  if (injectCss) { await page.addStyleTag({ content: injectCss }) }
  const s = await page.evaluate(COLLECT)
  await context.close()
  return s
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const out = {
    probe: 'neng-probe-ac5.mjs（Neng 质检员 · 自写自跑 · 归因式不动面）',
    startedAt: new Date().toISOString(),
    parentDist: PARENT_DIST, currentDist: CUR_DIST,
    noiseSource: 'frontend/src/components/Footer.jsx:12 —— 模块加载期 Math.random() 选 CAT_SLOGAN ⇒ <a title>/<img alt> 每次加载都变',
    normalization: '声明式：剔除 alt / title 两个属性的「值」（属性在场仍计）；tag / 全部 class / 其余语义属性 / 结构路径 / 可见性 / 几何 全在键与值内；坐标从未进键',
    cases: {}, ac: {},
  }
  const rows = []
  for (const c of CASES) {
    const pA = await snap(browser, PARENT_DIST, c.route, c.vw, c.theme)
    const pB = await snap(browser, PARENT_DIST, c.route, c.vw, c.theme)
    const cA = await snap(browser, CUR_DIST, c.route, c.vw, c.theme)
    const cB = await snap(browser, CUR_DIST, c.route, c.vw, c.theme)
    const cf = await snap(browser, CUR_DIST, c.route, c.vw, c.theme, CF_CSS(c.theme))
    const pc = await snap(browser, CUR_DIST, c.route, c.vw, c.theme, PERT_COLOR)
    const pg = await snap(browser, CUR_DIST, c.route, c.vw, c.theme, PERT_GEOM)

    // 噪声基线（同版两轮，归一化后 sha256 必须相同）
    const nP = sha256s(JSON.stringify(normalize(pA))) === sha256s(JSON.stringify(normalize(pB)))
    const nC = sha256s(JSON.stringify(normalize(cA))) === sha256s(JSON.stringify(normalize(cB)))

    // raw（未归一化）差异集 —— 预期 ≠ 0（随机 alt/title）⇒ ENV_LIMITED，原样保留
    const raw = diffSnaps(pA, cA)
    // 归一化差异集 —— 归因判据承载体
    const norm = diffSnaps(normalize(pA), normalize(cA))
    // 反事实：必须为空
    const cfDiff = diffSnaps(normalize(pA), normalize(cf))
    // 灵敏度臂
    const pertColor = diffSnaps(normalize(cA), normalize(pc))
    const pertGeom = diffSnaps(normalize(cA), normalize(pg))

    // 归因分类：每个差异元素 → 变更字段是否全为「颜色面」
    const attributable = []; const nonAttributable = []
    for (const d of norm.details) {
      const bad = d.fields.filter((f) => !COLOR_FIELDS.has(f))
      if (bad.length === 0) attributable.push(d); else nonAttributable.push(d)
    }
    const structural = [...norm.onlyA, ...norm.onlyB]
    // 含首页的路由：差异集须逐键落在「被批准卡面变更集」的具名类内（测后枚举 + 未匹配项单列）
    const approvedHits = structural.filter(isApprovedCardKey)
    const unapproved = structural.filter((k) => !isApprovedCardKey(k))

    rows.push({
      id: c.id, route: c.route, vw: c.vw, theme: c.theme, containsHome: !!c.containsHome,
      visibleParent: pA.visibleCount, visibleCurrent: cA.visibleCount,
      noiseBaselineParent: nP, noiseBaselineCurrent: nC,
      rawDiffCount: raw.diffCount, rawDiffSample: raw.details.slice(0, 6).map((d) => ({ key: d.key, fields: d.fields })),
      normalizedDiffCount: norm.diffCount,
      attributableChanges: attributable.map((d) => ({ key: d.key, fields: d.fields, from: d.a.style.color + '|' + d.a.style.backgroundColor, to: d.b.style.color + '|' + d.b.style.backgroundColor })),
      nonAttributable: nonAttributable.map((d) => ({ key: d.key, fields: d.fields, a: { rect: d.a.rect, attrs: d.a.attrs, text: d.a.text }, b: { rect: d.b.rect, attrs: d.b.attrs, text: d.b.text } })),
      structuralOnlyInParent: norm.onlyA, structuralOnlyInCurrent: norm.onlyB,
      structuralApprovedMarkerHits: approvedHits.length,
      structuralUnapproved: unapproved,
      geometryDiffs: norm.geometry, structureDiffs: norm.structure, textDiffs: norm.textDiff,
      counterfactual: { css: CF_CSS(c.theme), diffCount: cfDiff.diffCount, details: cfDiff.details.slice(0, 10).map((d) => ({ key: d.key, fields: d.fields })) },
      sensitivity: {
        colorPerturb: { css: PERT_COLOR, diffCount: pertColor.diffCount, sensitive: pertColor.diffCount > 0 },
        geomPerturb: { css: PERT_GEOM, diffCount: pertGeom.diffCount, geometryFieldDiffs: pertGeom.geometry.length, sensitive: pertGeom.diffCount > 0 && pertGeom.geometry.length > 0 },
      },
    })
  }
  out.cases = rows

  const nonHome = rows.filter((r) => !r.containsHome)
  const homeBearing = rows.filter((r) => r.containsHome)
  const allNoise = rows.every((r) => r.noiseBaselineParent && r.noiseBaselineCurrent)
  const cfEmptyNonHome = nonHome.every((r) => r.counterfactual.diffCount === 0)
  const allSensitive = rows.every((r) => r.sensitivity.colorPerturb.sensitive && r.sensitivity.geomPerturb.sensitive)
  const nonHomeAttributable = nonHome.every((r) => r.nonAttributable.length === 0 && r.structuralOnlyInParent.length === 0 && r.structuralOnlyInCurrent.length === 0 && r.geometryDiffs.length === 0)

  out.ac['AC-5'] = {
    scope: '真·非首页路由（/item/:id · /exchange · /task · /profile × 1440/390 × 日/夜）＝「不动面」承重面；/messages 单列（其渲染树含首页）',
    nonHomeRoutes: {
      cases: nonHome.map((r) => r.id),
      noiseBaselineAllIdentical: allNoise,
      normalizedDiffFullyAttributable: nonHomeAttributable,
      counterfactualEmptyAllCases: cfEmptyNonHome,
      rulerSensitivityAllNonEmpty: allSensitive,
      ok: allNoise && nonHomeAttributable && cfEmptyNonHome && allSensitive,
    },
    homeBearingRoutes: homeBearing.map((r) => ({
      id: r.id, route: r.route,
      note: '/messages 的渲染树 = 首页 + 面板（pages/MessagesPage.jsx:15 `const MessagesPage = () => <HomePage />`）⇒ 卡面改造在此生效属变更集之内；AC-5 的 T109-only 反事实**不覆盖**卡面（故不适用）',
      normalizedDiffCount: r.normalizedDiffCount,
      approvedMarkerHits: r.structuralApprovedMarkerHits,
      unapprovedRemainder: r.structuralUnapproved,
      geometryDiffs: r.geometryDiffs.length,
      attributionComplete: r.structuralUnapproved.length === 0 && r.geometryDiffs.length === 0 && r.nonAttributable.length === 0,
    })),
    rawDiffCounts: rows.map((r) => ({ id: r.id, raw: r.rawDiffCount })),
    rawJudgement: 'raw 差异集 ≠ 0 为预期（Footer.jsx:12 模块加载期 Math.random() ⇒ <a title>/<img alt> 每载随机）⇒ 该判据**原样保留为 ENV_LIMITED**，不改写成 PASS',
    ok: allNoise && nonHomeAttributable && cfEmptyNonHome && allSensitive,
  }
  writeJson(OUT, out)
  console.log(JSON.stringify({
    out: OUT,
    perCase: rows.map((r) => ({
      id: r.id,
      noise: r.noiseBaselineParent && r.noiseBaselineCurrent,
      raw: r.rawDiffCount, norm: r.normalizedDiffCount,
      attributable: r.attributableChanges.length, nonAttributable: r.nonAttributable.length,
      structural: r.structuralOnlyInParent.length + r.structuralOnlyInCurrent.length,
      geom: r.geometryDiffs.length, text: r.textDiffs.length,
      cf: r.counterfactual.diffCount,
      sensColor: r.sensitivity.colorPerturb.diffCount, sensGeom: r.sensitivity.geomPerturb.diffCount,
    })),
    AC5: out.ac['AC-5'],
  }, null, 2))
  await browser.close()
}
main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
