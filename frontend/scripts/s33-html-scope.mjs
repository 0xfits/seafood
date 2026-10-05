#!/usr/bin/env node
/**
 * S33 · B12 阶段二 —— HTML 面「按文件来源」拆解 + card/badge 约束解算（只读）
 *
 * 目的：判定 admin.html 是否构成约束。步骤：
 *   ① 逐 HTML 文件（index.html / admin.html / public/*.html）现取 htmlTokens（与 s30 同 regex/分词）；
 *   ② 读 s30 盘点 JSON，取 state='保留-有消费' 的分片；
 *   ③ 逐分片判定「其全部消费名是否仅由 html 提供（jsx=false 且 svg=false）」，
 *      并标出是**哪些** html 文件供名 ⇒ 仅 admin.html 供名者 = card/badge 候选子集；
 *   ④ 输出 JSON + 人读清单。
 *
 * 用法：node scripts/s33-html-scope.mjs <s30-inventory.json> [--out <dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const argv = process.argv.slice(2)
const jsonPath = argv.find((a) => !a.startsWith('--'))
const outI = argv.indexOf('--out')
const outDir = outI >= 0 ? argv[outI + 1] : null
if (!jsonPath) { console.error('用法: node scripts/s33-html-scope.mjs <s30-inventory.json> [--out <dir>]'); process.exit(2) }

// ① 逐 HTML 文件 tokens（与 s30 同源 regex/分词）
const CLASS_TOKEN_RE = /^[A-Za-z_][\w-]*$/
const tokenize = (t) => t.split(/[\s"'`{}()[\].,;:=>$#+*!?&|~/\\]+/).filter((x) => CLASS_TOKEN_RE.test(x) && x.length >= 2)
const htmlFiles = []
for (const c of ['index.html', 'admin.html']) { const p = path.join(ROOT, c); if (fs.existsSync(p)) htmlFiles.push(p) }
const pub = path.join(ROOT, 'public')
if (fs.existsSync(pub)) for (const e of fs.readdirSync(pub, { withFileTypes: true })) if (e.isFile() && /\.html?$/.test(e.name)) htmlFiles.push(path.join(pub, e.name))
const tokensByFile = {}
for (const fp of htmlFiles) {
  const set = new Set()
  for (const m of fs.readFileSync(fp, 'utf8').matchAll(/(?:class|id)=["']([^"']*)["']/g)) for (const t of tokenize(m[1])) set.add(t)
  tokensByFile[path.relative(ROOT, fp)] = set
}
const fileOf = {}
for (const [rel, set] of Object.entries(tokensByFile)) for (const t of set) (fileOf[t] = fileOf[t] || []).push(rel)

// ② 读 s30 盘点 JSON
const inv = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const zero = inv.zero || []

// ③ 逐分片：仅 html 供名 ⇒ 候选；标出供名文件
const rows = []
for (const z of zero) {
  const names = z.names || []
  const consuming = names.filter((n) => n.jsx || n.html || n.svg)
  if (!consuming.length) continue
  const anyJsx = consuming.some((n) => n.jsx)
  const anySvg = consuming.some((n) => n.svg)
  const srcs = new Set()
  for (const n of consuming) { if (n.html) for (const f of (fileOf[n.name] || [])) srcs.add(f) }
  rows.push({
    selector: z.selector, line: z.line, ctx: z.ctx, state: z.state, guard: z.guard || [],
    consuming: consuming.map((n) => ({ name: n.name, jsx: n.jsx, html: n.html, svg: n.svg, dyn: n.dyn, disambig: n.disambig })),
    htmlSources: [...srcs], anyJsx, anySvg,
    htmlOnly: !anyJsx && !anySvg,
    adminOnly: (!anyJsx && !anySvg) && srcs.size > 0 && [...srcs].every((f) => f === 'admin.html'),
  })
}
const candidates = rows.filter((r) => r.htmlOnly && r.state === '保留-有消费')
const adminOnlyCandidates = rows.filter((r) => r.adminOnly)

const payload = {
  impl: 's33-html-scope',
  htmlFiles: Object.keys(tokensByFile).map((f) => ({ file: f, tokens: [...tokensByFile[f]].sort() })),
  counts: {
    zeroParts: zero.length,
    rowsWithConsumption: rows.length,
    htmlOnlyConsumed: candidates.length,
    adminOnlyConsumed: adminOnlyCandidates.length,
  },
  htmlOnlyConsumed: candidates,
  adminOnlyConsumed: adminOnlyCandidates,
}
if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, '11-html-scope.json'), JSON.stringify(payload, null, 2) + '\n') }

const L = []
L.push('[S33 HTML 面拆解] 逐文件 tokens:')
for (const [f, set] of Object.entries(tokensByFile)) L.push(`  ${f}: ${[...set].sort().join(' ')}`)
L.push('')
L.push(`★ html-only 消费分片（非 JSX 非 SVG，仅 HTML 供名）= ${candidates.length}`)
for (const r of candidates) L.push(`  L${String(r.line).padStart(4)} ${r.selector}   <- [${r.consuming.map((c) => c.name).join(',')}] src=${r.htmlSources.join('+')} guard=[${r.guard.join(',')}]`)
L.push('')
L.push(`★ admin.html-only 消费分片（唯一供名文件 = admin.html）= ${adminOnlyCandidates.length}`)
for (const r of adminOnlyCandidates) L.push(`  L${String(r.line).padStart(4)} ${r.selector}   <- [${r.consuming.map((c) => c.name).join(',')}] guard=[${r.guard.join(',')}]`)
const txt = L.join('\n')
if (outDir) fs.writeFileSync(path.join(outDir, '11-html-scope.txt'), txt + '\n')
process.stdout.write(txt + '\n')
