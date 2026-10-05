// S39 · B12 阶段三 —— apply 删除（精确整块摘除；--dry 可无副作用预演）
// 只写 frontend/src/styles.css；不 commit / 不 push。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const STYLES = path.join(ROOT, 'src', 'styles.css')
const manifestPath = process.argv[2]
const dry = process.argv.includes('--dry')
if (!manifestPath) { console.error('usage: s39-apply-deletions.mjs <manifest.json> [--dry]'); process.exit(2) }
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
let css = fs.readFileSync(STYLES, 'utf8')
const before = sha(css)
const linesBefore = css.split('\n').length - 1
const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (man.baseStylesSha256 && man.baseStylesSha256 !== before) {
  console.error(`ABORT: styles.css sha256=${before} ≠ manifest.baseStylesSha256=${man.baseStylesSha256}`)
  process.exit(1)
}
const rows = []
for (const it of man.items) {
  const n = css.split(it.block).length - 1
  if (n !== 1) { console.error(`ABORT: 「${it.sel}」命中次数=${n}（期望 1）`); process.exit(1) }
  css = css.replace(it.block, '')
  rows.push({ sel: it.sel, kind: it.kind, removedBytes: Buffer.byteLength(it.block, 'utf8') })
}
const after = sha(css)
if (!dry) fs.writeFileSync(STYLES, css)
console.log(JSON.stringify({
  impl: 's39-apply-deletions', dry, styles: path.relative(ROOT, STYLES),
  sha256_before: before, sha256_after: after,
  lines_before: linesBefore, lines_after: css.split('\n').length - 1, rows,
}, null, 1))
