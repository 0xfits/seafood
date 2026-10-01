#!/usr/bin/env node
/**
 * P6-I18N-LIT-B2 · 本批写集「用户可见面 CJK 字面量」类级断言（只读，不写任何文件）
 *
 * 口径（§5.7 ②：报数带口径；与 B1 脚本 `p4z-i18nb1-cjk.mjs` 同形）：
 *   ① 写集 = B2 的 7 个文件（pages/{TaskPage,RewardPage,ProfilePage}.jsx /
 *      components/task/TaskCard.jsx / components/reward/RewardCard.jsx /
 *      components/ClaimRewardModal.jsx / components/ActiveTaskModal.jsx）；
 *   ② 先用字符级状态机剥离注释（行注释与块注释两种；字符串内的斜杠不误伤），**保留字符串与 JSX 文本**；
 *   ③ CJK = U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF（表意文字；纯标点不计，与 recon §0 同口径）；
 *   ④ 剥离注释后仍含 CJK ⇒ 「用户可见面 CJK 字面量」命中（应收敛为 0）；
 *   ⑤ 注释里的 CJK 逐行列出（不算命中，仅登记）。
 * 用法：node scripts/p4z-i18nb2-cjk.mjs [--list]   （退出码：命中 0 => 0；否则 1）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const FILES = [
  'pages/TaskPage.jsx',
  'pages/RewardPage.jsx',
  'pages/ProfilePage.jsx',
  'components/task/TaskCard.jsx',
  'components/reward/RewardCard.jsx',
  'components/ClaimRewardModal.jsx',
  'components/ActiveTaskModal.jsx',
]
const LIST = process.argv.includes('--list')
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/

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

let hits = 0
let retained = 0
console.log('[B2-CJK] 写集 = B2 7 文件；口径 = 剥注释后残留 CJK（表意文字）')
for (const rel of FILES) {
  const abs = path.join(SRC, rel)
  const raw = fs.readFileSync(abs, 'utf8')
  const bare = stripComments(raw)
  if (bare.length !== raw.length) { console.log(`  !! ${rel}: 剥离后长度不一致（${raw.length} vs ${bare.length}）`); process.exit(2) }
  const rawLines = raw.split('\n')
  const bareLines = bare.split('\n')
  const fileHits = []
  const fileComments = []
  bareLines.forEach((line, idx) => {
    if (CJK.test(line)) fileHits.push(idx + 1)
    else if (CJK.test(rawLines[idx])) fileComments.push(idx + 1)
  })
  hits += fileHits.length
  retained += fileComments.length
  console.log(`  ${rel}: 字面量命中=${fileHits.length}${fileHits.length ? ' @L' + fileHits.join(',L') : ''}；注释保留中文行=${fileComments.length}`)
  if (LIST && fileHits.length) {
    for (const ln of fileHits) console.log(`      L${ln}: ${rawLines[ln - 1].trim()}`)
  }
  if (fileComments.length) console.log(`      注释行: L${fileComments.join(', L')}`)
}
console.log(`[B2-CJK] 用户可见面 CJK 字面量命中 = ${hits}（断言 == 0）`)
console.log(`[B2-CJK] 注释内保留中文行 = ${retained}（登记，不计命中）`)
console.log(`[B2-CJK] 总判：${hits === 0 ? 'PASS' : 'FAIL'}`)
process.exit(hits === 0 ? 0 : 1)
