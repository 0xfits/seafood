#!/usr/bin/env node
/**
 * P6-I18N-LIT-B3 · ① 本批写集「用户可见面 CJK 字面量」类级断言 + ② 工坊 / 商品 / 交易所**三目录**级核验（只读）
 *
 * 口径（§5.7 ②：报数带口径；与 `p4z-i18nb2-cjk.mjs` 同形，逐条可比）：
 *   ① 写集 = B3 的 4 个代码文件 + D3 的两个改指文件：
 *      `components/LoginModal.jsx` / `pages/AuthPage.jsx` / `components/auth/WalletAuthPanel.jsx` /
 *      `auth.js` / `pages/HomePage.jsx` / `pages/RewardPage.jsx`；
 *   ② 核验集 = `pages/jobs/**`、`pages/listings/**`、`pages/market/**`（`.js`/`.jsx`/`.css`，递归；排除 `__tests__`）；
 *   ③ 先用字符级状态机剥离注释（行注释 + 块注释；字符串内的斜杠不误伤），**保留字符串与 JSX 文本**；
 *   ④ CJK = U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF（表意文字；纯标点不计，与 recon §0 同口径）；
 *   ⑤ 剥离注释后仍含 CJK ⇒ 「用户可见面 CJK 字面量」命中（写集应收敛为 0；三目录 recon 判 0，本脚本**实测复核**）；
 *   ⑥ 注释里的 CJK 逐行登记（不算命中），并按文件给出注释行数读数。
 * 用法：node scripts/p4z-i18nb3-cjk.mjs [--list]   （退出码：两集命中均为 0 => 0；否则 1）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LIST = process.argv.includes('--list')
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/

const WRITE_SET = [
  'components/LoginModal.jsx',
  'pages/AuthPage.jsx',
  'components/auth/WalletAuthPanel.jsx',
  'auth.js',
  'pages/HomePage.jsx',
  'pages/RewardPage.jsx',
]
const VERIFY_DIRS = ['pages/jobs', 'pages/listings', 'pages/market']

const stripComments = (text) => {
  let out = ''
  let i = 0
  const n = text.length
  let state = null // null | "'" | '"' | '`' | '//' | '/*'
  while (i < n) {
    const ch = text[i]
    const nx = i + 1 < n ? text[i + 1] : ''
    if (state === null) {
      if (ch === '/' && nx === '/') { state = '//'; out += '  '; i += 2; continue }
      if (ch === '/' && nx === '*') { state = '/*'; out += '  '; i += 2; continue }
      if (ch === '"' || ch === "'" || ch === '`') { state = ch; out += ch; i += 1; continue }
      out += ch; i += 1; continue
    }
    if (state === '//') { if (ch === '\n') { state = null; out += '\n' } else { out += ' ' } i += 1; continue }
    if (state === '/*') {
      if (ch === '*' && nx === '/') { state = null; out += '  '; i += 2; continue }
      out += ch === '\n' ? '\n' : ' '; i += 1; continue
    }
    if (ch === '\\') { out += ch + nx; i += 2; continue }
    if (ch === state) { state = null }
    out += ch; i += 1
  }
  return out
}

const scan = (rel) => {
  const abs = path.join(SRC, rel)
  const raw = fs.readFileSync(abs, 'utf8')
  const bare = stripComments(raw)
  if (bare.length !== raw.length) { console.log(`  !! ${rel}: 剥离后长度不一致（${raw.length} vs ${bare.length}）`); process.exit(2) }
  const rawLines = raw.split('\n')
  const bareLines = bare.split('\n')
  const hits = []
  const comments = []
  bareLines.forEach((line, idx) => {
    if (CJK.test(line)) hits.push(idx + 1)
    else if (CJK.test(rawLines[idx])) comments.push(idx + 1)
  })
  return { hits, comments, abs }
}

let writeHits = 0
let writeCommentLines = 0
console.log('[B3-CJK] ① 写集 = B3 4 文件 + D3 改指 2 文件；口径 = 剥注释后残留 CJK（表意文字）')
for (const rel of WRITE_SET) {
  const { hits, comments } = scan(rel)
  writeHits += hits.length
  writeCommentLines += comments.length
  console.log(`  ${rel}: 字面量命中=${hits.length}${hits.length ? ' @L' + hits.join(',L') : ''}；注释保留中文行=${comments.length}`)
  if (LIST && hits.length) for (const ln of hits) console.log(`      L${ln}: ${fs.readFileSync(path.join(SRC, rel), 'utf8').split('\n')[ln - 1].trim()}`)
  if (comments.length) console.log(`      注释行: L${comments.join(', L')}`)
}
console.log(`[B3-CJK] ① 用户可见面 CJK 字面量命中 = ${writeHits}（断言 == 0）；注释内保留中文行 = ${writeCommentLines}（登记，不计命中）`)

let verifyHits = 0
let verifyCommentLines = 0
let verifyFiles = 0
console.log('[B3-CJK] ② 核验集 = pages/{jobs,listings,market}/**（recon 判 0 ⇒ 本脚本实测复核）')
for (const dir of VERIFY_DIRS) {
  const files = []
  const walk = (d) => {
    for (const entry of fs.readdirSync(path.join(SRC, d), { withFileTypes: true })) {
      const next = `${d}/${entry.name}`
      if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(next); continue }
      if (!/\.(js|jsx|css)$/.test(entry.name)) continue
      files.push(next)
    }
  }
  walk(dir)
  files.sort()
  let dirHits = 0
  let dirComments = 0
  for (const rel of files) {
    const { hits, comments } = scan(rel)
    dirHits += hits.length
    dirComments += comments.length
    console.log(`  ${rel}: 字面量命中=${hits.length}${hits.length ? ' @L' + hits.join(',L') : ''}；注释保留中文行=${comments.length}`)
    if (comments.length) console.log(`      注释行: L${comments.join(', L')}`)
  }
  verifyHits += dirHits
  verifyCommentLines += dirComments
  verifyFiles += files.length
  console.log(`  [${dir}] 文件数=${files.length} 字面量命中=${dirHits} 注释保留中文行=${dirComments}`)
}
console.log(`[B3-CJK] ② 三目录合计：文件数=${verifyFiles} 字面量命中=${verifyHits}（断言 == 0）；注释保留中文行=${verifyCommentLines}（登记，不计命中）`)

const overall = writeHits === 0 && verifyHits === 0
console.log(`[B3-CJK] 总判：${overall ? 'PASS' : 'FAIL'}（写集 = 0 且三目录 = 0）`)
process.exit(overall ? 0 : 1)
