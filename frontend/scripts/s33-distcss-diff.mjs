// S33 判据② 精判：产物 CSS 选择器集 before→after 差集
//   · removed = before 有、after 无 的选择器（应 = 本批被删、且确被 styles.css 产出的那些）
//   · added   = after 有、before 无（应 = ∅）
//   · 同名不同源（如 Tailwind 工具类 .table{display:table}）在两版都在 ⇒ 不计入 removed，单独登记。
import fs from 'node:fs'
const nq = (s) => s.replace(/["']/g, '').replace(/\s+/g, ' ').trim()
function sels(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
  const set = new Set()
  const stack = []; let buf = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') { const pre = buf.trim(); stack.push(pre || null); buf = '' }
    else if (c === '}') { const t = stack.pop(); if (t && !t.startsWith('@')) for (const s of t.split(',')) set.add(nq(s)); buf = '' }
    else if (c === ';') buf = ''
    else buf += c
  }
  return set
}
const [before, after] = process.argv.slice(2)
const B = sels(before), A = sels(after)
const removed = [...B].filter((s) => !A.has(s)).sort()
const added = [...A].filter((s) => !B.has(s)).sort()
const out = { beforeCss: before, afterCss: after, selectorsBefore: B.size, selectorsAfter: A.size, removed, added, PASS: added.length === 0 }
console.log(JSON.stringify(out, null, 1))
fs.writeFileSync(process.argv[5] || process.argv[4] || '/dev/stdout', JSON.stringify(out, null, 2) + '\n')
