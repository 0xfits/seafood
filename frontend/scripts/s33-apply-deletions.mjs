#!/usr/bin/env node
/**
 * S33 · B12 阶段二 —— 第二批删除（只改 src/styles.css）
 *
 * 删除集来源（现取，非转抄）：
 *   A. s30 盘点脚本现跑的「可删」分片（10-s30-inventory.txt 的 可删 段）：
 *      四类面（JSX / HTML / SVG url(#) / 守卫）全证零。
 *   B. admin.html-only 消费分片（11-html-scope.json 的 adminOnlyConsumed）中，
 *      **非守卫面**且**非 pinned/伴随**者：admin.html 不引 styles.css ⇒ 该「消费」非真消费。
 *   C. 连带：仅被上述被删规则引用的 @keyframes（先证无其它引用）。
 *
 * 纪律：只删选择器（整条规则或逗号组内单个选择器）；共享块（含被保留选择器）只减去被删项；
 *       S22 守卫面（zero-ring / focus-ring / svg-url / pinned-sel / in-chest）一律不动。
 *
 * 用法：node scripts/s33-apply-deletions.mjs <runid-dir> [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const STYLES = path.join(ROOT, 'src', 'styles.css')
const runDir = process.argv[2]
const dry = process.argv.includes('--dry')
if (!runDir) { console.error('用法: node scripts/s33-apply-deletions.mjs <runid-dir> [--dry]'); process.exit(2) }

const norm = (s) => s.replace(/\s+/g, ' ').trim()
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex')

// ── 目标集 ─────────────────────────────────────────────────────────────────
const invTxt = fs.readFileSync(path.join(runDir, '10-s30-inventory.txt'), 'utf8')
const targets = new Map() // normalized selector -> {line, src}
let inDel = false
for (const ln of invTxt.split('\n')) {
  if (ln.includes('── 可删')) { inDel = true; continue }
  if (ln.includes('── 保留-守卫')) { inDel = false; continue }
  if (!inDel) continue
  const m = /^\s*L\s*(\d+)\s+(.+)$/.exec(ln)
  if (m) targets.set(norm(m[2]), { line: Number(m[1]), src: 'A:可删' })
}
const partA = targets.size

const scope = JSON.parse(fs.readFileSync(path.join(runDir, '11-html-scope.json'), 'utf8'))
const KEEP = new Set(['[data-theme="dark"] .badge::after']) // pinned `.badge::after` 的夜间伴随规则：保守保留（改它会改 pinned 元素夜间渲染）
let partB = 0
const partBSkippedGuard = [], partBSkippedKeep = []
for (const r of scope.adminOnlyConsumed) {
  const s = norm(r.selector)
  if ((r.guard || []).length) { partBSkippedGuard.push(`${s} [${r.guard.join(',')}]`); continue }
  if (KEEP.has(s)) { partBSkippedKeep.push(s); continue }
  targets.set(s, { line: r.line, src: 'B:admin.html-only' })
  partB += 1
}

const KEYFRAMES = ['badge-slide-in', 'loading', 'burst'] // 连带（见下断言）

// ── 解析 styles.css（保长度注释遮蔽 ⇒ 偏移与原文本一致）────────────────────
const raw = fs.readFileSync(STYLES, 'utf8')
const nocom = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const rules = []
{
  const stack = []
  let buf = '', bufLine = 0, bufStart = -1, line = 1
  for (let i = 0; i < nocom.length; i++) {
    const c = nocom[i]
    if (c === '{') { const pre = buf.trim(); stack.push(pre ? { pre, bodyStart: i + 1, openBrace: i, selStart: bufStart, line: bufLine } : null); buf = ''; bufStart = -1 }
    else if (c === '}') { const t = stack.pop(); if (t && t.pre) rules.push({ selector: t.pre, line: t.line, selStart: t.selStart, openBrace: t.openBrace, closeBrace: i, ancestors: stack.filter(Boolean).map((s) => s.pre) }); buf = ''; bufStart = -1 }
    else if (c === ';') { buf = ''; bufStart = -1 }
    else { if (buf.trim() === '') { bufLine = line; bufStart = i } buf += c }
    if (c === '\n') line += 1
  }
}

// ── 连带 keyframes 断言：其 animation: 引用必须全部落在被删规则内 ───────────
const kfTargets = new Set()
for (const k of KEYFRAMES) {
  const refs = [...nocom.matchAll(new RegExp(`animation\\s*:\\s*[^;}]*\\b${k}\\b`, 'g'))]
  if (!refs.length) throw new Error(`@keyframes ${k}: 无 animation 引用`)
  for (const r of refs) {
    const owner = rules.filter((x) => !x.selector.startsWith('@') && x.selStart < r.index && r.index < x.closeBrace)
      .sort((a, b) => (a.closeBrace - a.selStart) - (b.closeBrace - b.selStart))[0]
    if (!owner) throw new Error(`@keyframes ${k}: 引用点无归属规则`)
    const parts = owner.selector.split(',').map(norm).filter(Boolean)
    if (!parts.every((p) => targets.has(p))) throw new Error(`@keyframes ${k}: 引用规则「${owner.selector}」不全在被删集 ⇒ 不连带删`)
  }
  const kfRule = rules.find((x) => x.selector === `@keyframes ${k}`)
  if (!kfRule) throw new Error(`@keyframes ${k}: 未找到定义`)
  kfTargets.add(k)
}

// ── 计算删除区间 / 局部改写 ────────────────────────────────────────────────
const ranges = []   // {start,end,kind,sel,line,bytes}
const edits = []    // {start,end,text,kind,sel,line,bytes}
for (const r of rules) {
  if (r.ancestors.some((a) => /@keyframes/.test(a))) continue
  if (r.selector.startsWith('@')) {
    if (kfTargets.has(r.selector.replace('@keyframes ', '')) && r.selector.startsWith('@keyframes ')) {
      const start = lineStart(raw, r.selStart); const end = afterLine(raw, r.closeBrace + 1)
      ranges.push({ start, end, kind: 'keyframes', sel: r.selector, line: r.line })
    }
    continue
  }
  const parts = r.selector.split(',').map(norm).filter(Boolean)
  const hit = parts.filter((p) => targets.has(p))
  if (!hit.length) continue
  if (hit.length === parts.length) {
    const start = lineStart(raw, r.selStart); const end = afterLine(raw, r.closeBrace + 1)
    ranges.push({ start, end, kind: 'rule', sel: parts.join(', '), line: r.line })
  } else {
    // 共享块：只摘掉被删选择器，其余原样保留（仅重排为逗号+空格，长度不变者字节无差）
    const selText = raw.slice(r.selStart, r.openBrace)
    const mt = /^([\s\S]*?)(\s*)$/.exec(selText)
    const core = mt[1], tail = mt[2]
    const rawParts = core.split(',')
    const kept = rawParts.filter((p) => !targets.has(norm(p)))
    if (kept.length !== rawParts.length - hit.length) throw new Error(`局部改写计数失配: ${r.selector}`)
    const out = kept.map((p) => p.trim()).join(', ') + tail
    edits.push({ start: r.selStart, end: r.openBrace, text: out, kind: 'selector', sel: hit.join(', '), line: r.line })
  }
}

// 重叠检查
const all = [...ranges.map((x) => [x.start, x.end]), ...edits.map((x) => [x.start, x.end])].sort((a, b) => a[0] - b[0])
for (let i = 1; i < all.length; i++) if (all[i][0] < all[i - 1][1]) throw new Error(`区间重叠: ${JSON.stringify(all[i - 1])} / ${JSON.stringify(all[i])}`)

// ── 应用 ───────────────────────────────────────────────────────────────────
let out = raw
const ops = [...ranges.map((x) => ({ ...x, text: '' })), ...edits].sort((a, b) => b.start - a.start)
const items = []
const checkItems = [] // 逐「单个选择器」的 check-deleted 清单
for (const o of ops) {
  const removed = raw.slice(o.start, o.end)
  out = out.slice(0, o.start) + o.text + out.slice(o.end)
  items.push({ line: o.line, sel: o.sel, kind: o.kind, bytes: o.end - o.start })
  if (o.kind === 'rule' || o.kind === 'selector') for (const s of o.sel.split(', ')) checkItems.push({ line: o.line, sel: s, kind: 'rule' })
  if (o.kind === 'keyframes') checkItems.push({ line: o.line, sel: o.sel, kind: 'keyframes' })
}
items.sort((a, b) => a.line - b.line)

function lineStart(s, i) { let j = i; while (j > 0 && (s[j - 1] === ' ' || s[j - 1] === '\t')) j -= 1; return j }
function afterLine(s, i) { let j = i; while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j += 1; if (s[j] === '\n') j += 1; return j }

const manifest = {
  cssPath: STYLES,
  phase: 2,
  runid: path.basename(runDir),
  partA_from_s30_canDelete: partA,
  partB_from_adminOnly_nonGuard: partB,
  partB_skipped_guard: partBSkippedGuard,
  partB_skipped_keep: partBSkippedKeep,
  keyframes_removed: [...kfTargets],
  deletedSelectors: items.filter((i) => i.kind !== 'keyframes').length,
  deletedItems: items.length,
  deletedBytes: items.reduce((a, b) => a + b.bytes, 0),
  sha256_before: sha256(raw),
  sha256_after: sha256(out),
  lines_before: raw.split('\n').length,
  lines_after: out.split('\n').length,
  items,
}
console.log(JSON.stringify({ partA, partB, keyframes: [...kfTargets], items: items.length, bytes: manifest.deletedBytes, lines: `${manifest.lines_before} -> ${manifest.lines_after}`, sha_before: manifest.sha256_before, sha_after: manifest.sha256_after }, null, 1))
if (dry) { fs.writeFileSync(path.join(runDir, '12-dry.css'), out); console.log('DRY: wrote 12-dry.css'); process.exit(0) }
fs.writeFileSync(path.join(runDir, '12-deletion-manifest-phase2.json'), JSON.stringify(manifest, null, 2) + '\n')
fs.writeFileSync(path.join(runDir, '12-check-manifest.json'), JSON.stringify({ phase: 2, selectors: checkItems.length, items: checkItems }, null, 2) + '\n')
fs.writeFileSync(STYLES, out)
console.log('APPLIED to', STYLES, '| checkItems =', checkItems.length)
