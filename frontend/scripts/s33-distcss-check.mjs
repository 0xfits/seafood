// S33 判据② 后半：产物 CSS 中「被删独立选择器」命中 = 0（选择器级精确匹配，非子串）
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(process.cwd())
const distAssets = path.join(ROOT, 'dist', 'assets')
const css = fs.readdirSync(distAssets).filter((f) => f.endsWith('.css')).map((f) => path.join(distAssets, f))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
const text = fs.readFileSync(css, 'utf8')
const nocom = text.replace(/\/\*[\s\S]*?\*\//g, ' ')
const nq = (s) => s.replace(/["']/g, '').replace(/\s+/g, ' ').trim()
const selSet = new Set()
{
  const stack = []
  let buf = ''
  for (let i = 0; i < nocom.length; i++) {
    const c = nocom[i]
    if (c === '{') { const pre = buf.trim(); stack.push(pre || null); buf = '' }
    else if (c === '}') { const t = stack.pop(); if (t && !t.startsWith('@')) for (const s of t.split(',')) selSet.add(nq(s)); buf = '' }
    else if (c === ';') buf = ''
    else buf += c
  }
}
const man = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const KEEP = new Set(['[data-theme="dark"] .badge::after'])
// 同名不同源白名单：选择器名与 Tailwind 工具类撞名者——须现证「产物里那条不是 styles.css 的规则」。
//   .table ← Tailwind `display:table` 工具类；候选 `table` 来自 src/pages/ThemePreviewPage.jsx（<table>/tableTitle/const table），
//            before-dist 与 after-dist 均存在；且改后 src/styles.css 含子串 "table" 的处数 = 0（现取见报告 §3）。
const ALLOW = {
  '.table': { body: 'display:table', why: 'Tailwind 工具类 display:table（非 styles.css 规则；before/after 产物均在）' },
}
const rulesOf = (sel) => {
  const out = []
  const re = new RegExp(`(^|[},])${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`, 'g')
  for (const m of nocom.matchAll(re)) out.push(m[2])
  return out
}
const hits = [], allowed = []
let checked = 0
for (const it of man.items) {
  const sel = it.sel
  if (it.kind === 'keyframes' || sel.startsWith('@')) continue
  if (KEEP.has(sel)) continue
  checked += 1
  if (!selSet.has(nq(sel))) continue
  const bodies = rulesOf(sel)
  const isTailwindCollision = ALLOW[sel] && bodies.length > 0 && bodies.every((b) => b.replace(/\s/g, '').includes(ALLOW[sel].body))
  if (isTailwindCollision) allowed.push({ sel, bodies, why: ALLOW[sel].why })
  else hits.push({ sel, bodies })
}
const res = { distCss: path.relative(ROOT, css), distBytes: text.length, distSelectors: selSet.size, checkedSelectors: checked, rawHits: hits.length, hits, allowedSameNameDifferentSource: allowed, PASS: hits.length === 0 }
fs.writeFileSync(process.argv[3] || '/dev/stdout', JSON.stringify(res, null, 2) + '\n')
console.log(JSON.stringify({ ...res, hits: undefined, allowedSameNameDifferentSource: undefined }, null, 1))
process.exit(hits.length ? 1 : 0)
