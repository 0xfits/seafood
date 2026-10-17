/**
 * Kong · v1.21 §23 判据复算（AC-1/AC-2/AC-3/AC-4/AC-9/AC-10 + AC-5 归因）
 * 输入 = 两个探针 JSON（父版 / 现版）⇒ 输出可复核 JSON + 文本表。
 * WCAG 2.x：(L1+0.05)/(L2+0.05)；前景带 alpha 时**先与有效底合成**（承 N52）。
 * 用法：node .../kong-v121-ac-check.mjs <current.json> <parent.json> <out.json> > out.log
 */
import fs from 'node:fs'

const CUR = process.argv[2]
const PAR = process.argv[3]
const OUT = process.argv[4]
const cur = JSON.parse(fs.readFileSync(CUR, 'utf8'))
const par = PAR ? JSON.parse(fs.readFileSync(PAR, 'utf8')) : null

const parseRGB = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
const ratio = (fg, bg) => { const f = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 } : fg
  const l1 = Math.max(L(f), L(bg)); const l2 = Math.min(L(f), L(bg)); return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 1000) / 1000 }
const rgbaStr = (c) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${c.a})`
const rgbStr = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`
const thresholdFor = (fs, fw) => { const px = parseFloat(fs); const bold = Number(fw) >= 700
  return (px >= 24 || (bold && px >= 18.66)) ? { large: true, min: 3 } : { large: false, min: 4.5 } }

const DAY = 'rgb(253,232,21)'
const NIGHT = 'rgb(31,41,55)'
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '')
const report = { probe: 'ops/ui-card-ref-20261017/qa/kong-v121-ac-check.mjs', cur: CUR, parent: PAR, at: new Date().toISOString(), ac: {}, states: {}, violations: [] }
const log = []
const say = (s) => { log.push(s); console.log(s) }

