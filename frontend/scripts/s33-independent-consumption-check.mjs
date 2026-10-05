// 独立复核：把 src/ 中「类名上下文」字符串里的 token 全量取出，与待删名求交。
// 与 s30 盘点脚本**独立实现**（不共用代码），用于交叉验证「JSX 面零消费」。
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(process.cwd(), 'src')
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === 'test') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p) } return out }
const files = walk(ROOT)
const CTX = /(?:className|class|id)\s*=\s*|(?:cn|clsx|classnames|cx)\s*\(|classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(|querySelector(?:All)?\s*\(\s*['"`]?\.?|getElementById\s*\(/g
const LIT = /'([^'\\\n]*)'|"([^"\\\n]*)"|`((?:[^`\\]|\\.)*)`/g
const TOK = /^[A-Za-z_][\w-]*$/
const tok = (t) => t.split(/[\s"'`{}()[\].,;:=>$#+*!?&|~/\\]+/).filter((x) => TOK.test(x) && x.length >= 2)
const seen = new Map() // name -> [file:line,...]
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const blobs = []
  for (const m of src.matchAll(CTX)) blobs.push({ text: src.slice(m.index + m[0].length, m.index + m[0].length + 200), off: m.index })
  for (const b of blobs) for (const lm of b.text.matchAll(LIT)) for (const t of tok(lm[1] ?? lm[2] ?? lm[3] ?? '')) { if (!seen.has(t)) seen.set(t, []); if (seen.get(t).length < 3) seen.get(t).push(f.replace(ROOT + '/', '')) }
}
const names = process.argv.slice(2)
let fail = 0
for (const n of names) { if (seen.has(n)) { console.log(`CONSUMED  ${n}  <- ${seen.get(n).join(', ')}`); fail++ } }
console.log(JSON.stringify({ impl: 's33-independent-consumption-check', files: files.length, distinctCtxTokens: seen.size, checkedNames: names.length, consumedHits: fail, verdict: fail === 0 ? 'ALL_ZERO' : 'CONSUMED_FOUND' }))
process.exit(fail ? 1 : 0)
