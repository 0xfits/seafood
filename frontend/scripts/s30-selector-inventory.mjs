#!/usr/bin/env node
/**
 * S30 · B12 阶段一 —— 零消费选择器盘点【升级版】（superset of scripts/s25-selector-inventory.mjs）
 * 纯只读：只读 styles.css 与源码，只写 stdout 与 --out 目录；绝不写 styles.css。
 *
 * 相对 s25 的升级点（默认输出与 s25 同构；新增能力逐条列名）：
 *   ① 消歧裁定（写死判据 + 出处）：把 s25 的「不确定(动态拼接)」逐名裁定 ZERO/CONSUMED/UNRESOLVED，
 *      依据 = 「模板串静态前缀」是否真能拼出该名（例：`data-sf-m={`card-${i}`}` 只产 card-1..8 ⇒ 拼不出 card-hover）。
 *   ② 守卫感知（S22 不变式）：逐规则标注其是否落在 S22 守卫面（url(#clip-path…) 计数 20 / 零偏移环 19 /
 *      焦点环 8 / pinned 选择器 / #chest 块）⇒ 守卫面与「真残留」区分，不混谈。
 *   ③ 三态判定：可删 / 保留-有消费（含 HTML/SVG 面）/ 保留-守卫 / 保留-不确定。
 *   ④ --check-deleted <manifest.json>：读删除清单，逐条核「该选择器已从 styles.css 消失」且「全仓消费数仍 = 0」。
 *
 * 用法：
 *   node scripts/s30-selector-inventory.mjs [--out <dir>] [--json] [--check-deleted <manifest.json>]
 *   退出码：盘点为 0；--check-deleted 有断言失败则为 1。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, 'src')
const STYLES = path.join(SRC, 'styles.css')

const argv = process.argv.slice(2)
const outDir = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : null })()
const asJson = argv.includes('--json')
const checkIdx = argv.indexOf('--check-deleted')
const checkFile = checkIdx >= 0 ? argv[checkIdx + 1] : null

// ── 消歧裁定表（S30 判据；出处见报告 §1）────────────────────────────────────
// ZERO = 已证运行时拼不出该名；CONSUMED = 有真实拼接生成；UNRESOLVED = 判不准（禁删）
export const DISAMBIG = {
  'button-group':   { v: 'ZERO', why: '片段 "button" 来自 <button> 元素标签/type="button"，非类名拼接（0 处 className 含 button-group）' },
  'card':           { v: 'CONSUMED', why: 'ThemePreviewPage.jsx:149 `data-sf-m={`card-${i+1}`}` 为 data 属性；.card 之名另由 admin.html class="card" 命中（HTML 面）' },
  'card--badge-space': { v: 'ZERO', why: '仅 ThemePreviewPage 有 `card-` 模板（产 card-1..8）；全仓 0 处字面 `card--badge-space`' },
  'card-bottom':    { v: 'ZERO', why: '同上：`card-${i}` 只产数字后缀；0 处字面' },
  'card-hover':     { v: 'ZERO', why: '同上；0 处字面' },
  'card-inactive':  { v: 'ZERO', why: '同上；0 处字面' },
  'card-primary':   { v: 'ZERO', why: '同上；0 处字面（只在 .card.card-primary 复合选择器里出现，非拼接生成）' },
  'card-proceed':   { v: 'ZERO', why: '同上；0 处字面' },
  'card-split':     { v: 'ZERO', why: '同上；0 处字面' },
  'card-success':   { v: 'ZERO', why: '同上；0 处字面' },
  'card-top':       { v: 'ZERO', why: '同上；0 处字面' },
  'card-warning':   { v: 'ZERO', why: '同上；0 处字面' },
  'claimed-time':   { v: 'ZERO', why: '片段 "cla" 系 className 切词伪影（JobReviewPage.jsx:114），非前缀生成器；0 处字面' },
  'page-content':   { v: 'ZERO', why: '片段 "page" 来自 BottomTabBar 的 nav item（is-active 模板），拼不出 page-content；0 处字面' },
  'price-tag':      { v: 'ZERO', why: '片段 "price" 来自 `sf-mkt-price`/`row.price`（MarketPage），拼不出 price-tag；0 处字面' },
  'timeline':       { v: 'ZERO', why: '片段 "timeliness*" 来自 i18n 键 `timelinessPanel.*`/API `/api/timeliness`；0 处类名字面 timeline' },
}

// ── ① 解析 styles.css ──────────────────────────────────────────────────────
const rawCss = fs.readFileSync(STYLES, 'utf8')
const cssNoComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const rules = []
{
  const stack = []
  let buf = '', bufLine = 0, line = 1, bodyStart = -1
  for (let i = 0; i < cssNoComments.length; i++) {
    const c = cssNoComments[i]
    if (c === '{') { const pre = buf.trim(); stack.push(pre ? { pre, bodyStart: i + 1, line: bufLine } : null); buf = '' }
    else if (c === '}') { const t = stack.pop(); if (t && t.pre) rules.push({ selector: t.pre, line: t.line, body: cssNoComments.slice(t.bodyStart, i), ancestors: stack.filter(Boolean).map((s) => s.pre) }); buf = '' }
    else if (c === ';') { buf = '' }
    else { if (buf.trim() === '') bufLine = line; buf += c }
    if (c === '\n') line += 1
  }
}

const CLASS_RE = /\.[A-Za-z_][\w-]*/g
const ID_RE = /#[A-Za-z_][\w-]*/g
const PSEUDO_ELEM_RE = /::(before|after|placeholder|selection|marker|first-line|first-letter|backdrop|file-selector-button|part|slotted|highlight|cue)/
const selectorRecords = []
for (const r of rules) {
  if (r.selector.startsWith('@')) continue
  if (r.ancestors.some((a) => /@keyframes/.test(a))) continue
  const ctx = r.ancestors.filter((a) => /@(media|supports|container|layer)/.test(a)).join(' | ')
  for (const sel of r.selector.split(',').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    selectorRecords.push({
      selector: sel, line: r.line, ctx,
      classes: [...new Set((sel.match(CLASS_RE) || []).map((t) => t.slice(1)))],
      ids: [...new Set((sel.match(ID_RE) || []).map((t) => t.slice(1)))],
      pseudoElem: PSEUDO_ELEM_RE.test(sel),
      idForm: (sel.match(ID_RE) || []).length > 0,
      guard: guardOf(r, sel),
    })
  }
}
function guardOf(r, sel) {
  const g = []
  if (/url\(#clip-path[^)]*\)/.test(r.body)) g.push('svg-url')
  if (/0 0 0 [0-9]+px/.test(r.body)) g.push('zero-ring')
  if (/:focus\s*\{[^}]*box-shadow\s*:\s*0 0 0\s+[0-9]+px/.test(r.selector)) g.push('focus-ring')
  if (['.badge-gift::before', '#section_gift .point-badge', '.badge::after'].includes(sel)) g.push('pinned-sel')
  if (r.ancestors.some((a) => a.trim().startsWith('#chest')) || r.selector.startsWith('#chest')) g.push('in-chest')
  return g
}

// ── ② 消费集（与 s25 同源）─────────────────────────────────────────────────
const CLASS_CTX_RE = /(?:className|class|\bid)\s*=\s*|(?:\bcn|\bclsx|\bclassnames|\bcx)\s*\(|classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(|querySelector(?:All)?\s*\(\s*['"`]?\.?|getElementById\s*\(/g
const LIT_RE = /'([^'\\\n]*)'|"([^"\\\n]*)"|`((?:[^`\\]|\\.)*)`/g
const CLASS_TOKEN_RE = /^[A-Za-z_][\w-]*$/
const tokenize = (t) => t.split(/[\s"'`{}()[\].,;:=>$#+*!?&|~/\\]+/).filter((x) => CLASS_TOKEN_RE.test(x) && x.length >= 2)
const MAP_RE = /(?:const|let|var)\s+[A-Za-z_]\w*(?:[Cc]lass|[Vv]ariant|[Ss]ize|[Tt]heme|[Ss]tyle)[A-Za-z_]*\s*=\s*\{/g
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name === 'node_modules') continue; const fp = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'test') walk(fp, out) } else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(fp) } return out }
const codeFiles = walk(SRC).filter((f) => f !== STYLES)
const codeTokens = new Set()
for (const fp of codeFiles) {
  const src = fs.readFileSync(fp, 'utf8'); const blobs = []
  for (const m of src.matchAll(CLASS_CTX_RE)) blobs.push(src.slice(m.index + m[0].length, m.index + m[0].length + 200))
  for (const m of src.matchAll(MAP_RE)) { const s = m.index + m[0].length - 1; let d = 0, i = s; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break } } } blobs.push(src.slice(s, i)) }
  for (const s of blobs) for (const lm of s.matchAll(LIT_RE)) for (const t of tokenize(lm[1] ?? lm[2] ?? lm[3] ?? '')) codeTokens.add(t)
}
const htmlFiles = []
for (const c of ['index.html', 'admin.html']) { const p = path.join(ROOT, c); if (fs.existsSync(p)) htmlFiles.push(p) }
const pub = path.join(ROOT, 'public'); if (fs.existsSync(pub)) for (const e of fs.readdirSync(pub, { withFileTypes: true })) if (e.isFile() && /\.html?$/.test(e.name)) htmlFiles.push(path.join(pub, e.name))
const htmlTokens = new Set()
for (const fp of htmlFiles) for (const m of fs.readFileSync(fp, 'utf8').matchAll(/(?:class|id)=["']([^"']*)["']/g)) for (const t of tokenize(m[1])) htmlTokens.add(t)
const svgUrlRefs = new Set()
for (const txt of [rawCss, ...codeFiles.map((f) => fs.readFileSync(f, 'utf8')), ...htmlFiles.map((f) => fs.readFileSync(f, 'utf8'))]) for (const m of txt.matchAll(/url\(#([A-Za-z_][\w-]*)\)/g)) svgUrlRefs.add(m[1])

// dyn 前缀（与 s25 同源；仅用于「不确定」候选，裁定权限在 DISAMBIG）
const dynFragments = new Set()
for (const fp of codeFiles) {
  const src = fs.readFileSync(fp, 'utf8'); const blobs = []
  for (const m of src.matchAll(CLASS_CTX_RE)) blobs.push(src.slice(m.index + m[0].length, m.index + m[0].length + 200))
  for (const s of blobs) if (s.includes('${')) for (const sp of s.split('${')) for (const t of tokenize(sp)) dynFragments.add(t)
}
const isDyn = (name) => { if (name.length < 3) return false; for (const f of dynFragments) { const st = f.replace(/-$/, ''); if (st.length < 3 || name === st) continue; if (name.startsWith(st) || st.startsWith(name)) return true } return false }

// ── ③ 三态判定 ─────────────────────────────────────────────────────────────
const zero = []
for (const rec of selectorRecords) {
  const names = [...rec.classes, ...rec.ids]
  if (!names.length) continue
  const jsxZero = names.filter((n) => !codeTokens.has(n))
  if (!jsxZero.length) continue
  const perName = names.map((n) => ({
    name: n,
    jsx: codeTokens.has(n), html: htmlTokens.has(n), svg: svgUrlRefs.has(n),
    dyn: isDyn(n), disambig: DISAMBIG[n] ? DISAMBIG[n].v : null,
  }))
  // 三态优先级：有消费 > 守卫 > 不确定 > 可删
  let state
  const consumed = perName.some((p) => p.jsx || p.html || p.svg)
  const dynUnresolved = perName.some((p) => (p.disambig === 'UNRESOLVED') || (p.dyn && (!p.disambig || p.disambig === 'UNRESOLVED')))
  if (consumed) state = '保留-有消费'
  else if (rec.guard.length) state = '保留-守卫'
  else if (dynUnresolved) state = '保留-不确定'
  else state = '可删'
  zero.push({ selector: rec.selector, line: rec.line, ctx: rec.ctx || '(top)', pseudoElem: rec.pseudoElem, idForm: rec.idForm, guard: rec.guard, state, names: perName })
}
const stateCounts = {}
for (const z of zero) stateCounts[z.state] = (stateCounts[z.state] || 0) + 1

const counts = {
  rules: rules.length, selectorParts: selectorRecords.length,
  distinctClasses: new Set(selectorRecords.flatMap((r) => r.classes)).size,
  distinctIds: new Set(selectorRecords.flatMap((r) => r.ids)).size,
  codeFiles: codeFiles.length, htmlFiles: htmlFiles.length,
  codeTokens: codeTokens.size, htmlTokens: htmlTokens.size, svgUrlRefs: svgUrlRefs.size,
  zeroParts: zero.length, stateCounts,
  canDelete: zero.filter((z) => z.state === '可删').length,
  distinctZeroNames: new Set(zero.flatMap((z) => z.names.map((n) => n.name))).size,
}

// ── ④ --check-deleted ──────────────────────────────────────────────────────
let checkResult = null
if (checkFile) {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(checkFile), 'utf8'))
  const items = Array.isArray(manifest) ? manifest : (manifest.items || [])
  const selectorsInCss = new Set(selectorRecords.map((r) => r.selector))
  checkResult = { impl: 's30', checked: 0, stillInCss: [], consumedNonZero: [], rows: [] }
  for (const it of items) {
    if (it.kind === 'comment') continue
    const sel = it.sel || it.selector
    const names = [...new Set(([...(sel.match(CLASS_RE) || [])].map((t) => t.slice(1))).concat([...(sel.match(ID_RE) || [])].map((t) => t.slice(1))))]
    const still = selectorsInCss.has(sel.replace(/\s+/g, ' ').trim())
    const consumed = names.filter((n) => codeTokens.has(n) || htmlTokens.has(n) || svgUrlRefs.has(n))
    checkResult.checked += 1
    if (still) checkResult.stillInCss.push(sel)
    if (consumed.length) checkResult.consumedNonZero.push({ sel, consumed })
    checkResult.rows.push({ line: it.line, sel, inCss: still, consumed })
  }
  checkResult.PASS = checkResult.stillInCss.length === 0 && checkResult.consumedNonZero.length === 0
  // 全仓消费数（供「消费数仍 = 0」读数）
  checkResult.totals = { codeTokens: codeTokens.size, htmlTokens: htmlTokens.size, svgUrlRefs: svgUrlRefs.size }
}

if (outDir) fs.mkdirSync(outDir, { recursive: true })
const payload = { impl: 's30-selector-inventory', styles: path.relative(ROOT, STYLES), counts, zero, checkDeleted: checkResult }
if (asJson) {
  const txt = JSON.stringify(payload, null, 2)
  if (outDir) fs.writeFileSync(path.join(outDir, 's30-inventory.json'), txt + '\n')
  process.stdout.write(txt + '\n')
} else {
  const L = []
  L.push('[S30 选择器盘点·升级版] 作用域 = src/styles.css（只读）')
  L.push(`  规则前导=${counts.rules} 选择器分片=${counts.selectorParts} distinct class=${counts.distinctClasses} distinct id=${counts.distinctIds}`)
  L.push(`  消费面：code=${counts.codeFiles} html=${counts.htmlFiles} code整词=${counts.codeTokens} html整词=${counts.htmlTokens} url(#id)=${counts.svgUrlRefs}`)
  L.push(`  ★ 零 JSX 消费分片=${counts.zeroParts}（distinct 名=${counts.distinctZeroNames}）`)
  L.push(`  三态：${Object.entries(stateCounts).map(([k, v]) => `${k}=${v}`).join(' ; ')}`)
  L.push('')
  L.push('  ── 可删（四类面全证零；逐条）──')
  for (const z of zero.filter((x) => x.state === '可删')) L.push(`  L${String(z.line).padStart(4)} ${z.selector}`)
  L.push('')
  L.push('  ── 保留-守卫（S22 不变式面）──')
  for (const z of zero.filter((x) => x.state === '保留-守卫')) L.push(`  L${String(z.line).padStart(4)} [${z.guard.join(',')}] ${z.selector}`)
  if (checkResult) {
    L.push('')
    L.push(`  ── --check-deleted：核 ${checkResult.checked} 条；仍在 styles.css=${checkResult.stillInCss.length}；消费非零=${checkResult.consumedNonZero.length}；PASS=${checkResult.PASS} ──`)
  }
  const txt = L.join('\n')
  if (outDir) fs.writeFileSync(path.join(outDir, 's30-inventory.txt'), txt + '\n')
  process.stdout.write(txt + '\n')
}
process.exit(checkResult && !checkResult.PASS ? 1 : 0)