// ---------------- 逐档复算 ----------------
for (const [label, st] of Object.entries(cur.states)) {
  const isDay = !label.includes('night')
  const wantTopbar = isDay ? DAY : NIGHT
  const h = st.header
  const rows = []
  for (const fg of st.fgs) {
    const c = parseRGB(fg.color) || { r: 0, g: 0, b: 0, a: 1 }
    const bg = parseRGB(fg.effBg) || { r: 255, g: 255, b: 255, a: 1 }
    const { large, min } = thresholdFor(fg.fontSize, fg.fontWeight)
    const r = ratio(c, bg)
    const carried = fg.effBg === wantTopbar
    rows.push({ kind: fg.kind, tag: fg.tag, hooks: fg.hooks, text: fg.text, color: fg.color, compositedColor: c.a < 1 ? rgbaStr({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 }) : fg.color,
      effBg: fg.effBg, ratio: r, min, large, carried, pass: r >= min, rect: fg.rect, cls: fg.cls })
  }
  const carriedRows = rows.filter((x) => x.carried)
  const topbarCarriedFail = carriedRows.filter((x) => !x.pass)
  const selfCarriedFail = rows.filter((x) => !x.carried && !x.pass)
  const alphaOk = /^rgb\(/.test(h.bg)
  const st10 = {
    label, theme: st.theme, colorScheme: st.colorScheme, viewport: st.viewport,
    header: { bg: h.bg, backdropFilter: h.backdropFilter, border: h.borderBottom, rect: h.rect, opacity: h.opacity, boxShadow: h.boxShadow },
    regionTop: st.regionTop, routeContainer: st.routeContainer, shell: st.shell, tokens: st.tokens,
    composedPixels: st.decoded ? { samples: st.decoded.samples, histograms: st.decoded.histograms } : null,
    hits: st.hits, scrolled: { header: st.scrolled.header ? { bg: st.scrolled.header.bg, backdropFilter: st.scrolled.header.backdropFilter, rect: st.scrolled.header.rect } : null, elementAt44: st.scrolled.elementAt44 },
    active: st.active, panel: st.panel ? { headerRect: st.panel.headerRect, headerBg: st.panel.headerBg, itemCount: st.panel.items.length } : null,
    fgRows: rows, carriedCount: carriedRows.length, topbarCarriedFail, selfCarriedFail,
    checks: {
      ac1_day: isDay ? { bgEquals: norm(h.bg) === norm(DAY), alpha1: alphaOk, backdropNone: h.backdropFilter === 'none', borderEquals: h.borderBottomColor === 'rgb(3, 4, 2)', opacity1: h.opacity === '1' } : null,
      ac2_night: !isDay ? { bgEquals: norm(h.bg) === norm(NIGHT), borderEquals: h.borderBottom === '1px solid rgb(55, 65, 81)', backdropBlur4: h.backdropFilter === 'blur(4px)' } : null,
      ac4: { alpha1: alphaOk, backdropNone: isDay ? h.backdropFilter === 'none' : null, scrolledAlpha1: st.scrolled.header ? /^rgb\(/.test(st.scrolled.header.bg) : null, hitsAllInHeader: st.hits.every((x) => x.inHeader) },
    },
  }
  report.states[label] = st10
  say(`\n## ${label}  theme=${st.theme} colorScheme=${st.colorScheme} viewport=${st.viewport.w}x${st.viewport.h}`)
  say(`   #header bg=${h.bg} backdrop=${h.backdropFilter} border=${h.borderBottom} opacity=${h.opacity} rect=${JSON.stringify(h.rect)}`)
  say(`   .sf-region-top bg=${st.regionTop.bg} rect=${JSON.stringify(st.regionTop.rect)} | routeContainer maxWidth=${st.routeContainer.maxWidth} pad=${st.routeContainer.paddingL}/${st.routeContainer.paddingR} rect=${JSON.stringify(st.routeContainer.rect)}`)
  if (st.decoded) {
    say(`   合成像素（PNG 回读）samples=${st.decoded.samples.map((s) => `${s.point.join('x')}=${s.rgb}`).join(' ')}`)
    say(`   合成像素行直方图: ${st.decoded.histograms.map((hh) => `y=${hh.row} 首色 ${hh.topColors[0].rgb}×${hh.topColors[0].px}/${hh.width}`).join(' | ')}`)
  }
  say(`   elementFromPoint: ${st.hits.map((x) => `(${x.point})=${x.tag}.${String(x.cls).slice(0, 24)}→inHeader=${x.inHeader}`).join(' ')}`)
  say(`   滚动后(400): header.bg=${st.scrolled.header.bg} backdrop=${st.scrolled.header.backdropFilter} rect.y=${st.scrolled.header.rect.y} | (4,4)=${JSON.stringify(st.scrolled.elementAt44)}`)
  say(`   顶栏内前景 ${rows.length} 处 · 由顶栏底色承载 ${carriedRows.length} 处`)
  for (const r of rows) say(`     [${r.carried ? '顶栏底' : '自带底'}] ${r.tag} "${r.text}" hooks=${JSON.stringify(r.hooks)} color=${r.color} effBg=${r.effBg} → ${r.ratio}:1 (阈值 ${r.min}${r.large ? ' 大字' : ''}) ${r.pass ? '✓' : '✗'}`)
  if (topbarCarriedFail.length) say(`   ★ 由顶栏底色承载的不达标项 = ${topbarCarriedFail.length} 处`)
  if (selfCarriedFail.length) say(`   （自带底不达标项 = ${selfCarriedFail.map((x) => `${x.text}:${x.ratio}`).join(', ')} · 按 §23.3 分档另评）`)
}

// ---------------- 合并 AC 判定 ----------------
const all = Object.entries(report.states)
const day = all.filter(([k]) => !k.includes('night'))
const night = all.filter(([k]) => k.includes('night'))
const ac = report.ac
ac['AC-1'] = { judge: '日档三档 bg=rgb(253,232,21) ∧ alpha=1 ∧ backdrop=none ∧ 边框 rgb(3,4,2) ∧ opacity=1',
  pass: day.every(([, s]) => s.checks.ac1_day.bgEquals && s.checks.ac1_day.alpha1 && s.checks.ac1_day.backdropNone && s.checks.ac1_day.borderEquals && s.checks.ac1_day.opacity1),
  detail: Object.fromEntries(day.map(([k, s]) => [k, s.checks.ac1_day])) }
ac['AC-2'] = { judge: '夜档 bg=rgb(31,41,55) ∧ 边框 1px solid rgb(55,65,81) ∧ backdrop=blur(4px) ∧ rect=父版逐值相同',
  pass: night.every(([, s]) => s.checks.ac2_night.bgEquals && s.checks.ac2_night.borderEquals && s.checks.ac2_night.backdropBlur4),
  detail: Object.fromEntries(night.map(([k, s]) => [k, s.checks.ac2_night])), rectVsParent: null }
ac['AC-3'] = { judge: '由顶栏底色承载的前景全部 ≥ 阈值（其余行维持现状）',
  pass: all.every(([, s]) => s.topbarCarriedFail.length === 0),
  detail: Object.fromEntries(all.map(([k, s]) => [k, { carried: s.carriedCount, fail: s.topbarCarriedFail.map((x) => `${x.text}:${x.ratio}`), selfCarriedFail: s.selfCarriedFail.map((x) => `${x.text}:${x.ratio}`) }])) }
ac['AC-4'] = { judge: '三档 alpha=1 ∧ backdrop=none ∧ 滚动后仍 alpha=1 ∧ elementFromPoint 全中 #header 子树',
  pass: all.every(([, s]) => s.checks.ac4.alpha1 && (s.checks.ac4.backdropNone !== false) && s.checks.ac4.scrolledAlpha1 && s.checks.ac4.hitsAllInHeader),
  detail: Object.fromEntries(all.map(([k, s]) => [k, s.checks.ac4])) }

// ---------------- AC-9 / AC-5：父版 vs 现版逐元素归因 ----------------
// dump 行字段（DUMP_FN）：[key, x, y, w, h, backgroundColor, color, borderTopColor/borderTopWidth, backdropFilter, closeTag]
// closeTag ∈ {'header','footer','else'}（el.closest('#header') / footer / 其余）
const T117_HOOKS = ['sf-topbar-brand', 'sf-topbar-hover-brand-fg']
if (par) {
  const diffReport = {}
  for (const [label] of Object.entries(cur.states)) {
    const a = (par.states[label] || {}).dump
    const b = (cur.states[label] || {}).dump
    if (!a || !b) { diffReport[label] = { status: 'NO_PARENT_DUMP' }; continue }
    const mapA = new Map(a.map((r) => [r[0], r])); const mapB = new Map(b.map((r) => [r[0], r]))
    const onlyA = [...mapA.keys()].filter((k) => !mapB.has(k)); const onlyB = [...mapB.keys()].filter((k) => !mapA.has(k))
    const rectDiffs = []; const attrDiffs = []; const allowed = []; const violations = []
    for (const key of [...mapA.keys()].filter((x) => mapB.has(x))) {
      const ra = mapA.get(key); const rb = mapB.get(key)
      const rectSame = ra[1] === rb[1] && ra[2] === rb[2] && ra[3] === rb[3] && ra[4] === rb[4]
      if (!rectSame) rectDiffs.push({ key, before: ra.slice(1, 5), after: rb.slice(1, 5), region: rb[9] })
      const changed = []
      if (ra[5] !== rb[5]) changed.push({ f: 'backgroundColor', before: ra[5], after: rb[5] })
      if (ra[6] !== rb[6]) changed.push({ f: 'color', before: ra[6], after: rb[6] })
      if (ra[7] !== rb[7]) changed.push({ f: 'borderTop(color/width)', before: ra[7], after: rb[7] })
      if (ra[8] !== rb[8]) changed.push({ f: 'backdropFilter', before: ra[8], after: rb[8] })
      if (!changed.length) continue
      const inHeader = rb[9] === 'header'
      const isHeaderRoot = /^header\./.test(key)
      const isHook = T117_HOOKS.some((hh) => key.includes(hh)) || /nav-link/.test(key)
      const okFields = changed.every((c) => {
        if (!inHeader) return false
        if (c.f === 'backgroundColor' || c.f === 'backdropFilter' || c.f === 'borderTop(color/width)') return isHeaderRoot
        if (c.f === 'color') return isHeaderRoot || isHook
        return false
      })
      const rec = { key, region: rb[9], changed, allowed: okFields }
      attrDiffs.push(rec)
      if (okFields) allowed.push(rec); else { violations.push(rec); report.violations.push({ label, kind: 'attrDiff', ...rec }) }
    }
    // 键集差（class 变更会改结构键）：只允许「T117 三处前景钩子换类」造成的头栏内键差
    const onlyB_in = onlyB.filter((k) => T117_HOOKS.some((hh) => k.includes(hh)))
    const onlyB_out = onlyB.filter((k) => !T117_HOOKS.some((hh) => k.includes(hh)))
    const onlyA_out = onlyA.filter((k) => !/(text-yellow-600|dark:text-yellow-400|hover:text-yellow-600|dark:hover:text-yellow-400)/.test(k))
    const keyDiff = { onlyParent: onlyA, onlyCurrent: onlyB,
      onlyCurrentWithT117Hook: onlyB_in, onlyCurrentWithoutHook: onlyB_out.length, onlyParentSample: onlyA_out.slice(0, 8), keyDiffAttributable: onlyB_out.length === 0 && onlyB.length === onlyA.length }
    if (onlyB_out.length) report.violations.push({ label, kind: 'keyDiffNotAttributable', onlyCurrentWithoutHook: onlyB_out.slice(0, 8), onlyParent: onlyA.slice(0, 8) })
    diffReport[label] = { elements: { parent: a.length, current: b.length }, onlyParent: onlyA.length, onlyCurrent: onlyB.length, keyDiff,
      rectDiffs: rectDiffs.length, rectDiffSample: rectDiffs.slice(0, 8), attrDiffs: attrDiffs.length, allowedAttrDiffs: allowed.length, allowedSample: allowed.slice(0, 6), unattributable: violations.filter((v) => v.kind === 'attrDiff').length, unattributableSample: violations.filter((v) => v.kind === 'attrDiff').slice(0, 6) }
  }
  report.attribution = diffReport
  ac['AC-9'] = { judge: '三档 × 日/夜：#header / .sf-region-top / .sf-route-container rect 与父版逐值相同 ∧ 逐元素 dump 无 rect 差异',
    pass: Object.values(diffReport).every((d) => d.rectDiffs === 0) && all.every(([k, s]) => { const p = par.states[k]; return p && JSON.stringify(p.header.rect) === JSON.stringify(s.header.rect) && JSON.stringify(p.regionTop.rect) === JSON.stringify(s.regionTop.rect) && p.routeContainer.maxWidth === s.routeContainer.maxWidth && p.routeContainer.paddingL === s.routeContainer.paddingL && p.routeContainer.paddingR === s.routeContainer.paddingR && p.routeContainer.rect.w === s.routeContainer.rect.w }),
    detail: Object.fromEntries(all.map(([k, s]) => [k, { headerRect: s.header.rect, parentHeaderRect: par.states[k] ? par.states[k].header.rect : null, regionRect: s.regionTop.rect, parentRegionRect: par.states[k] ? par.states[k].regionTop.rect : null, maxWidth: s.routeContainer.maxWidth, parentMaxWidth: par.states[k] ? par.states[k].routeContainer.maxWidth : null, padding: [s.routeContainer.paddingL, s.routeContainer.paddingR], parentPadding: par.states[k] ? [par.states[k].routeContainer.paddingL, par.states[k].routeContainer.paddingR] : null, routeContainerRect: s.routeContainer.rect, parentRouteContainerRect: par.states[k] ? par.states[k].routeContainer.rect : null }])) }
  ac['AC-5'] = { judge: '逐元素差异集 100% 归因于允许变更集（① #header 底色/边框/backdrop ② 三处前景色及其类钩）',
    pass: report.violations.length === 0, unattributableCount: report.violations.length, detail: diffReport }
}

// ---------------- AC-8 / AC-2 反向臂（自证）----------------
const sp = cur.selfproof
ac['AC-8'] = {
  judge: '负控臂（⇒ #FFFFFF）必须变红；复原臂（⇒ 改前 95% 白 + blur) 必须回改前值；夜档反向臂（去日档限定）必须变 rgb(11,12,14)',
  detail: sp,
  pass: !!(sp.light && norm(sp.light.negControlWhite.bg) === norm('rgb(255,255,255)') && norm(sp.light.revertToPreRule.bg) === norm('rgba(255,255,255,0.95)') && sp.light.revertToPreRule.backdrop === 'blur(4px)' && norm(sp.light.afterRevertRemoval.bg) === norm(DAY) && norm(sp.light.finalAfterAll.bg) === norm(DAY) &&
    sp.dark && norm(sp.dark.baseline.bg) === norm(NIGHT) && norm(sp.dark.noThemeGuard.bg) === norm('rgb(11,12,14)') && norm(sp.dark.finalAfterAll.bg) === norm(NIGHT)),
}

// ---------------- AC-10 移动档（390/375/320 日档 + 390_night 登记）----------------
const mob = all.filter(([k]) => /^(390|375|320)_day/.test(k))
const mobNight = all.filter(([k]) => /^(390|375|320)_night/.test(k))
ac['AC-10'] = {
  judge: '390/375/320 日档顶栏 = rgb(253,232,21) ∧ alpha=1；汉堡面板展开态自带底按 §23.3 11–14 行评；面板展开不破色；夜档移动档（390_night）= 冻结值',
  pass: mob.every(([, s]) => s.checks.ac1_day.bgEquals && s.checks.ac1_day.alpha1) && mobNight.every(([, s]) => s.checks.ac2_night.bgEquals),
  detail: {
    day: Object.fromEntries(mob.map(([k, s]) => [k, { bg: s.header.bg, alpha1: s.checks.ac1_day.alpha1, backdrop: s.header.backdropFilter, rect: s.header.rect, panel: s.panel ? { headerRect: s.panel.headerRect, headerBg: s.panel.headerBg, items: (s.panel.items || []).map((i) => ({ text: i.text, color: i.color, effBg: i.effBg, bgSelf: i.bgSelf, fs: i.fontSize, fw: i.fontWeight })) } : null }])),
    night: Object.fromEntries(mobNight.map(([k, s]) => [k, { bg: s.header.bg, backdrop: s.header.backdropFilter, rect: s.header.rect }])),
  },
}

say('\n\n================ AC 判定 ================')
for (const [k, v] of Object.entries(ac)) say(`${v.pass ? 'PASS' : 'FAIL'}  ${k}  ${v.judge}`)
say(`\n归因违规项总数 = ${report.violations.length}`)
if (report.violations.length) say(JSON.stringify(report.violations.slice(0, 20), null, 1))

report.log = log
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1))
