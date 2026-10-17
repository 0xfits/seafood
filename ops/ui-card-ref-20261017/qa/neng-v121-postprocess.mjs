/**
 * Neng 独立质检 v1.21 —— 腿 3b：后处理（不重跑浏览器）
 *   ① 噪声基线复核 ② 20 档矩阵的 rect / style / attrs 逐项汇总
 *   ③ 归因分类（**修正规则**：Chrome 的 outlineColor 随 color 联动 ⇒ 与 style.color 同族；
 *      原分类器把 logo 的 {style.color, style.outlineColor} 误判为 not-attributable ⇒ 原判据过严，
 *      这里保留原始 unexpected 并给出修正判据 —— **口径变更留痕**，不是把 FAIL 改成 PASS）
 */
import fs from 'node:fs'
import path from 'node:path'
const REPO = '/Users/kevin/bistro/seafood'
const QA = path.join(REPO, 'ops/ui-card-ref-20261017/qa')
const G = JSON.parse(fs.readFileSync(path.join(QA, 'neng-v121-geometry.json'), 'utf8'))

const CHROME_CHROME = new Set(['style.backgroundColor', 'style.backgroundImage', 'style.borderBottomColor', 'style.backdropFilter', 'style.opacity', 'style.borderTopColor', 'style.borderLeftColor', 'style.borderRightColor'])
const FG_FIELDS = new Set(['style.color', 'style.outlineColor', 'attrs'])

const rows = []
let totUnexpected = 0, totUnexpectedFixed = 0, totRectDiff = 0, totOnlyCur = 0, totOnlyPar = 0
for (const [key, e] of Object.entries(G.geometry)) {
  const unexpectedFixed = []
  const allowedFixed = []
  for (const u of e.unexpected) {
    const f = u.fields || []
    const isBrand = /sf-topbar-brand|sf-topbar-hover-brand-fg/.test(String(u.key || '')) || (u.clsCur && /sf-topbar-brand|sf-topbar-hover-brand-fg/.test(u.clsCur))
    const fgOnly = f.every((x) => FG_FIELDS.has(x))
    const chromeOnly = f.every((x) => CHROME_CHROME.has(x) || FG_FIELDS.has(x))
    if (u.inHeader && isBrand && fgOnly) allowedFixed.push({ key: u.key, why: 'T119② 顶栏底承载前景（class 互换落地 · color+outlineColor 联动）' })
    else if (u.inHeader && chromeOnly) allowedFixed.push({ key: u.key, why: 'T119①/② 顶栏底色/边框/前景（在 #header 子树内）' })
    else unexpectedFixed.push({ key: u.key, fields: f, why: u.why })
  }
  const rawUnexpected = e.unexpected.length
  totUnexpected += rawUnexpected; totUnexpectedFixed += unexpectedFixed.length
  totRectDiff += e.diffCounts.rect; totOnlyCur += e.diffCounts.onlyCur; totOnlyPar += e.diffCounts.onlyPar
  rows.push({ key, url: e.url, theme: e.theme, w: e.w, rectEqual: e.rectEqual, rectDiff: e.diffCounts.rect, styleDiff: e.diffCounts.style, attrsDiff: e.diffCounts.attrs, textDiff: e.diffCounts.text, onlyCur: e.diffCounts.onlyCur, onlyPar: e.diffCounts.onlyPar, paired: e.diffCounts.paired, unmatchedCur: e.diffCounts.unmatchedCur, unmatchedPar: e.diffCounts.unmatchedPar, unexpectedRaw: rawUnexpected, unexpectedAfterFix: unexpectedFixed.length, allowedReasons: [...e.allowed.map((a) => a.why), ...allowedFixed.map((a) => a.why)], unexpectedKeysAfterFix: unexpectedFixed.map((u) => u.key), unexpectedDetailAfterFix: unexpectedFixed })
}

const rects = Object.entries(G.geometry).map(([k, e]) => ({ key: k, cur: e.curRects, par: e.parRects, equal: JSON.stringify(e.curRects) === JSON.stringify(e.parRects) }))
const darkKeys = rows.filter((r) => r.theme === 'dark')
const lightKeys = rows.filter((r) => r.theme === 'light')

const SUMMARY = {
  noise: { normEqual: G.noise.normEqual, normRound1: G.noise.normRound1, normRound2: G.noise.normRound2, rawEqual: G.noise.rawEqual, rawRound1: G.noise.rawRound1, rawRound2: G.noise.rawRound2, normDiffCounts: G.noise.normDiff.counts, noiseSource: G.noise.noiseSource },
  totals: { cases: rows.length, unexpectedRaw: totUnexpected, unexpectedAfterFix: totUnexpectedFixed, rectDiffTotal: totRectDiff, onlyCurTotal: totOnlyCur, onlyParTotal: totOnlyPar },
  darkArm: { cases: darkKeys.length, allRectEqual: darkKeys.every((r) => r.rectEqual), rectDiffTotal: darkKeys.reduce((a, r) => a + r.rectDiff, 0), styleDiffTotal: darkKeys.reduce((a, r) => a + r.styleDiff, 0), onlyCounters: darkKeys.map((r) => ({ key: r.key, onlyCur: r.onlyCur, onlyPar: r.onlyPar, paired: r.paired, attrsDiff: r.attrsDiff, styleDiff: r.styleDiff, rectDiff: r.rectDiff })) },
  lightArm: { cases: lightKeys.length, allRectEqual: lightKeys.every((r) => r.rectEqual), rectDiffTotal: lightKeys.reduce((a, r) => a + r.rectDiff, 0) },
  counterfactual: Object.fromEntries(Object.entries(G.counterfactual).map(([k, v]) => [k, { empty: v.counterfactualEmpty, counts: v.diffVsParent, headerAfterRevert: v.headerAfterRevert, injectedCssPresent: v.injected.cssInjected, classRestoredCount: v.injected.restored.length, detail: { onlyCur: v.detail.onlyCur, onlyPar: v.detail.onlyPar, paired: v.detail.paired } }])),
  rectTable: rects,
  rows,
  classificationRuleNote: '原分类器（leg3 内联）把「inHeader + 前景类元素」的 fields 限定为 {style.color, attrs}，而 Chrome 的 outlineColor 随 color 联动 ⇒ logo 的 {style.color, style.outlineColor} 被判 not-attributable（**判据过严 = 坏尺子**）。修正规则（本文件）：inHeader 且 fields ⊆ {style.color, style.outlineColor, attrs} ⇒ 归 T119②。原 unexpected 计数原样保留在 `unexpectedRaw`。',
}
fs.writeFileSync(path.join(QA, 'neng-v121-attrib-summary.json'), JSON.stringify(SUMMARY, null, 2))
console.log(JSON.stringify({ noise: SUMMARY.noise, totals: SUMMARY.totals, darkArm: { cases: SUMMARY.darkArm.cases, allRectEqual: SUMMARY.darkArm.allRectEqual, rectDiffTotal: SUMMARY.darkArm.rectDiffTotal, styleDiffTotal: SUMMARY.darkArm.styleDiffTotal }, lightArm: SUMMARY.lightArm, cf: Object.fromEntries(Object.entries(SUMMARY.counterfactual).map(([k, v]) => [k, { empty: v.empty, counts: v.counts, hdr: v.headerAfterRevert, restored: v.classRestoredCount }])), rectEqualAll: rects.every((r) => r.equal) }, null, 2))
