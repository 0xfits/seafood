#!/usr/bin/env node
/**
 * P6-I18N-LIT-B4a · ① 本批写集「用户可见面 CJK 字面量」类级断言 + ② B4b 剩余面只读读数（供接力单定基线）
 *
 * 口径（§5.7 ②：报数带口径；与 `p4z-i18nb3-cjk.mjs` 同形，逐条可比）：
 *   ① 写集 = B4a 的 4 个代码文件（后台管理面前半：布局 / 总览 / 任务管理 / 奖品管理）；
 *   ② 剩余集 = B4b 待办 5 文件（权限 / 积分 / 碎片 / 系统设置 / 用户管理）—— **只读**，不算写集命中；
 *   ③ 先用字符级状态机剥离注释（行注释 + 块注释；字符串内的斜杠不误伤），**保留字符串与 JSX 文本**；
 *   ④ CJK = U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF（表意文字；纯标点如「、」「：」「。」不计，与 recon §0 同口径）；
 *   ⑤ 剥离注释后仍含 CJK ⇒ 「用户可见面 CJK 字面量」命中（写集应收敛为 0）；
 *   ⑥ 注释里的 CJK 逐行登记（不算命中），并按文件给出注释行数读数。
 * 用法：node scripts/p4z-i18nb4a-cjk.mjs [--list]   （退出码：写集命中为 0 => 0；否则 1）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LIST = process.argv.includes('--list')
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/

const WRITE_SET = [
  'components/layout/AdminLayout.jsx',
  'pages/DashboardPage.jsx',
  'pages/admin/TasksManagement.jsx',
  'pages/admin/RewardsManagement.jsx',
]
// B4b 接力面（本单只读；recon 表④ B4 的余下 5 文件）
const REMAIN_SET = [
  'pages/admin/PermissionsManagement.jsx',
  'pages/admin/PointsManagement.jsx',
  'pages/admin/ShardsManagement.jsx',
  'pages/admin/SystemSettings.jsx',
  'pages/admin/UsersManagement.jsx',
]

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
  return { hits, comments, rawLines }
}

let writeHits = 0
let writeCommentLines = 0
console.log('[B4a-CJK] ① 写集 = 后台管理面前半 4 文件；口径 = 剥注释后残留 CJK（表意文字）')
for (const rel of WRITE_SET) {
  const { hits, comments, rawLines } = scan(rel)
  writeHits += hits.length
  writeCommentLines += comments.length
  console.log(`  ${rel}: 字面量命中=${hits.length}${hits.length ? ' @L' + hits.join(',L') : ''}；注释保留中文行=${comments.length}`)
  if (LIST && hits.length) for (const ln of hits) console.log(`      L${ln}: ${rawLines[ln - 1].trim()}`)
}
console.log(`[B4a-CJK] ① 用户可见面 CJK 字面量命中 = ${writeHits}（断言 == 0）；注释内保留中文行 = ${writeCommentLines}（登记，不计命中）`)

let remainHits = 0
let remainComments = 0
console.log('[B4a-CJK] ② B4b 剩余面（只读读数，不计入本批断言）')
for (const rel of REMAIN_SET) {
  const { hits, comments } = scan(rel)
  remainHits += hits.length
  remainComments += comments.length
  console.log(`  ${rel}: 字面量命中=${hits.length}；注释保留中文行=${comments.length}`)
}
console.log(`[B4a-CJK] ② B4b 剩余 5 文件合计：字面量命中=${remainHits}；注释保留中文行=${remainComments}（供接力单定基线）`)

const overall = writeHits === 0
console.log(`[B4a-CJK] 总判：${overall ? 'PASS' : 'FAIL'}（写集 == 0）`)
process.exit(overall ? 0 : 1)
